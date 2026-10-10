<?php
// api/appointment_patient_controller.php
// Narrowly scoped endpoint for Receptionists to edit an existing patient's details
// ONLY if the patient is linked to a specified active appointment.
require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/patient_validation.php';

require_login();
require_role(['Administrator', 'Receptionist']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$appointmentId = (int)($_GET['appointment_id'] ?? 0);
if ($appointmentId <= 0) {
    send_error('Missing or invalid appointment ID.', [], 400);
}

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT p.patient_id, p.first_name, p.middle_initial, p.last_name, p.gender, p.date_of_birth, p.contact_no, p.address, a.status as appt_status 
                           FROM patients p 
                           INNER JOIN appointments a ON p.patient_id = a.patient_id 
                           WHERE a.appointment_id = ?");
    $stmt->execute([$appointmentId]);
    $pat = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$pat) {
        send_error('Patient or appointment not found.', [], 404);
    }
    send_success('Patient retrieved.', $pat);
}

if ($method !== 'PUT') {
    send_error('Method not allowed.', [], 405);
}

// 1. Verify the appointment exists, is not in a terminal state, and fetch the linked patient_id
$stmt = $pdo->prepare("SELECT patient_id, status FROM appointments WHERE appointment_id = ?");
$stmt->execute([$appointmentId]);
$appt = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$appt) {
    send_error('Appointment not found.', [], 404);
}

if (in_array($appt['status'], ['completed', 'cancelled', 'no_show'])) {
    send_error('Cannot edit patient details for a terminal appointment.', [], 403);
}

$patientId = (int)$appt['patient_id'];

$input = get_json_input();
if (empty($input)) {
    parse_str(file_get_contents('php://input'), $input);
}

$errors = validatePatientInput($input);
$contactNo = trim($input['contact_no'] ?? '');
if ($contactNo === '') {
    $errors['contact_no'] = 'Contact number is required for patient updates.';
}

$middleInitial = trim($input['middle_initial'] ?? '');
if ($middleInitial !== '' && !preg_match('/^[A-Za-z]$/', $middleInitial)) {
    $errors['middle_initial'] = 'Middle initial must be a single letter (A-Z).';
}

if (!empty($errors)) {
    send_error('Validation failed.', $errors, 422);
}

try {
    $stmt = $pdo->prepare(
        "UPDATE patients SET first_name = ?, middle_initial = ?, last_name = ?, gender = ?, date_of_birth = ?, contact_no = ?, address = ?
         WHERE patient_id = ?"
    );
    $stmt->execute([
        trim($input['first_name']),
        trim($input['middle_initial'] ?? '') ?: null,
        trim($input['last_name']),
        trim($input['gender']),
        trim($input['date_of_birth']),
        trim($input['contact_no'] ?? '') ?: null,
        trim($input['address'] ?? '') ?: null,
        $patientId
    ]);

    send_success('Patient details updated successfully.', ['patient_id' => $patientId]);
} catch (PDOException $e) {
    error_log('Appointment patient controller DB error: ' . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
}
