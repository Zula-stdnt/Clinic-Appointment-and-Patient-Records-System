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
require_once __DIR__ . '/../includes/patient_validation.php';

require_login();
require_role(['Administrator', 'Receptionist', 'Doctor']);
verify_csrf_on_state_change();

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
    $patient['allergies_list'] = getPatientAllergies($pdo, $patientId);

    // 2. PRIVACY RULE: Administrators and Receptionists have ZERO clinical access.
    // They receive demographic columns and non-clinical appointment history log only.
    // Encounters, notes, vitals, prescriptions, and lab orders are strictly omitted.
    if ($role === 'Administrator' || $role === 'Receptionist') {
        $histStmt = $pdo->prepare("
            SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                   u.first_name AS doctor_first, u.last_name AS doctor_last, u.middle_initial AS doctor_middle,
                   GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS doctor_specialties
            FROM appointments a
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u ON d.user_id = u.user_id
            LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
            WHERE a.patient_id = ?
            GROUP BY a.appointment_id, a.appointment_date, a.appointment_time, a.status, u.first_name, u.last_name, u.middle_initial
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        ");
        $histStmt->execute([$patientId]);
        $appointmentHistory = $histStmt->fetchAll(PDO::FETCH_ASSOC);

        log_audit($pdo, $userId, 'VIEW_DEMOGRAPHICS', 'patient', $patientId);
        send_success('Patient record retrieved (demographics and appointment history).', [
            'patient'             => $patient,
            'appointment_history' => $appointmentHistory,
            'summary'             => null,
            'encounters'          => [],
            'viewer_role'         => $role,
            'is_clinical'         => false
        ]);
        return;
    }

    // 3. CLINICAL RULE: Doctors may access patients with a non-cancelled appointment,
    // an approved administrative access request, or an audited Break-Glass Emergency Override.
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

        if ($breakGlassParam === 'true' || $breakGlassParam === '1') {
            // Urgent Mode Break-Glass Override
            if (mb_strlen($breakGlassReason) < 10) {
                send_error('Clinical justification must be at least 10 characters long.', ['reason' => 'Justification is too short.'], 403);
            }

            $isBreakGlass = true;
            $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
            $insReq = $pdo->prepare("
                INSERT INTO record_access_requests (doctor_id, patient_id, mode, status, reason, is_audit_flagged, audit_reviewed, expires_at)
                VALUES (?, ?, 'urgent', 'approved', ?, 1, 0, ?)
            ");
            $insReq->execute([$doctorId, $patientId, $breakGlassReason, $expiresAt]);

            log_audit($pdo, $userId, 'BREAK_GLASS_ACCESS', 'patient', $patientId, null, null, $breakGlassReason);
        } else {
            // Check for active routine administrative approval (Standard Mode)
            $apprStmt = $pdo->prepare("
                SELECT request_id, mode FROM record_access_requests 
                WHERE doctor_id = ? AND patient_id = ? AND mode = 'standard' AND status = 'approved'
                  AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY request_id DESC LIMIT 1
            ");
            $apprStmt->execute([$doctorId, $patientId]);
            $activeApproval = $apprStmt->fetch(PDO::FETCH_ASSOC);

            if ($activeApproval) {
                log_audit($pdo, $userId, 'VIEW_RECORD_APPROVED_ACCESS', 'patient', $patientId, null, [
                    'request_id' => (int)$activeApproval['request_id'],
                    'mode'       => $activeApproval['mode']
                ]);
            } else {
                // Check if a standard request is pending
                $pendStmt = $pdo->prepare("SELECT request_id FROM record_access_requests WHERE doctor_id = ? AND patient_id = ? AND status = 'pending' LIMIT 1");
                $pendStmt->execute([$doctorId, $patientId]);
                $pendingReqId = $pendStmt->fetchColumn();

                send_error(
                    'Unauthorized access to this patient record. A non-cancelled appointment is required, or a justified emergency break-glass override must be provided.',
                    [
                        'break_glass_required' => true,
                        'has_pending_request'  => (bool)$pendingReqId,
                        'pending_request_id'   => $pendingReqId ? (int)$pendingReqId : null
                    ],
                    403
                );
            }
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

            // Diagnoses (3NF join against icd10_codes catalog)
            $dStmt = $pdo->prepare("SELECT d.icd10_code, COALESCE(NULLIF(TRIM(d.diagnosis_name), ''), ic.description) AS diagnosis_name, ic.description AS icd10_description, d.notes
                                    FROM diagnosis d
                                    LEFT JOIN icd10_codes ic ON d.icd10_code = ic.code
                                    WHERE d.consultation_id = ?
                                    ORDER BY d.diagnosis_id ASC");
            $dStmt->execute([$cid]);
            $enc['diagnoses'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);

            // Prescriptions
            $rStmt = $pdo->prepare("SELECT p.prescription_id, p.medication_id, p.strength, p.dosage, p.route,
                                           p.frequency, p.duration, p.instructions, p.time_to_take, p.start_date, p.end_date,
                                           COALESCE(m.name, p.medication_name, 'Discontinued Medication') AS medication_name,
                                           COALESCE(m.generic_name, p.generic_name) AS generic_name
                                    FROM prescriptions p
                                    LEFT JOIN medications m ON p.medication_id = m.medication_id
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

