<?php
// api/doctor_patients_controller.php
// Manages the read-only patient list and medical history for a specific doctor
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record & 04 Database Design/database_master_detail_design_part_2 (Parameterized patient lookup and Master-Detail consultation history assembly)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? 'list';

try {
    if ($method === 'GET') {
        if ($action === 'history') {
            if (!isset($_GET['patient_id'])) {
                send_error('patient_id is required.', [], 400);
            }
            getMedicalHistory($pdo, (int)$_GET['patient_id']);
        } else {
            listMyPatients($pdo);
        }
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in doctor_patients_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', ['details' => $e->getMessage()], 500);
} catch (Exception $e) {
    error_log("General Error in doctor_patients_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getDoctorId(PDO $pdo, int $userId): int {
    $stmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }
    return (int)$doc['doctor_id'];
}

function listMyPatients(PDO $pdo): void {
    $doctorId = getDoctorId($pdo, $_SESSION['user_id']);
    
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
    $offset = ($page - 1) * $pageSize;
    $search = trim($_GET['search'] ?? '');

    $where = ['a.doctor_id = :doctor_id'];
    $params = [':doctor_id' => $doctorId];

    if ($search !== '') {
        $where[] = '(p.first_name LIKE :s1 OR p.last_name LIKE :s2 OR p.contact_no LIKE :s3 OR p.patient_id LIKE :s4)';
        $params[':s1'] = "%$search%";
        $params[':s2'] = "%$search%";
        $params[':s3'] = "%$search%";
        $params[':s4'] = "%$search%";
    }

    $whereSql = implode(' AND ', $where);

    // Count distinct patients
    $countSql = "SELECT COUNT(DISTINCT p.patient_id) 
                 FROM patients p
                 INNER JOIN appointments a ON p.patient_id = a.patient_id
                 WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Fetch distinct patients
    $dataSql = "SELECT p.patient_id, p.first_name, p.last_name, p.middle_initial, p.gender, p.date_of_birth, p.contact_no, p.address, p.deleted_at,
                       MAX(a.appointment_date) as last_appointment_date
                FROM patients p
                INNER JOIN appointments a ON p.patient_id = a.patient_id
                WHERE {$whereSql}
                GROUP BY p.patient_id
                ORDER BY p.last_name ASC, p.first_name ASC
                LIMIT :limit OFFSET :offset";
                
    $stmt = $pdo->prepare($dataSql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate age
    $now = new DateTime();
    foreach ($patients as &$p) {
        if (!empty($p['date_of_birth'])) {
            $dob = new DateTime($p['date_of_birth']);
            $p['age'] = $now->diff($dob)->y;
        } else {
            $p['age'] = 'Unknown';
        }
    }

    send_success('Patients retrieved.', [
        'items' => $patients,
        'total' => $total,
        'page' => $page,
        'page_size' => $pageSize,
        'pages' => (int)ceil($total / $pageSize)
    ]);
}

function getMedicalHistory(PDO $pdo, int $patientId): void {
    $doctorId = getDoctorId($pdo, $_SESSION['user_id']);

    // 1. Verify access: Does this doctor have any appointments with this patient?
    $chkStmt = $pdo->prepare("SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1");
    $chkStmt->execute([$doctorId, $patientId]);
    if (!$chkStmt->fetch()) {
        send_error('Unauthorized access to this patient record.', [], 403);
    }

    // 2. Fetch Demographics
    $pStmt = $pdo->prepare("SELECT patient_id, first_name, last_name, middle_initial, gender, date_of_birth, contact_no, address, deleted_at FROM patients WHERE patient_id = ?");
    $pStmt->execute([$patientId]);
    $patient = $pStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($patient && !empty($patient['date_of_birth'])) {
        $dob = new DateTime($patient['date_of_birth']);
        $now = new DateTime();
        $patient['age'] = $now->diff($dob)->y;
    }

    // 3. Fetch Encounter Timeline (Appointments + Consultations)
    $sqlEncounters = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.chief_complaint, a.status,
                             c.consultation_id, c.notes, c.consultation_date,
                             v.blood_pressure, v.temperature, v.oxygen_saturation
                      FROM appointments a
                      LEFT JOIN consultation c ON a.appointment_id = c.appointment_id
                      LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
                      WHERE a.patient_id = ? AND a.doctor_id = ? 
                        AND a.status IN ('completed', 'scheduled', 'confirmed')
                      ORDER BY a.appointment_date DESC, a.appointment_time DESC";
    
    $eStmt = $pdo->prepare($sqlEncounters);
    $eStmt->execute([$patientId, $doctorId]);
    $encounters = $eStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Attach associated data to each encounter
    foreach ($encounters as &$enc) {
        $enc['diagnoses'] = [];
        $enc['prescriptions'] = [];
        $enc['lab_requests'] = [];

        if (!empty($enc['consultation_id'])) {
            $cid = $enc['consultation_id'];
            
            // Diagnoses
            $dStmt = $pdo->prepare("SELECT icd10_code, diagnosis_name, notes FROM diagnosis WHERE consultation_id = ?");
            $dStmt->execute([$cid]);
            $enc['diagnoses'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Prescriptions
            $rStmt = $pdo->prepare("SELECT p.dosage, p.frequency, m.name as medication_name 
                                    FROM prescriptions p 
                                    INNER JOIN medications m ON p.medication_id = m.medication_id 
                                    WHERE p.consultation_id = ?");
            $rStmt->execute([$cid]);
            $enc['prescriptions'] = $rStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Lab Requests
            $lStmt = $pdo->prepare("SELECT test_name, status, request_date FROM lab_requests WHERE consultation_id = ?");
            $lStmt->execute([$cid]);
            $enc['lab_requests'] = $lStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    send_success('Medical history retrieved.', [
        'patient' => $patient,
        'encounters' => $encounters
    ]);
}
