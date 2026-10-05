<?php
// api/patient_record_controller.php
// Read-only patient record: demographics, visit timeline, and clinical details.
// Administrators and Receptionists may open any patient's record; Doctors are
// scoped to patients they have an appointment with. Consultation notes are
// omitted for Receptionists.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record
// & 04 Database Design/database_master_detail_design_part_2 (parameterized master-detail assembly)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Administrator', 'Receptionist', 'Doctor']);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? 'history';

try {
    if ($method === 'GET') {
        if ($action !== 'history') {
            send_error('Unknown action.', [], 400);
        }
        if (!isset($_GET['patient_id'])) {
            send_error('patient_id is required.', [], 400);
        }
        getPatientRecord($pdo, (int)$_GET['patient_id']);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in patient_record_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', ['details' => $e->getMessage()], 500);
} catch (Exception $e) {
    error_log("General Error in patient_record_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getPatientRecord(PDO $pdo, int $patientId): void {
    $role = get_current_user_role();
    $hideClinicalNotes = ($role === 'Receptionist');

    // Doctors may only open records of patients assigned to them.
    $doctorId = null;
    if ($role === 'Doctor') {
        $docStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $docStmt->execute([$_SESSION['user_id']]);
        $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
        if (!$doc) {
            send_error('Doctor profile not found.', [], 404);
        }
        $doctorId = (int)$doc['doctor_id'];

        $chkStmt = $pdo->prepare("SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1");
        $chkStmt->execute([$doctorId, $patientId]);
        if (!$chkStmt->fetch()) {
            send_error('Unauthorized access to this patient record.', [], 403);
        }
    }

    $pStmt = $pdo->prepare("SELECT patient_id, first_name, last_name, middle_initial, gender, date_of_birth,
                                   contact_no, address, created_at, deleted_at
                            FROM patients WHERE patient_id = ?");
    $pStmt->execute([$patientId]);
    $patient = $pStmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        send_error('Patient not found.', [], 404);
    }

    if (!empty($patient['date_of_birth'])) {
        $dob = new DateTime($patient['date_of_birth']);
        $patient['age'] = (new DateTime())->diff($dob)->y;
    } else {
        $patient['age'] = null;
    }

    $sql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.chief_complaint, a.status,
                   c.consultation_id, c.notes, c.consultation_date,
                   v.blood_pressure, v.temperature, v.oxygen_saturation,
                   u.first_name AS doctor_first, u.last_name AS doctor_last, u.middle_initial AS doctor_middle
            FROM appointments a
            LEFT JOIN consultation c ON a.appointment_id = c.appointment_id
            LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
            LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
            LEFT JOIN users u ON d.user_id = u.user_id
            WHERE a.patient_id = ?";

    $params = [$patientId];
    if ($doctorId !== null) {
        $sql .= " AND a.doctor_id = ?";
        $params[] = $doctorId;
    }
    $sql .= " ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $encounters = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $today = date('Y-m-d');
    $summary = [
        'total_visits' => count($encounters),
        'completed'    => 0,
        'upcoming'     => 0,
        'cancelled'    => 0,
        'last_visit'   => null,
        'next_visit'   => null
    ];

    foreach ($encounters as &$enc) {
        $enc['diagnoses'] = [];
        $enc['prescriptions'] = [];
        $enc['lab_requests'] = [];

        if ($enc['status'] === 'completed') {
            $summary['completed']++;
            if ($summary['last_visit'] === null) {
                $summary['last_visit'] = $enc['appointment_date'];
            }
        }
        if ($enc['status'] === 'scheduled' || $enc['status'] === 'confirmed') {
            $summary['upcoming']++;
            if ($enc['appointment_date'] >= $today && ($summary['next_visit'] === null || $enc['appointment_date'] < $summary['next_visit'])) {
                $summary['next_visit'] = $enc['appointment_date'];
            }
        }
        if ($enc['status'] === 'cancelled' || $enc['status'] === 'no_show') {
            $summary['cancelled']++;
        }

        if ($hideClinicalNotes) {
            $enc['notes'] = null;
        }

        if (!empty($enc['consultation_id'])) {
            $cid = (int)$enc['consultation_id'];

            $dStmt = $pdo->prepare("SELECT icd10_code, diagnosis_name, notes FROM diagnosis WHERE consultation_id = ? ORDER BY diagnosis_id ASC");
            $dStmt->execute([$cid]);
            $enc['diagnoses'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);

            $rStmt = $pdo->prepare("SELECT p.dosage, p.frequency, p.time_to_take, p.start_date, p.end_date,
                                           m.name AS medication_name, m.generic_name
                                    FROM prescriptions p
                                    INNER JOIN medications m ON p.medication_id = m.medication_id
                                    WHERE p.consultation_id = ?
                                    ORDER BY p.prescription_id ASC");
            $rStmt->execute([$cid]);
            $enc['prescriptions'] = $rStmt->fetchAll(PDO::FETCH_ASSOC);

            $lStmt = $pdo->prepare("SELECT lab_request_id, test_name, status, request_date FROM lab_requests WHERE consultation_id = ? ORDER BY lab_request_id ASC");
            $lStmt->execute([$cid]);
            $enc['lab_requests'] = $lStmt->fetchAll(PDO::FETCH_ASSOC);

            if ($hideClinicalNotes) {
                foreach ($enc['diagnoses'] as &$dx) {
                    unset($dx['notes']);
                }
                unset($dx);
            }
        }
    }
    unset($enc);

    send_success('Patient record retrieved.', [
        'patient'     => $patient,
        'summary'     => $summary,
        'encounters'  => $encounters,
        'viewer_role' => $role
    ]);
}
