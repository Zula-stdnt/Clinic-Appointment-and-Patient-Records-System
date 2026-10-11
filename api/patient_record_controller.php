<?php
// api/patient_record_controller.php
// Longitudinal patient medical records with strict clinical privacy gating.
// - Administrators and Receptionists receive demographic records ONLY (zero clinical charts).
// - Doctors are scoped to patients with non-cancelled appointments, or require an audited Break-Glass emergency override.
// - Longitudinal encounters display history across all attending physicians with explicit author labeling.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record
// & 04 Database Design/database_master_detail_design_part_2 (parameterized master-detail assembly with RBAC)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

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
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in patient_record_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getPatientRecord(PDO $pdo, int $patientId): void {
    $role = get_current_user_role();
    $userId = (int)($_SESSION['user_id'] ?? 0);

    // 1. Fetch Patient Demographics (shared baseline)
    $pStmt = $pdo->prepare("SELECT patient_id, first_name, last_name, middle_initial, gender, date_of_birth,
                                   contact_no, address, allergies_alerts, allergies_confirmed_by_doctor,
                                   created_at, deleted_at
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

    // 2. PRIVACY RULE: Administrators and Receptionists have ZERO clinical access.
    // They receive demographic columns only; encounters and medical charts are strictly omitted.
    if ($role === 'Administrator' || $role === 'Receptionist') {
        log_audit($pdo, $userId, 'VIEW_DEMOGRAPHICS', 'patient', $patientId);
        send_success('Patient record retrieved (demographics only).', [
            'patient'     => $patient,
            'summary'     => null,
            'encounters'  => [],
            'viewer_role' => $role,
            'is_clinical' => false
        ]);
        return;
    }

    // 3. CLINICAL RULE: Doctors may only access patients with a non-cancelled appointment,
    // or must supply an audited Break-Glass Emergency Override with a mandatory justification.
    $doctorId = null;
    $isBreakGlass = false;
    $docStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
    $docStmt->execute([$userId]);
    $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }
    $doctorId = (int)$doc['doctor_id'];

    $chkStmt = $pdo->prepare(
        "SELECT 1 FROM appointments 
         WHERE doctor_id = ? AND patient_id = ? AND status != 'cancelled' 
         LIMIT 1"
    );
    $chkStmt->execute([$doctorId, $patientId]);
    $hasRelationship = (bool)$chkStmt->fetch();

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

    // 4. Longitudinal History: Retrieve ALL encounters across all attending doctors
    $sql = "SELECT a.appointment_id, a.doctor_id, a.appointment_date, a.appointment_time, a.chief_complaint, a.status,
                   c.consultation_id, c.notes, c.consultation_date,
                   v.blood_pressure, v.temperature, v.oxygen_saturation,
                   u.first_name AS doctor_first, u.last_name AS doctor_last, u.middle_initial AS doctor_middle
            FROM appointments a
            LEFT JOIN consultation c ON a.appointment_id = c.appointment_id
            LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
            LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
            LEFT JOIN users u ON d.user_id = u.user_id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$patientId]);
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
        $enc['addenda'] = [];
        $enc['attending_doctor'] = 'Dr. ' . trim(($enc['doctor_first'] ?? '') . ' ' . ($enc['doctor_last'] ?? ''));

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

        if (!empty($enc['consultation_id'])) {
            $cid = (int)$enc['consultation_id'];

            // Diagnoses
            $dStmt = $pdo->prepare("SELECT icd10_code, diagnosis_name, notes FROM diagnosis WHERE consultation_id = ? ORDER BY diagnosis_id ASC");
            $dStmt->execute([$cid]);
            $enc['diagnoses'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);

            // Prescriptions
            $rStmt = $pdo->prepare("SELECT p.dosage, p.frequency, p.time_to_take, p.start_date, p.end_date,
                                           m.name AS medication_name, m.generic_name
                                    FROM prescriptions p
                                    INNER JOIN medications m ON p.medication_id = m.medication_id
                                    WHERE p.consultation_id = ?
                                    ORDER BY p.prescription_id ASC");
            $rStmt->execute([$cid]);
            $enc['prescriptions'] = $rStmt->fetchAll(PDO::FETCH_ASSOC);

            // Lab requests
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

    send_success('Patient record retrieved.', [
        'patient'        => $patient,
        'summary'        => $summary,
        'encounters'     => $encounters,
        'viewer_role'    => $role,
        'is_clinical'    => true,
        'is_break_glass' => $isBreakGlass
    ]);
}

