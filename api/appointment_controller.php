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
    
    // Base query
    $sql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                   a.chief_complaint, a.status, 
                   p.patient_id, p.first_name as patient_first, p.last_name as patient_last,
                   u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, d.doctor_id,
                   v.blood_pressure, v.temperature, v.oxygen_saturation
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.patient_id
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u_doc ON d.user_id = u_doc.user_id
            LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
            WHERE 1=1";
    
    $params = [];
    
    // If doctor, restrict to their appointments
    if ($authUser['role_name'] === 'Doctor') {
        // Find this user's doctor_id
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $stmtDoc->execute([$authUser['user_id']]);
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
        
        if (!$doc) {
            send_success('No appointments found', ['items' => []]);
            return;
        }
        
        $sql .= " AND a.doctor_id = ?";
        $params[] = $doc['doctor_id'];
    }

    $sql .= " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Appointments retrieved', ['items' => $results]);
}

function getAppointmentById(PDO $pdo, int $id) {
    // Full joined record used by the printable Patient Registration & Appointment Form
    $authUser = get_auth_user();

    $sql = "SELECT a.appointment_id, a.patient_id, a.doctor_id, a.created_by, 
                   a.appointment_date, a.appointment_time, a.chief_complaint, a.status, a.created_at,
                   p.first_name as patient_first, p.last_name as patient_last, p.middle_initial as patient_middle,
                   p.gender as patient_gender, p.date_of_birth, p.contact_no, p.address, p.created_at as patient_created_at,
                   u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, u_doc.middle_initial as doctor_middle,
                   (SELECT GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ')
                      FROM doctor_specialty ds
                      INNER JOIN specialties s ON ds.specialty_id = s.specialty_id
                     WHERE ds.doctor_id = d.doctor_id) AS doctor_specialties,
                   v.blood_pressure, v.temperature, v.oxygen_saturation
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.patient_id
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u_doc ON d.user_id = u_doc.user_id
            LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
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

// Type-ahead data for the booking form: active patients only.
// Supports ?search= so the picker never has to load/scroll the full table.
function listPatientOptions(PDO $pdo): void {
    $search = trim($_GET['search'] ?? '');
    $sql = "SELECT patient_id, first_name, last_name, middle_initial, date_of_birth
            FROM patients
            WHERE deleted_at IS NULL";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (first_name LIKE :s1 OR last_name LIKE :s2
                       OR CONCAT(first_name, ' ', last_name) LIKE :s3
                       OR contact_no LIKE :s4)";
        $params[':s1'] = '%' . $search . '%';
        $params[':s2'] = '%' . $search . '%';
        $params[':s3'] = '%' . $search . '%';
        $params[':s4'] = '%' . $search . '%';
    }

    $sql .= " ORDER BY last_name ASC, first_name ASC LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    send_success('Patient options retrieved.', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// Type-ahead data for the booking form: active doctors with their specialties.
// Supports ?search= across name and specialty so users can jump straight to a doctor.
function listDoctorOptions(PDO $pdo): void {
    $search = trim($_GET['search'] ?? '');
    $params = [];

    $sql = "SELECT d.doctor_id, u.first_name, u.last_name, u.middle_initial,
                   GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS specialty_names
            FROM doctors d
            LEFT JOIN users u ON d.user_id = u.user_id
            LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
            WHERE d.deleted_at IS NULL";

    if ($search !== '') {
        $sql .= " AND (u.first_name LIKE :s1 OR u.last_name LIKE :s2
                       OR CONCAT(u.first_name, ' ', u.last_name) LIKE :s3
                       OR EXISTS (
                           SELECT 1 FROM doctor_specialty ds2
                           INNER JOIN specialties s2 ON ds2.specialty_id = s2.specialty_id
                           WHERE ds2.doctor_id = d.doctor_id AND s2.specialty_name LIKE :s4
                       ))";
        $params[':s1'] = '%' . $search . '%';
        $params[':s2'] = '%' . $search . '%';
        $params[':s3'] = '%' . $search . '%';
        $params[':s4'] = '%' . $search . '%';
    }

    $sql .= " GROUP BY d.doctor_id, u.first_name, u.last_name, u.middle_initial
              ORDER BY u.last_name ASC, u.first_name ASC
              LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
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
    }

    $timeObj = DateTime::createFromFormat('H:i', $appointmentTime)
        ?: DateTime::createFromFormat('H:i:s', $appointmentTime);
    if (!$timeObj) {
        $errors['appointment_time'] = 'A valid appointment time is required.';
    }
    $normalizedTime = $timeObj ? $timeObj->format('H:i:s') : '';

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

    // Prevent double booking: same doctor, same date and time, still active
    $dupStmt = $pdo->prepare(
        "SELECT appointment_id FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
           AND status IN ('scheduled', 'confirmed')
         LIMIT 1"
    );
    $dupStmt->execute([$doctorId, $appointmentDate, $normalizedTime]);
    if ($dupStmt->fetch()) {
        send_error('The doctor already has an active appointment at that date and time.', [], 409);
    }

    $pdo->beginTransaction();

    try {
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
        send_success('Appointment scheduled successfully.', ['appointment_id' => $appointmentId], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
