<?php
// api/doctor_patients_controller.php
// Manages the read-only patient list and medical history for a specific doctor
// - Lists patients with active/prior non-cancelled appointments
// - Scopes medical history access to assigned patients, with audited Break-Glass override
// - Returns longitudinal history across all attending physicians with explicit author names
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record & 04 Database Design/database_master_detail_design_part_2 (Parameterized patient lookup and Master-Detail consultation history assembly)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

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
    send_error('A database error occurred. Please try again.', [], 500);
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

    // Allow doctors to browse all registered hospital patients
    $where = ['p.deleted_at IS NULL'];
    $params = [];

    // Priority 1: Search by name, contact, or address
    if ($search !== '') {
        $where[] = '(p.first_name LIKE :s1 OR p.last_name LIKE :s2 OR p.contact_no LIKE :s3 OR p.address LIKE :s4)';
        $params[':s1'] = "%$search%";
        $params[':s2'] = "%$search%";
        $params[':s3'] = "%$search%";
        $params[':s4'] = "%$search%";
    }

    $assignmentStatus = trim($_GET['assignment_status'] ?? 'all');
    if ($assignmentStatus === 'assigned') {
        $where[] = 'EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.patient_id AND a.doctor_id = :filter_doc_id AND a.status != \'cancelled\')';
        $params[':filter_doc_id'] = $doctorId;
    } elseif ($assignmentStatus === 'unassigned') {
        $where[] = 'NOT EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.patient_id AND a.doctor_id = :filter_doc_id AND a.status != \'cancelled\')';
        $params[':filter_doc_id'] = $doctorId;
    }

    $gender = strtolower(trim($_GET['gender'] ?? ''));
    if ($gender === 'male' || $gender === 'female' || $gender === 'unknown') {
        $where[] = 'LOWER(TRIM(p.gender)) = :gender';
        $params[':gender'] = $gender;
    } elseif ($gender === 'other') {
        $where[] = "(LOWER(TRIM(COALESCE(p.gender, ''))) NOT IN ('male', 'female', 'unknown') AND LOWER(TRIM(COALESCE(p.gender, ''))) != '')";
    }

    $whereSql = implode(' AND ', $where);

    // Count all registered patients matching filters
    $countSql = "SELECT COUNT(*) FROM patients p WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Dynamic sorting
    $allowedSort = [
        'last_name' => 'p.last_name',
        'date_of_birth' => 'p.date_of_birth',
        'contact_no' => 'p.contact_no',
        'gender' => 'p.gender'
    ];
    $sortBy = $_GET['sort_by'] ?? 'last_name';
    $sortCol = $allowedSort[$sortBy] ?? 'p.last_name';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    if ($sortCol === 'p.last_name') {
        $orderSql = "ORDER BY p.last_name $sortOrder, p.first_name $sortOrder";
    } else {
        $orderSql = "ORDER BY $sortCol $sortOrder, p.last_name ASC";
    }

    // Fetch patients and evaluate whether this doctor has an active clinical appointment relationship
    $dataSql = "SELECT p.patient_id, p.first_name, p.last_name, p.middle_initial, p.gender, p.date_of_birth,
                       p.contact_no, p.address, p.allergies_alerts, p.allergies_confirmed_by_doctor, p.deleted_at,
                       (SELECT COUNT(*) FROM appointments a 
                        WHERE a.patient_id = p.patient_id 
                          AND a.doctor_id = :doctor_id 
                          AND a.status != 'cancelled') AS is_assigned
                FROM patients p
                WHERE {$whereSql}
                {$orderSql}
                LIMIT :limit OFFSET :offset";
                
    $stmt = $pdo->prepare($dataSql);
    $stmt->bindValue(':doctor_id', $doctorId, PDO::PARAM_INT);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate age and normalize is_assigned boolean
    $now = new DateTime();
    foreach ($patients as &$p) {
        if (!empty($p['date_of_birth'])) {
            $dob = new DateTime($p['date_of_birth']);
            $p['age'] = $now->diff($dob)->y;
        } else {
            $p['age'] = 'Unknown';
        }
        $p['is_assigned'] = ((int)($p['is_assigned'] ?? 0) > 0);
    }
    unset($p);

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
    $userId = (int)$_SESSION['user_id'];

    // 1. Verify access: Does this doctor have a non-cancelled appointment with this patient?
    $chkStmt = $pdo->prepare("SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? AND status != 'cancelled' LIMIT 1");
    $chkStmt->execute([$doctorId, $patientId]);
    $hasRelationship = (bool)$chkStmt->fetch();

    $isBreakGlass = false;
    if (!$hasRelationship) {
        $breakGlassParam = $_GET['break_glass'] ?? '';
        $breakGlassReason = trim($_GET['break_glass_reason'] ?? '');

        if (($breakGlassParam === 'true' || $breakGlassParam === '1') && mb_strlen($breakGlassReason) >= 10) {
            $isBreakGlass = true;
            log_audit($pdo, $userId, 'BREAK_GLASS_ACCESS', 'patient', $patientId, null, null, $breakGlassReason);
        } else {
            send_error(
                'Unauthorized access to this patient record. A non-cancelled appointment is required, or a justified emergency break-glass override must be provided.',
                ['break_glass_required' => true],
                403
            );
        }
    } else {
        log_audit($pdo, $userId, 'VIEW_RECORD', 'patient', $patientId);
    }

    // 2. Fetch Demographics
    $pStmt = $pdo->prepare(
        "SELECT patient_id, first_name, last_name, middle_initial, gender, date_of_birth,
                contact_no, address, allergies_alerts, allergies_confirmed_by_doctor, deleted_at
         FROM patients WHERE patient_id = ?"
    );
    $pStmt->execute([$patientId]);
    $patient = $pStmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        send_error('Patient not found.', [], 404);
    }
    
    if (!empty($patient['date_of_birth'])) {
        $dob = new DateTime($patient['date_of_birth']);
        $now = new DateTime();
        $patient['age'] = $now->diff($dob)->y;
    } else {
        $patient['age'] = 'Unknown';
    }

    // 3. Longitudinal History: Fetch Encounter Timeline across ALL attending physicians
    $sqlEncounters = "SELECT a.appointment_id, a.doctor_id, a.appointment_date, a.appointment_time, a.chief_complaint, a.status,
                             c.consultation_id, c.notes, c.consultation_date,
                             v.blood_pressure, v.temperature, v.oxygen_saturation,
                             u.first_name AS doctor_first, u.last_name AS doctor_last, u.middle_initial AS doctor_middle
                      FROM appointments a
                      LEFT JOIN consultation c ON a.appointment_id = c.appointment_id
                      LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
                      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
                      LEFT JOIN users u ON d.user_id = u.user_id
                      WHERE a.patient_id = ?
                        AND a.status IN ('completed', 'scheduled', 'confirmed', 'no_show')
                      ORDER BY a.appointment_date DESC, a.appointment_time DESC";
    
    $eStmt = $pdo->prepare($sqlEncounters);
    $eStmt->execute([$patientId]);
    $encounters = $eStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Attach associated data (diagnoses, prescriptions, lab requests, and addenda) to each encounter
    foreach ($encounters as &$enc) {
        $enc['diagnoses'] = [];
        $enc['prescriptions'] = [];
        $enc['lab_requests'] = [];
        $enc['addenda'] = [];
        $enc['attending_doctor'] = 'Dr. ' . trim(($enc['doctor_first'] ?? '') . ' ' . ($enc['doctor_last'] ?? ''));

        if (!empty($enc['consultation_id'])) {
            $cid = (int)$enc['consultation_id'];
            
            // Diagnoses
            $dStmt = $pdo->prepare("SELECT icd10_code, diagnosis_name, notes FROM diagnosis WHERE consultation_id = ? ORDER BY diagnosis_id ASC");
            $dStmt->execute([$cid]);
            $enc['diagnoses'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Prescriptions
            $rStmt = $pdo->prepare("SELECT p.dosage, p.frequency, p.time_to_take, p.start_date, p.end_date,
                                           COALESCE(m.name, p.medication_name, 'Discontinued Medication') as medication_name,
                                           COALESCE(m.generic_name, p.generic_name) as generic_name 
                                    FROM prescriptions p 
                                    LEFT JOIN medications m ON p.medication_id = m.medication_id 
                                    WHERE p.consultation_id = ?
                                    ORDER BY p.prescription_id ASC");
            $rStmt->execute([$cid]);
            $enc['prescriptions'] = $rStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Lab Requests
            $lStmt = $pdo->prepare("SELECT lab_request_id, test_name, status, request_date FROM lab_requests WHERE consultation_id = ? ORDER BY lab_request_id ASC");
            $lStmt->execute([$cid]);
            $enc['lab_requests'] = $lStmt->fetchAll(PDO::FETCH_ASSOC);

            // Addenda
            $aStmt = $pdo->prepare("SELECT ca.addendum_id, ca.notes, ca.created_at,
                                           CONCAT('Dr. ', u.first_name, ' ', u.last_name) AS author_name
                                    FROM consultation_addenda ca
                                    INNER JOIN doctors d ON ca.doctor_id = d.doctor_id
                                    INNER JOIN users u ON d.user_id = u.user_id
                                    WHERE ca.consultation_id = ?
                                    ORDER BY ca.created_at ASC");
            $aStmt->execute([$cid]);
            $enc['addenda'] = $aStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }
    unset($enc);

    send_success('Medical history retrieved.', [
        'patient'        => $patient,
        'encounters'     => $encounters,
        'is_break_glass' => $isBreakGlass
    ]);
}

