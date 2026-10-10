<?php
// api/consultation_controller.php
// Manages the creation and retrieval of medical consultations
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms & 04 Database Design/database_master_detail_design_part_2 (PDO transaction saving consultation header + diagnosis, prescriptions, and lab_requests detail rows via lastInsertId)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Doctor', 'Administrator']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    if ($method === 'GET') {
        if (!isset($_GET['appointment_id'])) {
            send_error('appointment_id is required.', [], 400);
        }
        getConsultationDetails($pdo, (int)$_GET['appointment_id']);
    } elseif ($method === 'POST') {
        saveConsultation($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in consultation_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', ['details' => $e->getMessage()], 500);
} catch (Exception $e) {
    error_log("General Error in consultation_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getConsultationDetails(PDO $pdo, int $appointmentId) {
    $authUser = get_auth_user();

    // 1. Verify Appointment & Doctor access
    $sqlAppt = "SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, 
                       a.appointment_time, a.chief_complaint, a.status,
                       p.first_name as patient_first, p.last_name as patient_last, p.date_of_birth, p.gender
                FROM appointments a
                INNER JOIN patients p ON a.patient_id = p.patient_id
                WHERE a.appointment_id = ?";
    $stmtAppt = $pdo->prepare($sqlAppt);
    $stmtAppt->execute([$appointmentId]);
    $appointment = $stmtAppt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment) {
        send_error('Appointment not found.', [], 404);
    }

    if ($authUser['role_name'] === 'Doctor') {
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $stmtDoc->execute([$authUser['user_id']]);
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
        if (!$doc || $appointment['doctor_id'] != $doc['doctor_id']) {
             send_error('Unauthorized access to this appointment.', [], 403);
        }
    }

    // Gating: Doctor must not load an editable consultation while Scheduled
    if ($appointment['status'] === 'scheduled') {
        send_error('Cannot consult an appointment that is scheduled. Appointment must be confirmed first.', ['status' => 'scheduled'], 409);
    }
    if (in_array($appointment['status'], ['cancelled', 'no_show']) && $appointment['status'] !== 'completed') {
        // If not completed and cancelled/no_show, reject consultation access
        send_error('Cannot consult an appointment that is ' . $appointment['status'] . '.', ['status' => $appointment['status']], 409);
    }

    // Calculate patient age
    if (!empty($appointment['date_of_birth'])) {
        $dob = new DateTime($appointment['date_of_birth']);
        $now = new DateTime();
        $appointment['age'] = $now->diff($dob)->y;
    } else {
        $appointment['age'] = 'Unknown';
    }

    // 2. Get Vitals
    $stmtVitals = $pdo->prepare("SELECT blood_pressure, temperature, oxygen_saturation FROM vital_signs WHERE appointment_id = ?");
    $stmtVitals->execute([$appointmentId]);
    $vitals = $stmtVitals->fetch(PDO::FETCH_ASSOC);

    // 3. Get Existing Consultation
    $stmtCons = $pdo->prepare("SELECT consultation_id, notes, consultation_date FROM consultation WHERE appointment_id = ?");
    $stmtCons->execute([$appointmentId]);
    $consultation = $stmtCons->fetch(PDO::FETCH_ASSOC);

    $diagnoses = [];
    $prescriptions = [];
    $lab_requests = [];

    if ($consultation) {
        $consId = $consultation['consultation_id'];
        
        $stmtDiag = $pdo->prepare("SELECT diagnosis_id, icd10_code, diagnosis_name, notes FROM diagnosis WHERE consultation_id = ?");
        $stmtDiag->execute([$consId]);
        $diagnoses = $stmtDiag->fetchAll(PDO::FETCH_ASSOC);

        $stmtRx = $pdo->prepare("SELECT p.prescription_id, p.medication_id, m.name as medication_name, p.dosage, p.frequency, p.start_date, p.end_date 
                                 FROM prescriptions p
                                 INNER JOIN medications m ON p.medication_id = m.medication_id
                                 WHERE p.consultation_id = ?");
        $stmtRx->execute([$consId]);
        $prescriptions = $stmtRx->fetchAll(PDO::FETCH_ASSOC);

        $stmtLab = $pdo->prepare("SELECT lab_request_id, test_name, request_date, status FROM lab_requests WHERE consultation_id = ?");
        $stmtLab->execute([$consId]);
        $lab_requests = $stmtLab->fetchAll(PDO::FETCH_ASSOC);
    }

    send_success('Consultation details retrieved.', [
        'appointment' => $appointment,
        'vitals' => $vitals ?: null,
        'consultation' => $consultation ?: null,
        'diagnoses' => $diagnoses,
        'prescriptions' => $prescriptions,
        'lab_requests' => $lab_requests
    ]);
}

function saveConsultation(PDO $pdo) {
    $authUser = get_auth_user();
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['appointment_id'])) {
        send_error('Invalid payload or missing appointment_id.', [], 400);
    }

    $appointmentId = (int)$input['appointment_id'];

    $pdo->beginTransaction();

    try {
        // Verify ownership and lifecycle with a row lock
        if ($authUser['role_name'] === 'Doctor') {
            $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
            $stmtDoc->execute([$authUser['user_id']]);
            $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);

            $stmtAppt = $pdo->prepare("SELECT doctor_id, status FROM appointments WHERE appointment_id = ? FOR UPDATE");
            $stmtAppt->execute([$appointmentId]);
            $appt = $stmtAppt->fetch(PDO::FETCH_ASSOC);

            if (!$appt || !$doc || $appt['doctor_id'] != $doc['doctor_id']) {
                $pdo->rollBack();
                send_error('Unauthorized access to this appointment.', [], 403);
            }
            
            if ($appt['status'] === 'scheduled') {
                $pdo->rollBack();
                send_error('Cannot consult an appointment that is scheduled. Appointment must be confirmed first.', ['status' => 'scheduled'], 409);
            }
            if ($appt['status'] !== 'confirmed') {
                $pdo->rollBack();
                send_error('Cannot modify an appointment that is ' . $appt['status'] . '.', ['status' => $appt['status']], 409);
            }
        } else {
            // For Admin or other roles, still enforce lifecycle
            $stmtAppt = $pdo->prepare("SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE");
            $stmtAppt->execute([$appointmentId]);
            $appt = $stmtAppt->fetch(PDO::FETCH_ASSOC);
            
            if (!$appt) {
                $pdo->rollBack();
                send_error('Appointment not found.', [], 404);
            }
            if ($appt['status'] === 'scheduled') {
                $pdo->rollBack();
                send_error('Cannot consult an appointment that is scheduled. Appointment must be confirmed first.', ['status' => 'scheduled'], 409);
            }
            if ($appt['status'] !== 'confirmed') {
                $pdo->rollBack();
                send_error('Cannot modify an appointment that is ' . $appt['status'] . '.', ['status' => $appt['status']], 409);
            }
        }

        // 1. Insert or Update Consultation
        $stmtConsCheck = $pdo->prepare("SELECT consultation_id FROM consultation WHERE appointment_id = ? FOR UPDATE");
        $stmtConsCheck->execute([$appointmentId]);
        $existingCons = $stmtConsCheck->fetch(PDO::FETCH_ASSOC);

        $notes = $input['notes'] ?? null;
        $consultationId = null;

        if ($existingCons) {
            $consultationId = $existingCons['consultation_id'];
            $stmtUpdate = $pdo->prepare("UPDATE consultation SET notes = ? WHERE consultation_id = ?");
            $stmtUpdate->execute([$notes, $consultationId]);
        } else {
            $stmtInsert = $pdo->prepare("INSERT INTO consultation (appointment_id, notes, consultation_date) VALUES (?, ?, NOW())");
            $stmtInsert->execute([$appointmentId, $notes]);
            $consultationId = $pdo->lastInsertId();
        }

        // 2. Replace Diagnoses (Clear and Insert)
        $pdo->prepare("DELETE FROM diagnosis WHERE consultation_id = ?")->execute([$consultationId]);
        if (!empty($input['diagnoses']) && is_array($input['diagnoses'])) {
            $stmtDiag = $pdo->prepare("INSERT INTO diagnosis (consultation_id, icd10_code, diagnosis_name, notes) VALUES (?, ?, ?, ?)");
            foreach ($input['diagnoses'] as $d) {
                if (!empty($d['diagnosis_name'])) {
                    $stmtDiag->execute([$consultationId, $d['icd10_code'] ?? null, $d['diagnosis_name'], $d['notes'] ?? null]);
                }
            }
        }

        // 3. Replace Prescriptions
        $pdo->prepare("DELETE FROM prescriptions WHERE consultation_id = ?")->execute([$consultationId]);
        if (!empty($input['prescriptions']) && is_array($input['prescriptions'])) {
            $stmtRx = $pdo->prepare("INSERT INTO prescriptions (consultation_id, medication_id, dosage, frequency, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($input['prescriptions'] as $p) {
                if (!empty($p['medication_id']) && !empty($p['dosage']) && !empty($p['frequency'])) {
                    $startDate = !empty($p['start_date']) ? $p['start_date'] : date('Y-m-d');
                    $endDate = !empty($p['end_date']) ? $p['end_date'] : null;
                    $stmtRx->execute([$consultationId, $p['medication_id'], $p['dosage'], $p['frequency'], $startDate, $endDate]);
                }
            }
        }

        // 4. Replace Lab Requests
        $pdo->prepare("DELETE FROM lab_requests WHERE consultation_id = ?")->execute([$consultationId]);
        if (!empty($input['lab_requests']) && is_array($input['lab_requests'])) {
            $stmtLab = $pdo->prepare("INSERT INTO lab_requests (consultation_id, test_name, request_date, status) VALUES (?, ?, ?, 'requested')");
            foreach ($input['lab_requests'] as $l) {
                if (!empty($l['test_name'])) {
                    $reqDate = !empty($l['request_date']) ? $l['request_date'] : date('Y-m-d');
                    $stmtLab->execute([$consultationId, $l['test_name'], $reqDate]);
                }
            }
        }

        // 5. Update Appointment Status to Completed
        $pdo->prepare("UPDATE appointments SET status = 'completed' WHERE appointment_id = ?")->execute([$appointmentId]);

        $pdo->commit();
        send_success('Consultation saved successfully.', ['consultation_id' => $consultationId]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
