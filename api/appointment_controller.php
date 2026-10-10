<?php
// api/appointment_controller.php
// Master CRUD for Appointments
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records & mysql_retrieve_specific_record (INNER JOIN relational retrieval and parameterized primary-key lookup)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Administrator', 'Receptionist', 'Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        if (isset($_GET['meta'])) {
            $meta = $_GET['meta'];
            if ($meta === 'patients') {
                listPatientOptions($pdo);
            } elseif ($meta === 'doctors') {
                listDoctorOptions($pdo);
            } else {
                send_error('Unknown meta resource.', [], 400);
            }
        } elseif (isset($_GET['id'])) {
            getAppointmentById($pdo, (int)$_GET['id']);
        } else {
            listAppointments($pdo);
        }
    } elseif ($method === 'POST') {
        createAppointment($pdo);
    } elseif ($method === 'PUT') {
        if (!isset($_GET['id'])) {
            send_error('Appointment ID is required.', [], 400);
        }
        updateAppointment($pdo, (int)$_GET['id']);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in appointment_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', ['details' => $e->getMessage()], 500);
} catch (Exception $e) {
    error_log("General Error in appointment_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function listAppointments(PDO $pdo) {
    $authUser = get_auth_user();
    
    $where = ['1=1'];
    $params = [];
    
    // If doctor, restrict to their appointments
    if ($authUser['role_name'] === 'Doctor') {
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $stmtDoc->execute([$authUser['user_id']]);
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
        
        if (!$doc) {
            send_success('No appointments found', [
                'items' => [],
                'total' => 0,
                'page' => 1,
                'page_size' => 10,
                'pages' => 1
            ]);
            return;
        }
        
        $where[] = "a.doctor_id = :auth_doctor_id";
        $params[':auth_doctor_id'] = $doc['doctor_id'];
    }

    $status = trim($_GET['status'] ?? '');
    if ($status !== '' && in_array($status, ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'], true)) {
        $where[] = "a.status = :status";
        $params[':status'] = $status;
    }

    $search = trim($_GET['search'] ?? '');
    if ($search !== '') {
        $where[] = "(p.first_name LIKE :search1 OR p.last_name LIKE :search2 OR u_doc.first_name LIKE :search3 OR u_doc.last_name LIKE :search4 OR a.chief_complaint LIKE :search5)";
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
        $params[':search4'] = '%' . $search . '%';
        $params[':search5'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);
    $isPaginated = isset($_GET['page']) || isset($_GET['page_size']);

    if ($isPaginated) {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
        $offset = ($page - 1) * $pageSize;

        // Total count
        $countSql = "SELECT COUNT(*) 
                     FROM appointments a
                     INNER JOIN patients p ON a.patient_id = p.patient_id
                     INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                     INNER JOIN users u_doc ON d.user_id = u_doc.user_id
                     WHERE {$whereSql}";
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $k => $v) {
            $countStmt->bindValue($k, $v);
        }
        $countStmt->execute();
        $total = (int)$countStmt->fetchColumn();
        $pages = $total > 0 ? (int)ceil($total / $pageSize) : 1;

        $sort = trim($_GET['sort'] ?? '');
        $useUpcomingSort = ($sort === 'upcoming') || ($authUser['role_name'] === 'Doctor' && $sort !== 'desc');
        
        $dataParams = $params;
        if ($useUpcomingSort) {
            $clinicNow = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d H:i:s');
            $dataParams[':clinic_now1'] = $clinicNow;
            $dataParams[':clinic_now2'] = $clinicNow;
            $orderSql = "ORDER BY 
                CASE 
                    WHEN a.status IN ('scheduled', 'confirmed') AND CONCAT(a.appointment_date, ' ', a.appointment_time) >= :clinic_now1 THEN 0
                    ELSE 1
                END ASC,
                CASE 
                    WHEN a.status IN ('scheduled', 'confirmed') AND CONCAT(a.appointment_date, ' ', a.appointment_time) >= :clinic_now2 
                        THEN CONCAT(a.appointment_date, ' ', a.appointment_time)
                END ASC,
                a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC";
        } else {
            $orderSql = "ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC";
        }

        // Paginated query
        $dataSql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                           a.chief_complaint, a.status, 
                           p.patient_id, p.first_name as patient_first, p.last_name as patient_last,
                           (p.deleted_at IS NOT NULL) as patient_archived,
                           u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, d.doctor_id,
                           (d.deleted_at IS NOT NULL) as doctor_archived,
                           v.blood_pressure, v.temperature, v.oxygen_saturation
                    FROM appointments a
                    INNER JOIN patients p ON a.patient_id = p.patient_id
                    INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                    INNER JOIN users u_doc ON d.user_id = u_doc.user_id
                    LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
                    WHERE {$whereSql}
                    {$orderSql}
                    LIMIT :page_size OFFSET :offset";

        $stmt = $pdo->prepare($dataSql);
        foreach ($dataParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':page_size', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        send_success('Appointments retrieved', [
            'items' => $results,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'pages' => $pages
        ]);
    } else {
        // Non-paginated fallback for backward-compatible consumers
        $dataSql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                           a.chief_complaint, a.status, 
                           p.patient_id, p.first_name as patient_first, p.last_name as patient_last,
                           (p.deleted_at IS NOT NULL) as patient_archived,
                           u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, d.doctor_id,
                           (d.deleted_at IS NOT NULL) as doctor_archived,
                           v.blood_pressure, v.temperature, v.oxygen_saturation
                    FROM appointments a
                    INNER JOIN patients p ON a.patient_id = p.patient_id
                    INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                    INNER JOIN users u_doc ON d.user_id = u_doc.user_id
                    LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
                    WHERE {$whereSql}
                    ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC";

        $stmt = $pdo->prepare($dataSql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $total = count($results);

        send_success('Appointments retrieved', [
            'items' => $results,
            'total' => $total,
            'page' => 1,
            'page_size' => $total,
            'pages' => 1
        ]);
    }
}

function getAppointmentById(PDO $pdo, int $id) {
    // Similar joins as list
    $authUser = get_auth_user();

    $sql = "SELECT a.appointment_id, a.patient_id, a.doctor_id, a.created_by, 
                   a.appointment_date, a.appointment_time, a.chief_complaint, a.status,
                   p.first_name as patient_first, p.last_name as patient_last,
                   u_doc.first_name as doctor_first, u_doc.last_name as doctor_last
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.patient_id
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u_doc ON d.user_id = u_doc.user_id
            WHERE a.appointment_id = ?";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

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

    send_success('Appointment retrieved', ['item' => $appointment]);
}

// Dropdown data for the booking form: active patients only
function listPatientOptions(PDO $pdo): void {
    $search = trim($_GET['search'] ?? '');
    $sql = "SELECT patient_id, first_name, last_name, middle_initial, date_of_birth
            FROM patients
            WHERE deleted_at IS NULL";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (first_name LIKE :s1 OR last_name LIKE :s2 OR contact_no LIKE :s3)";
        $params[':s1'] = '%' . $search . '%';
        $params[':s2'] = '%' . $search . '%';
        $params[':s3'] = '%' . $search . '%';
    }

    $sql .= " ORDER BY last_name ASC, first_name ASC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    send_success('Patient options retrieved.', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// Dropdown data for the booking form: active doctors with their specialties
function listDoctorOptions(PDO $pdo): void {
    $sql = "SELECT d.doctor_id, u.first_name, u.last_name, u.middle_initial,
                   GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS specialty_names
            FROM doctors d
            LEFT JOIN users u ON d.user_id = u.user_id
            LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
            WHERE d.deleted_at IS NULL
            GROUP BY d.doctor_id, u.first_name, u.last_name, u.middle_initial
            ORDER BY u.last_name ASC, u.first_name ASC
            LIMIT 200";

    $stmt = $pdo->query($sql);
    send_success('Doctor options retrieved.', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// Header-detail save: one appointment header plus optional triage vital sign row
function createAppointment(PDO $pdo): void {
    $authUser = get_auth_user();
    $input = get_json_input();

    $patientId       = (int)($input['patient_id'] ?? 0);
    $doctorId        = (int)($input['doctor_id'] ?? 0);
    $appointmentDate = trim($input['appointment_date'] ?? '');
    $appointmentTime = trim($input['appointment_time'] ?? '');
    $chiefComplaint  = trim($input['chief_complaint'] ?? '');
    $bloodPressure   = trim($input['blood_pressure'] ?? '');
    $temperature     = trim((string)($input['temperature'] ?? ''));
    $oxygenSat       = trim((string)($input['oxygen_saturation'] ?? ''));

    $errors = [];

    if ($patientId <= 0) {
        $errors['patient_id'] = 'Please choose a patient.';
    }
    if ($doctorId <= 0) {
        $errors['doctor_id'] = 'Please choose a doctor.';
    }

    $dateObj = DateTime::createFromFormat('Y-m-d', $appointmentDate);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $appointmentDate) {
        $errors['appointment_date'] = 'A valid appointment date is required.';
    } else {
        $dayOfWeek = (int)$dateObj->format('w');
        if ($dayOfWeek === 0) {
            $errors['appointment_date'] = 'The clinic is closed on Sundays.';
        }
    }

    $timeObj = DateTime::createFromFormat('H:i', $appointmentTime)
        ?: DateTime::createFromFormat('H:i:s', $appointmentTime);
    if (!$timeObj) {
        $errors['appointment_time'] = 'A valid appointment time is required.';
    } else {
        $normalizedTime = $timeObj->format('H:i:s');
        if ($normalizedTime < '08:00:00' || $normalizedTime > '17:00:00') {
            $errors['appointment_time'] = 'Appointments can only be scheduled between 08:00 and 17:00.';
        } elseif ((int)$timeObj->format('H') === 12) {
            $errors['appointment_time'] = 'The clinic is closed for lunch between 12:00 and 12:59.';
        }
    }

    if ($bloodPressure !== '' && mb_strlen($bloodPressure) > 20) {
        $errors['blood_pressure'] = 'Blood pressure must be 20 characters or fewer.';
    }
    if ($temperature !== '' && (!is_numeric($temperature) || (float)$temperature < 30 || (float)$temperature > 45)) {
        $errors['temperature'] = 'Temperature must be a number between 30 and 45 °C.';
    }
    if ($oxygenSat !== '' && (!is_numeric($oxygenSat) || (float)$oxygenSat < 0 || (float)$oxygenSat > 100)) {
        $errors['oxygen_saturation'] = 'Oxygen saturation must be a number between 0 and 100.';
    }

    if (!empty($errors)) {
        send_error('Please correct the highlighted fields.', $errors, 422);
    }

    // Verify the selected patient and doctor are active records
    $pStmt = $pdo->prepare("SELECT patient_id FROM patients WHERE patient_id = ? AND deleted_at IS NULL LIMIT 1");
    $pStmt->execute([$patientId]);
    if (!$pStmt->fetch()) {
        send_error('The selected patient is not available.', ['patient_id' => 'Patient not found or archived.'], 422);
    }

    $dStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? AND deleted_at IS NULL LIMIT 1");
    $dStmt->execute([$doctorId]);
    if (!$dStmt->fetch()) {
        send_error('The selected doctor is not available.', ['doctor_id' => 'Doctor not found or archived.'], 422);
    }

    $pdo->beginTransaction();

    try {
        // Concurrency lock: serialize bookings for this doctor
        $lockDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? FOR UPDATE");
        $lockDoc->execute([$doctorId]);

        // Prevent double booking: same doctor, same date and time, still active
        $dupStmt = $pdo->prepare(
            "SELECT appointment_id FROM appointments
             WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
               AND status IN ('scheduled', 'confirmed')
             LIMIT 1"
        );
        $dupStmt->execute([$doctorId, $appointmentDate, $normalizedTime]);
        if ($dupStmt->fetch()) {
            $pdo->rollBack();
            send_error('The doctor already has an active appointment at that date and time.', [], 409);
        }

        // Daily clinic capacity check (max 10 active appointments clinic-wide per date)
        $capStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM appointments
             WHERE appointment_date = ?
               AND status IN ('scheduled', 'confirmed')"
        );
        $capStmt->execute([$appointmentDate]);
        $currentCount = (int)$capStmt->fetchColumn();

        if ($currentCount >= 10) {
            $pdo->rollBack();
            send_error('Daily clinic capacity reached (10 appointments max).', [], 409);
        }

        $stmt = $pdo->prepare(
            "INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status)
             VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
        );
        $stmt->execute([
            $patientId,
            $doctorId,
            $authUser['user_id'],
            $appointmentDate,
            $normalizedTime,
            $chiefComplaint !== '' ? $chiefComplaint : null
        ]);
        $appointmentId = (int)$pdo->lastInsertId();

        $newCount = $currentCount + 1;
        $warning = null;
        if ($newCount >= 8 && $newCount <= 10) {
            $warning = "Clinic is near capacity ({$newCount} appointments today).";
        }

        // Triage vitals are optional; save them on the same visit row when provided
        if ($bloodPressure !== '' || $temperature !== '' || $oxygenSat !== '') {
            $vStmt = $pdo->prepare(
                "INSERT INTO vital_signs (appointment_id, blood_pressure, temperature, oxygen_saturation)
                 VALUES (?, ?, ?, ?)"
            );
            $vStmt->execute([
                $appointmentId,
                $bloodPressure !== '' ? $bloodPressure : null,
                $temperature !== '' ? (float)$temperature : null,
                $oxygenSat !== '' ? (float)$oxygenSat : null
            ]);
        }

        $pdo->commit();
        $resData = ['appointment_id' => $appointmentId];
        if ($warning !== null) {
            $resData['warning'] = $warning;
        }
        send_success('Appointment scheduled successfully.', $resData, 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function updateAppointment(PDO $pdo, int $appointmentId): void {
    $authUser = get_auth_user();
    
    // Doctors cannot edit or change status of appointments via this endpoint.
    if ($authUser['role_name'] === 'Doctor') {
        send_error('Doctors are not permitted to edit appointments. Please use the Consultation workspace.', [], 403);
    }

    $input = get_json_input();
    
    $patientId = (int)($input['patient_id'] ?? 0);
    $doctorId = (int)($input['doctor_id'] ?? 0);
    
    if ($patientId <= 0) send_error('Please choose a patient.', [], 422);
    if ($doctorId <= 0) send_error('Please choose a doctor.', [], 422);

    $pdo->beginTransaction();

    try {
        // Consistent lock order: lock target doctor first (prevents double booking races)
        $lockDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? FOR UPDATE");
        $lockDoc->execute([$doctorId]);
        
        // Then lock the appointment row (prevents stale writes and concurrent status changes)
        $lockAppt = $pdo->prepare("SELECT * FROM appointments WHERE appointment_id = ? FOR UPDATE");
        $lockAppt->execute([$appointmentId]);
        $lockedAppt = $lockAppt->fetch(PDO::FETCH_ASSOC);
        
        if (!$lockedAppt) {
            $pdo->rollBack();
            send_error('Appointment not found.', [], 404);
        }

        // Terminal statuses cannot be edited.
        if (in_array($lockedAppt['status'], ['completed', 'cancelled', 'no_show'])) {
            $pdo->rollBack();
            send_error("Cannot modify an appointment that is already " . $lockedAppt['status'] . ".", [], 409);
        }

        // Derive remaining values from authoritative locked row
        $appointmentDate = isset($input['appointment_date']) ? trim($input['appointment_date']) : $lockedAppt['appointment_date'];
        $appointmentTime = isset($input['appointment_time']) ? trim($input['appointment_time']) : $lockedAppt['appointment_time'];
        $chiefComplaint  = isset($input['chief_complaint']) ? trim($input['chief_complaint']) : $lockedAppt['chief_complaint'];
        $status          = isset($input['status']) ? trim($input['status']) : $lockedAppt['status'];
        
        $updateVitals = false;
        $bloodPressure = null;
        $temperature = null;
        $oxygenSat = null;

        if (array_key_exists('blood_pressure', $input) || array_key_exists('temperature', $input) || array_key_exists('oxygen_saturation', $input)) {
            $updateVitals = true;
            $bloodPressure = isset($input['blood_pressure']) ? trim($input['blood_pressure']) : '';
            $temperature = isset($input['temperature']) ? trim((string)$input['temperature']) : '';
            $oxygenSat = isset($input['oxygen_saturation']) ? trim((string)$input['oxygen_saturation']) : '';
        }

        $errors = [];

        if ($patientId <= 0) $errors['patient_id'] = 'Please choose a patient.';
        if ($doctorId <= 0) $errors['doctor_id'] = 'Please choose a doctor.';

        $dateObj = DateTime::createFromFormat('Y-m-d', $appointmentDate);
        if (!$dateObj || $dateObj->format('Y-m-d') !== $appointmentDate) {
            $errors['appointment_date'] = 'A valid appointment date is required.';
        } elseif (in_array($status, ['scheduled', 'confirmed'])) {
            $dayOfWeek = (int)$dateObj->format('w');
            if ($dayOfWeek === 0) {
                $errors['appointment_date'] = 'The clinic is closed on Sundays.';
            }
        }

        $timeObj = DateTime::createFromFormat('H:i', $appointmentTime) ?: DateTime::createFromFormat('H:i:s', $appointmentTime);
        if (!$timeObj) {
            $errors['appointment_time'] = 'A valid appointment time is required.';
        } else {
            $normalizedTime = $timeObj->format('H:i:s');
            if (in_array($status, ['scheduled', 'confirmed'])) {
                if ($normalizedTime < '08:00:00' || $normalizedTime > '17:00:00') {
                    $errors['appointment_time'] = 'Appointments can only be scheduled between 08:00 and 17:00.';
                } elseif ((int)$timeObj->format('H') === 12) {
                    $errors['appointment_time'] = 'The clinic is closed for lunch between 12:00 and 12:59.';
                }
            }
        }

        $oldStatus = $lockedAppt['status'];
        $validTransitions = [
            'scheduled' => ['scheduled', 'confirmed', 'cancelled', 'no_show'],
            'confirmed' => ['confirmed', 'cancelled', 'no_show']
        ];
        if (!isset($validTransitions[$oldStatus]) || !in_array($status, $validTransitions[$oldStatus])) {
            $errors['status'] = "Invalid status transition from {$oldStatus} to {$status}.";
        }

        if ($updateVitals) {
            if ($bloodPressure !== '' && mb_strlen($bloodPressure) > 20) {
                $errors['blood_pressure'] = 'Blood pressure must be 20 characters or fewer.';
            }
            if ($temperature !== '' && (!is_numeric($temperature) || (float)$temperature < 30 || (float)$temperature > 45)) {
                $errors['temperature'] = 'Temperature must be a number between 30 and 45 °C.';
            }
            if ($oxygenSat !== '' && (!is_numeric($oxygenSat) || (float)$oxygenSat < 0 || (float)$oxygenSat > 100)) {
                $errors['oxygen_saturation'] = 'Oxygen saturation must be a number between 0 and 100.';
            }
        }

        if (!empty($errors)) {
            $pdo->rollBack();
            send_error('Please correct the highlighted fields.', $errors, 422);
        }

        // Validate FKs, allowing the existing IDs to be preserved even if they are now archived
        $pStmt = $pdo->prepare("SELECT patient_id FROM patients WHERE patient_id = ? AND (deleted_at IS NULL OR patient_id = ?) LIMIT 1");
        $pStmt->execute([$patientId, $lockedAppt['patient_id']]);
        if (!$pStmt->fetch()) {
            $pdo->rollBack();
            send_error('The selected patient is not available.', ['patient_id' => 'Patient not found or archived.'], 422);
        }

        $dStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? AND (deleted_at IS NULL OR doctor_id = ?) LIMIT 1");
        $dStmt->execute([$doctorId, $lockedAppt['doctor_id']]);
        if (!$dStmt->fetch()) {
            $pdo->rollBack();
            send_error('The selected doctor is not available.', ['doctor_id' => 'Doctor not found or archived.'], 422);
        }

        $warning = null;
        // Check for double booking and capacity if status is active
        if (in_array($status, ['scheduled', 'confirmed'])) {
            $dupStmt = $pdo->prepare(
                "SELECT appointment_id FROM appointments
                 WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
                   AND status IN ('scheduled', 'confirmed')
                   AND appointment_id != ?
                 LIMIT 1"
            );
            $dupStmt->execute([$doctorId, $appointmentDate, $normalizedTime, $appointmentId]);
            if ($dupStmt->fetch()) {
                $pdo->rollBack();
                send_error('The doctor already has an active appointment at that date and time.', [], 409);
            }

            // Daily clinic capacity check (max 10 active appointments clinic-wide per date)
            $capStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM appointments
                 WHERE appointment_date = ?
                   AND status IN ('scheduled', 'confirmed')
                   AND appointment_id != ?"
            );
            $capStmt->execute([$appointmentDate, $appointmentId]);
            $currentCount = (int)$capStmt->fetchColumn();

            if ($currentCount >= 10) {
                $pdo->rollBack();
                send_error('Daily clinic capacity reached (10 appointments max).', [], 409);
            }

            $newCount = $currentCount + 1;
            if ($newCount >= 8 && $newCount <= 10) {
                $warning = "Clinic is near capacity ({$newCount} appointments today).";
            }
        }

        $stmtUpdate = $pdo->prepare(
            "UPDATE appointments SET patient_id = ?, doctor_id = ?, appointment_date = ?, appointment_time = ?, chief_complaint = ?, status = ? WHERE appointment_id = ?"
        );
        $stmtUpdate->execute([
            $patientId,
            $doctorId,
            $appointmentDate,
            $normalizedTime,
            $chiefComplaint !== '' ? $chiefComplaint : null,
            $status,
            $appointmentId
        ]);

        if ($updateVitals) {
            if ($bloodPressure === '' && $temperature === '' && $oxygenSat === '') {
                $pdo->prepare("DELETE FROM vital_signs WHERE appointment_id = ?")->execute([$appointmentId]);
            } else {
                $vCheck = $pdo->prepare("SELECT vital_sign_id FROM vital_signs WHERE appointment_id = ?");
                $vCheck->execute([$appointmentId]);
                if ($vCheck->fetch()) {
                    $vUpdate = $pdo->prepare("UPDATE vital_signs SET blood_pressure = ?, temperature = ?, oxygen_saturation = ? WHERE appointment_id = ?");
                    $vUpdate->execute([
                        $bloodPressure !== '' ? $bloodPressure : null,
                        $temperature !== '' ? (float)$temperature : null,
                        $oxygenSat !== '' ? (float)$oxygenSat : null,
                        $appointmentId
                    ]);
                } else {
                    $vInsert = $pdo->prepare("INSERT INTO vital_signs (appointment_id, blood_pressure, temperature, oxygen_saturation) VALUES (?, ?, ?, ?)");
                    $vInsert->execute([
                        $appointmentId,
                        $bloodPressure !== '' ? $bloodPressure : null,
                        $temperature !== '' ? (float)$temperature : null,
                        $oxygenSat !== '' ? (float)$oxygenSat : null
                    ]);
                }
            }
        }

        $pdo->commit();
        $resData = [];
        if ($warning !== null) {
            $resData['warning'] = $warning;
        }
        send_success('Appointment updated successfully.', $resData);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

