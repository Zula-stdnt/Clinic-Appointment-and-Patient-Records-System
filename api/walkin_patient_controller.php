<?php
// api/walkin_patient_controller.php
// Narrowly scoped endpoint for Receptionists to register walk-in patients.
// POST only: creates a single patient record and returns its patient_id.
// Patient listing/viewing/editing/archiving/deletion remain Administrator-only in api/patient_controller.php.
//
// Duplicate policy: the project has no approved patient-matching/merge rule, so this endpoint does
// NOT reject or merge records that look alike. Accidental double submissions are prevented in the UI
// (the submit button is locked while a request is pending). A retry after an uncertain network failure
// can still create a second record; the UI tells the user to check the patient list before retrying.

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/patient_validation.php';

require_login();
require_role(['Administrator', 'Receptionist']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method !== 'POST') {
    send_error('Method not allowed.', [], 405);
}

$input = get_json_input();
if (empty($input)) {
    $input = $_POST;
}

$errors = validatePatientInput($input);
$contactNo = trim($input['contact_no'] ?? '');
if ($contactNo === '') {
    $errors['contact_no'] = 'Contact number is required for walk-in registration.';
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
        "INSERT INTO patients (first_name, middle_initial, last_name, gender, date_of_birth, contact_no, address)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        trim($input['first_name']),
        trim($input['middle_initial'] ?? '') ?: null,
        trim($input['last_name']),
        trim($input['gender']),
        trim($input['date_of_birth']),
        trim($input['contact_no'] ?? '') ?: null,
        trim($input['address'] ?? '') ?: null
    ]);

    $newId = (int)$pdo->lastInsertId();
    send_success('Patient record created successfully.', ['patient_id' => $newId], 201);
} catch (PDOException $e) {
    error_log('Walk-in patient controller DB error: ' . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
}
