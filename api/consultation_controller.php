<?php
// api/consultation_controller.php
// Manages medical consultations with strict doctor clinical boundaries and immutable encounters
// - Doctors only: Administrators and Receptionists have zero clinical access
// - Completed consultations are locked: amendments are recorded as dated addenda in consultation_addenda
// - Doctors can confirm and update patient allergy alerts during consultation
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms & 04 Database Design/database_master_detail_design_part_2 (PDO transaction saving consultation header + diagnosis, prescriptions, and lab_requests detail rows via lastInsertId, bindParam, and switch($operation))

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';
require_once __DIR__ . '/../includes/clinical_notes.php';
require_once __DIR__ . '/../includes/patient_validation.php';

require_login();
require_role('Doctor');
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_REQUEST['operation'] ?? $_GET['action'] ?? null;

if (!in_array($method, ['GET', 'POST'], true)) {
    send_error('Method not allowed.', [], 405);
}

if ($method === 'GET') {
    $operation = $action ?: 'getConsultationDetails';
} else {
    $operation = $action ?: 'saveConsultation';
}

try {
    switch ($operation) {
        case 'getConsultationDetails':
        case 'get':
            if (!isset($_GET['appointment_id'])) {
                send_error('appointment_id is required.', [], 400);
            }
            getConsultationDetails($pdo, (int)$_GET['appointment_id']);
            break;
        case 'addendum':
        case 'saveConsultationAddendum':
            saveConsultationAddendum($pdo);
            break;
        case 'saveConsultation':
        case 'save':
            saveConsultation($pdo);
            break;
        default:
            send_error('Invalid operation.', [], 400);
    }
} catch (PDOException $e) {
    error_log("Database Error in consultation_controller.php: " . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in consultation_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getConsultationDetails(PDO $pdo, int $appointmentId) {
    $authUser = get_auth_user();
    $authUserId = (int)$authUser['user_id'];

    // 1. Verify Appointment & Doctor access
    $sqlAppt = "SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, 
                       a.appointment_time, a.chief_complaint, a.status,
                       p.first_name as patient_first, p.last_name as patient_last, p.middle_initial as patient_middle,
                       p.date_of_birth, p.gender, p.address, p.contact_no, p.allergies_alerts, p.allergies_confirmed_by_doctor,
                       u.first_name as doctor_first, u.last_name as doctor_last, u.middle_initial as doctor_middle,
                       (SELECT GROUP_CONCAT(s.specialty_name SEPARATOR ', ')
                          FROM doctor_specialty ds
                          INNER JOIN specialties s ON ds.specialty_id = s.specialty_id
                         WHERE ds.doctor_id = a.doctor_id) as doctor_specialties
                FROM appointments a
                INNER JOIN patients p ON a.patient_id = p.patient_id
                INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                LEFT JOIN users u ON d.user_id = u.user_id
                WHERE a.appointment_id = :appointmentId";
    $stmtAppt = $pdo->prepare($sqlAppt);
    $stmtAppt->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
    $stmtAppt->execute();
    $appointment = $stmtAppt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment) {
        send_error('Appointment not found.', [], 404);
    }

    $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = :userId LIMIT 1");
    $stmtDoc->bindParam(':userId', $authUserId, PDO::PARAM_INT);
    $stmtDoc->execute();
    $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
    if (!$doc || !is_doctor_authorized_for_appointment($pdo, (int)$doc['doctor_id'], $appointment)) {
        send_error('Unauthorized access to this appointment.', [], 403);
    }

    $isDirectAttendingDoctor = ((int)$appointment['doctor_id'] === (int)$doc['doctor_id']);

    // Gating: Doctor must not load an editable consultation while Scheduled (unless viewing completed history)
    if ($appointment['status'] === 'scheduled' && $isDirectAttendingDoctor) {
        send_error('Cannot consult an appointment that is scheduled. Appointment must be confirmed first.', ['status' => 'scheduled'], 409);
    }
    if (in_array($appointment['status'], ['cancelled', 'no_show']) && $appointment['status'] !== 'completed') {
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
    $appointment['allergies_list'] = getPatientAllergies($pdo, (int)$appointment['patient_id']);

    // 2. Get Vitals
    $stmtVitals = $pdo->prepare("SELECT blood_pressure, temperature, oxygen_saturation FROM vital_signs WHERE appointment_id = :appointmentId");
    $stmtVitals->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
    $stmtVitals->execute();
    $vitals = $stmtVitals->fetch(PDO::FETCH_ASSOC);

    // 3. Get Existing Consultation
    $stmtCons = $pdo->prepare("SELECT consultation_id, notes, consultation_date FROM consultation WHERE appointment_id = :appointmentId");
    $stmtCons->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
    $stmtCons->execute();
    $consultation = $stmtCons->fetch(PDO::FETCH_ASSOC);

    $diagnoses = [];
    $prescriptions = [];
    $lab_requests = [];
    $addenda = [];

    if ($consultation) {
        $consId = (int)$consultation['consultation_id'];
        $consultation['soap'] = parse_soap_notes($consultation['notes'] ?? '');
        
        $stmtDiag = $pdo->prepare("SELECT d.diagnosis_id, d.icd10_code, COALESCE(NULLIF(TRIM(d.diagnosis_name), ''), ic.description) AS diagnosis_name, d.notes, ic.description as icd10_description
                                   FROM diagnosis d
                                   LEFT JOIN icd10_codes ic ON d.icd10_code = ic.code
                                   WHERE d.consultation_id = :consId
                                   ORDER BY d.diagnosis_id ASC");
        $stmtDiag->bindParam(':consId', $consId, PDO::PARAM_INT);
        $stmtDiag->execute();
        $diagnoses = $stmtDiag->fetchAll(PDO::FETCH_ASSOC);

        $stmtRx = $pdo->prepare("SELECT p.prescription_id, p.medication_id,
                                        COALESCE(m.name, p.medication_name, 'Discontinued Medication') as medication_name,
                                        COALESCE(m.generic_name, p.generic_name) as medication_generic,
                                        p.strength, p.dosage, p.route, p.frequency, p.duration, p.instructions,
                                        p.time_to_take, p.start_date, p.end_date 
                                 FROM prescriptions p
                                 LEFT JOIN medications m ON p.medication_id = m.medication_id
                                 WHERE p.consultation_id = :consId
                                 ORDER BY p.prescription_id ASC");
        $stmtRx->bindParam(':consId', $consId, PDO::PARAM_INT);
        $stmtRx->execute();
        $prescriptions = $stmtRx->fetchAll(PDO::FETCH_ASSOC);

        $stmtLab = $pdo->prepare("SELECT lr.lab_request_id, lr.test_name, lr.request_date, lr.status
                                  FROM lab_requests lr
                                  WHERE lr.consultation_id = :consId
                                  ORDER BY lr.lab_request_id ASC");
        $stmtLab->bindParam(':consId', $consId, PDO::PARAM_INT);
        $stmtLab->execute();
        $lab_requests = $stmtLab->fetchAll(PDO::FETCH_ASSOC);

        $stmtAdd = $pdo->prepare("SELECT ca.addendum_id, ca.notes, ca.created_at,
                                         CONCAT('Dr. ', u.first_name, ' ', u.last_name) AS author_name
                                  FROM consultation_addenda ca
                                  INNER JOIN doctors d ON ca.doctor_id = d.doctor_id
                                  INNER JOIN users u ON d.user_id = u.user_id
                                  WHERE ca.consultation_id = :consId
                                  ORDER BY ca.created_at ASC");
        $stmtAdd->bindParam(':consId', $consId, PDO::PARAM_INT);
        $stmtAdd->execute();
        $addenda = $stmtAdd->fetchAll(PDO::FETCH_ASSOC);
    }

    send_success('Consultation details retrieved.', [
        'appointment'  => $appointment,
        'vitals'       => $vitals ?: null,
        'consultation' => $consultation ?: null,
        'diagnoses'    => $diagnoses,
        'prescriptions'=> $prescriptions,
        'lab_requests' => $lab_requests,
        'addenda'      => $addenda
    ]);
}

function saveConsultation(PDO $pdo) {
    $authUser = get_auth_user();
    $authUserId = (int)$authUser['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['appointment_id'])) {
        send_error('Invalid payload or missing appointment_id.', [], 400);
    }

    $appointmentId = (int)$input['appointment_id'];

    // Validate referenced ICD-10 codes before writing
    $icdCodes = [];
    if (!empty($input['diagnoses']) && is_array($input['diagnoses'])) {
        foreach ($input['diagnoses'] as $d) {
            $code = trim($d['icd10_code'] ?? '');
            if ($code !== '') {
                $icdCodes[$code] = true;
            }
        }
        $icdCodes = array_keys($icdCodes);
    }
    if (!empty($icdCodes)) {
        $placeholders = implode(',', array_fill(0, count($icdCodes), '?'));
        $stmtIcd = $pdo->prepare("SELECT code FROM icd10_codes WHERE code IN ({$placeholders})");
        $stmtIcd->execute($icdCodes);
        $missingIcd = array_diff($icdCodes, array_column($stmtIcd->fetchAll(PDO::FETCH_ASSOC), 'code'));
        if (!empty($missingIcd)) {
            send_error('Unknown ICD-10 code(s): ' . implode(', ', $missingIcd), ['diagnoses' => 'Select a valid ICD-10 code from the catalog.'], 422);
        }
    }

    $pdo->beginTransaction();

    try {
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = :userId LIMIT 1");
        $stmtDoc->bindParam(':userId', $authUserId, PDO::PARAM_INT);
        $stmtDoc->execute();
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);

        $stmtAppt = $pdo->prepare("SELECT appointment_id, patient_id, doctor_id, status FROM appointments WHERE appointment_id = :appointmentId FOR UPDATE");
        $stmtAppt->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
        $stmtAppt->execute();
        $appt = $stmtAppt->fetch(PDO::FETCH_ASSOC);

        if (!$appt || !$doc || $appt['doctor_id'] != $doc['doctor_id']) {
            $pdo->rollBack();
            send_error('Unauthorized access to this appointment.', [], 403);
        }
        
        if ($appt['status'] === 'scheduled') {
            $pdo->rollBack();
            send_error('Cannot consult an appointment that is scheduled. Appointment must be confirmed first.', ['status' => 'scheduled'], 409);
        }
        if ($appt['status'] === 'completed') {
            $pdo->rollBack();
            send_error('Completed visits are locked and cannot be edited. Please submit a dated addendum instead.', ['status' => 'completed'], 409);
        }
        if ($appt['status'] !== 'confirmed') {
            $pdo->rollBack();
            send_error('Cannot modify an appointment that is ' . $appt['status'] . '.', ['status' => $appt['status']], 409);
        }

        // 1. Insert or Update Consultation
        $stmtConsCheck = $pdo->prepare("SELECT consultation_id FROM consultation WHERE appointment_id = :appointmentId FOR UPDATE");
        $stmtConsCheck->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
        $stmtConsCheck->execute();
        $existingCons = $stmtConsCheck->fetch(PDO::FETCH_ASSOC);

        $notes = null;
        if (isset($input['soap']) && is_array($input['soap'])) {
            $notes = compile_soap_notes($input['soap']);
        } elseif (isset($input['notes'])) {
            $notes = trim((string)$input['notes']) ?: null;
        }
        $consultationId = null;

        if ($existingCons) {
            $consultationId = (int)$existingCons['consultation_id'];
            $stmtUpdate = $pdo->prepare("UPDATE consultation SET notes = :notes WHERE consultation_id = :consId");
            $stmtUpdate->bindParam(':notes', $notes);
            $stmtUpdate->bindParam(':consId', $consultationId, PDO::PARAM_INT);
            $stmtUpdate->execute();
        } else {
            $stmtInsert = $pdo->prepare("INSERT INTO consultation (appointment_id, notes, consultation_date) VALUES (:appointmentId, :notes, NOW())");
            $stmtInsert->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
            $stmtInsert->bindParam(':notes', $notes);
            $stmtInsert->execute();
            $consultationId = (int)$pdo->lastInsertId();
        }

        // 2. Replace Diagnoses
        $delDiag = $pdo->prepare("DELETE FROM diagnosis WHERE consultation_id = :consId");
        $delDiag->bindParam(':consId', $consultationId, PDO::PARAM_INT);
        $delDiag->execute();

        if (!empty($input['diagnoses']) && is_array($input['diagnoses'])) {
            $icdCode = null;
            $diagName = '';
            $diagNotes = null;
            $stmtDiag = $pdo->prepare("INSERT INTO diagnosis (consultation_id, icd10_code, diagnosis_name, notes) VALUES (:consId, :icdCode, :diagName, :diagNotes)");
            $stmtDiag->bindParam(':consId', $consultationId, PDO::PARAM_INT);
            $stmtDiag->bindParam(':icdCode', $icdCode);
            $stmtDiag->bindParam(':diagName', $diagName);
            $stmtDiag->bindParam(':diagNotes', $diagNotes);

            $stmtIcdDesc = $pdo->prepare("SELECT description FROM icd10_codes WHERE code = :icdCode LIMIT 1");
            $stmtIcdDesc->bindParam(':icdCode', $icdCode);

            foreach ($input['diagnoses'] as $d) {
                $icdCode = !empty($d['icd10_code']) ? trim((string)$d['icd10_code']) : null;
                $diagName = trim((string)($d['diagnosis_name'] ?? ''));
                $diagNotes = $d['notes'] ?? null;
                if ($diagName === '' && $icdCode !== null) {
                    $stmtIcdDesc->execute();
                    $diagName = (string)($stmtIcdDesc->fetchColumn() ?: $icdCode);
                }
                if ($diagName !== '') {
                    $stmtDiag->execute();
                }
            }
        }

        // 3. Replace Prescriptions
        $delRx = $pdo->prepare("DELETE FROM prescriptions WHERE consultation_id = :consId");
        $delRx->bindParam(':consId', $consultationId, PDO::PARAM_INT);
        $delRx->execute();

        if (!empty($input['prescriptions']) && is_array($input['prescriptions'])) {
            $medId = 0;
            $medName = null;
            $medGeneric = null;
            $strength = null;
            $dosage = 'As directed';
            $route = null;
            $frequency = 'As directed';
            $duration = null;
            $instructions = null;
            $timeToTake = null;
            $startDate = date('Y-m-d');
            $endDate = null;

            $stmtMedLookup = $pdo->prepare("SELECT name, generic_name FROM medications WHERE medication_id = :medId LIMIT 1");
            $stmtMedLookup->bindParam(':medId', $medId, PDO::PARAM_INT);

            $stmtRx = $pdo->prepare(
                "INSERT INTO prescriptions (consultation_id, medication_id, medication_name, generic_name, strength, dosage, route, frequency, duration, instructions, time_to_take, start_date, end_date)
                 VALUES (:consId, :medId, :medName, :medGeneric, :strength, :dosage, :route, :frequency, :duration, :instructions, :timeToTake, :startDate, :endDate)"
            );
            $stmtRx->bindParam(':consId', $consultationId, PDO::PARAM_INT);
            $stmtRx->bindParam(':medId', $medId, PDO::PARAM_INT);
            $stmtRx->bindParam(':medName', $medName);
            $stmtRx->bindParam(':medGeneric', $medGeneric);
            $stmtRx->bindParam(':strength', $strength);
            $stmtRx->bindParam(':dosage', $dosage);
            $stmtRx->bindParam(':route', $route);
            $stmtRx->bindParam(':frequency', $frequency);
            $stmtRx->bindParam(':duration', $duration);
            $stmtRx->bindParam(':instructions', $instructions);
            $stmtRx->bindParam(':timeToTake', $timeToTake);
            $stmtRx->bindParam(':startDate', $startDate);
            $stmtRx->bindParam(':endDate', $endDate);

            foreach ($input['prescriptions'] as $p) {
                if (!empty($p['medication_id']) && (!empty($p['dosage']) || !empty($p['frequency']))) {
                    $medId = (int)$p['medication_id'];
                    $stmtMedLookup->execute();
                    $medRow = $stmtMedLookup->fetch(PDO::FETCH_ASSOC);
                    $medName = $medRow['name'] ?? (trim((string)($p['medication_name'] ?? '')) ?: null);
                    $medGeneric = $medRow['generic_name'] ?? (trim((string)($p['generic_name'] ?? '')) ?: null);

                    $strength = trim((string)($p['strength'] ?? '')) ?: null;
                    $dosage = trim((string)($p['dosage'] ?? '')) ?: 'As directed';
                    $route = trim((string)($p['route'] ?? '')) ?: null;
                    $frequency = trim((string)($p['frequency'] ?? '')) ?: 'As directed';
                    $duration = trim((string)($p['duration'] ?? '')) ?: null;
                    $instructions = trim((string)($p['instructions'] ?? '')) ?: null;
                    $timeToTake = trim((string)($p['time_to_take'] ?? '')) ?: null;
                    $startDate = !empty($p['start_date']) ? $p['start_date'] : date('Y-m-d');
                    $endDate = !empty($p['end_date']) ? $p['end_date'] : null;

                    $stmtRx->execute();
                }
            }
        }

        // 4. Replace Lab Requests
        $delLab = $pdo->prepare("DELETE FROM lab_requests WHERE consultation_id = :consId");
        $delLab->bindParam(':consId', $consultationId, PDO::PARAM_INT);
        $delLab->execute();

        if (!empty($input['lab_requests']) && is_array($input['lab_requests'])) {
            $testName = '';
            $reqDate = date('Y-m-d');
            $stmtLab = $pdo->prepare("INSERT INTO lab_requests (consultation_id, test_name, request_date, status) VALUES (:consId, :testName, :reqDate, 'requested')");
            $stmtLab->bindParam(':consId', $consultationId, PDO::PARAM_INT);
            $stmtLab->bindParam(':testName', $testName);
            $stmtLab->bindParam(':reqDate', $reqDate);

            foreach ($input['lab_requests'] as $l) {
                $testName = trim($l['test_name'] ?? '');
                if ($testName !== '') {
                    $reqDate = !empty($l['request_date']) ? $l['request_date'] : date('Y-m-d');
                    $stmtLab->execute();
                }
            }
        }

        // 5. Update patient allergy confirmation if provided
        if (isset($input['allergies_alerts'])) {
            $allergies = trim((string)$input['allergies_alerts']) ?: null;
            $patId = (int)$appt['patient_id'];
            $updPat = $pdo->prepare("UPDATE patients SET allergies_alerts = :allergies, allergies_confirmed_by_doctor = 1 WHERE patient_id = :patId");
            $updPat->bindParam(':allergies', $allergies);
            $updPat->bindParam(':patId', $patId, PDO::PARAM_INT);
            $updPat->execute();
            syncPatientAllergies($pdo, $patId, $allergies);
        }

        // 6. Complete appointment
        $compAppt = $pdo->prepare("UPDATE appointments SET status = 'completed' WHERE appointment_id = :appointmentId");
        $compAppt->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
        $compAppt->execute();

        $isConsUpdate = !empty($existingCons);
        $consAction = $isConsUpdate ? 'UPDATE_CONSULTATION' : 'SAVE_CONSULTATION';
        log_audit($pdo, $authUserId, $consAction, 'consultation', $consultationId, $isConsUpdate ? ['consultation_id' => $consultationId] : null, [
            'consultation_id' => $consultationId,
            'appointment_id' => $appointmentId,
            'patient_id' => (int)$appt['patient_id'],
            'doctor_id' => (int)$appt['doctor_id'],
            'diagnoses_count' => count($input['diagnoses'] ?? []),
            'prescriptions_count' => count($input['prescriptions'] ?? []),
            'lab_requests_count' => count($input['lab_requests'] ?? [])
        ]);

        log_audit($pdo, $authUserId, 'COMPLETE_CONSULTATION', 'appointment', $appointmentId, [
            'status' => $appt['status']
        ], [
            'status' => 'completed',
            'consultation_id' => $consultationId,
            'patient_id' => (int)$appt['patient_id'],
            'doctor_id' => (int)$appt['doctor_id'],
            'diagnoses_count' => count($input['diagnoses'] ?? []),
            'prescriptions_count' => count($input['prescriptions'] ?? []),
            'lab_requests_count' => count($input['lab_requests'] ?? [])
        ]);

        $pdo->commit();
        send_success('Consultation saved successfully.', [
            'consultation_id' => (int)$consultationId,
            'appointment_id'  => $appointmentId
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function saveConsultationAddendum(PDO $pdo): void {
    $authUser = get_auth_user();
    $authUserId = (int)$authUser['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['appointment_id']) || empty(trim($input['notes'] ?? ''))) {
        send_error('appointment_id and addendum notes are required.', [], 400);
    }

    $appointmentId = (int)$input['appointment_id'];
    $notes = trim($input['notes']);

    $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = :userId LIMIT 1");
    $stmtDoc->bindParam(':userId', $authUserId, PDO::PARAM_INT);
    $stmtDoc->execute();
    $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }
    $doctorId = (int)$doc['doctor_id'];

    $stmtAppt = $pdo->prepare("SELECT a.appointment_id, a.patient_id, a.doctor_id, a.status, c.consultation_id
                               FROM appointments a
                               LEFT JOIN consultation c ON a.appointment_id = c.appointment_id
                               WHERE a.appointment_id = :appointmentId");
    $stmtAppt->bindParam(':appointmentId', $appointmentId, PDO::PARAM_INT);
    $stmtAppt->execute();
    $appt = $stmtAppt->fetch(PDO::FETCH_ASSOC);

    if (!$appt || $appt['doctor_id'] != $doctorId) {
        send_error('Unauthorized access to this appointment.', [], 403);
    }

    if ($appt['status'] !== 'completed' || empty($appt['consultation_id'])) {
        send_error('Addenda can only be appended to completed encounters with recorded consultations.', [], 409);
    }

    $consultationId = (int)$appt['consultation_id'];

    $stmtAdd = $pdo->prepare("INSERT INTO consultation_addenda (consultation_id, doctor_id, notes, created_at) VALUES (:consId, :docId, :notes, NOW())");
    $stmtAdd->bindParam(':consId', $consultationId, PDO::PARAM_INT);
    $stmtAdd->bindParam(':docId', $doctorId, PDO::PARAM_INT);
    $stmtAdd->bindParam(':notes', $notes);
    $stmtAdd->execute();
    $addendumId = (int)$pdo->lastInsertId();

    log_audit($pdo, $authUserId, 'ADD_ENCOUNTER_ADDENDUM', 'consultation', $consultationId, null, [
        'addendum_id' => $addendumId,
        'appointment_id' => $appointmentId,
        'patient_id' => (int)$appt['patient_id'],
        'doctor_id' => $doctorId
    ], $notes);

    send_success('Addendum appended to encounter successfully.', [
        'addendum_id'     => $addendumId,
        'consultation_id' => $consultationId
    ], 201);
}

