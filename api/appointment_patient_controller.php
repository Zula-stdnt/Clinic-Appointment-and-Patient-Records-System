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
    $stmt = $pdo->prepare("SELECT p.patient_id, p.first_name, p.middle_initial, p.last_name, p.gender, p.date_of_birth, p.contact_no, p.address, p.allergies_alerts, a.status as appt_status 
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

// Priority 1: Governance rule - Only Receptionists may edit patient demographics
if (get_current_user_role() !== 'Receptionist') {
    send_error('Only receptionists are permitted to edit patient demographics.', [], 403);
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

$oldStmt = $pdo->prepare("SELECT patient_id, first_name, middle_initial, last_name, gender, date_of_birth, contact_no, address, allergies_alerts FROM patients WHERE patient_id = ?");
$oldStmt->execute([$patientId]);
$oldPat = $oldStmt->fetch(PDO::FETCH_ASSOC);
if (!$oldPat) {
    send_error('Patient not found.', [], 404);
}

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

$firstName = trim($input['first_name'] ?? '');
$lastName  = trim($input['last_name'] ?? '');
$dob       = trim($input['date_of_birth'] ?? '');
$gender    = trim($input['gender'] ?? 'unknown');
$address   = trim($input['address'] ?? '') ?: null;
$allergiesAlerts = array_key_exists('allergies_alerts', $input) ? (trim((string)$input['allergies_alerts']) ?: null) : ($oldPat['allergies_alerts'] ?? null);

// Duplicate check against other patients
$dupStmt = $pdo->prepare(
    "SELECT patient_id, first_name, last_name, date_of_birth, contact_no
     FROM patients
     WHERE ((LOWER(TRIM(first_name)) = LOWER(?) AND LOWER(TRIM(last_name)) = LOWER(?) AND date_of_birth = ?)
        OR (? != '' AND contact_no = ?))
       AND patient_id != ?
       AND deleted_at IS NULL
     LIMIT 1"
);
$dupStmt->execute([$firstName, $lastName, $dob, $contactNo, $contactNo, $patientId]);
$dup = $dupStmt->fetch(PDO::FETCH_ASSOC);
if ($dup) {
    $formattedId = 'PAT-' . str_pad((string)$dup['patient_id'], 4, '0', STR_PAD_LEFT);
    send_error(
        "Another patient record for '{$dup['first_name']} {$dup['last_name']}' already exists ({$formattedId}). Please verify existing charts before creating a duplicate.",
        ['duplicate' => $dup],
        409
    );
}

try {
    $stmt = $pdo->prepare(
        "UPDATE patients SET first_name = ?, middle_initial = ?, last_name = ?, gender = ?, date_of_birth = ?, contact_no = ?, address = ?, allergies_alerts = ?, allergies_confirmed_by_doctor = 0
         WHERE patient_id = ?"
    );
    $stmt->execute([
        $firstName,
        $middleInitial ?: null,
        $lastName,
        $gender,
        $dob,
        $contactNo ?: null,
        $address,
        $allergiesAlerts,
        $patientId
    ]);

    // Track old vs new diff and write to audit trail
    $trackedKeys = ['first_name', 'middle_initial', 'last_name', 'gender', 'date_of_birth', 'contact_no', 'address', 'allergies_alerts'];
    $oldDiff = [];
    $newDiff = [];
    $newValues = [
        'first_name' => $firstName,
        'middle_initial' => $middleInitial ?: null,
        'last_name' => $lastName,
        'gender' => $gender,
        'date_of_birth' => $dob,
        'contact_no' => $contactNo ?: null,
        'address' => $address,
        'allergies_alerts' => $allergiesAlerts
    ];
    foreach ($trackedKeys as $k) {
        if ((string)($oldPat[$k] ?? null) !== (string)($newValues[$k] ?? null)) {
            $oldDiff[$k] = $oldPat[$k] ?? null;
            $newDiff[$k] = $newValues[$k] ?? null;
        }
    }
    if (!empty($newDiff)) {
        $reason = trim($input['reason'] ?? '') ?: 'Demographic identity update by front desk (appointment context)';
        log_audit($pdo, (int)$_SESSION['user_id'], 'EDIT_DEMOGRAPHICS', 'patient', $patientId, $oldDiff, $newDiff, $reason);
    }

    send_success('Patient details updated successfully.', ['patient_id' => $patientId]);
} catch (PDOException $e) {
    error_log('Appointment patient controller DB error: ' . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
}
