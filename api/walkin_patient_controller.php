<?php
// api/walkin_patient_controller.php
// Narrowly scoped endpoint for Receptionists to register walk-in patients.
// POST only: creates a single patient record, checks for duplicates, and returns its patient_id.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_insert_records (Parameterized patient creation)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';
require_once __DIR__ . '/../includes/patient_validation.php';

require_login();
require_role(['Receptionist']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method !== 'POST') {
    send_error('Method not allowed.', [], 405);
}

$input = get_json_input();
if (empty($input)) {
    $input = $_POST;
}

$firstName     = trim($input['first_name'] ?? '');
$middleInitial = trim($input['middle_initial'] ?? '') ?: null;
$lastName      = trim($input['last_name'] ?? '');
$gender        = trim($input['gender'] ?? 'unknown');
$dob           = trim($input['date_of_birth'] ?? '');
$contactNo     = trim($input['contact_no'] ?? '') ?: null;
$address       = trim($input['address'] ?? '') ?: null;
$allergies     = trim($input['allergies_alerts'] ?? '') ?: null;

$cleanInput = [
    'first_name'     => $firstName,
    'middle_initial' => $middleInitial,
    'last_name'      => $lastName,
    'gender'         => $gender,
    'date_of_birth'  => $dob,
    'contact_no'     => $contactNo,
    'address'        => $address,
    'allergies_alerts' => $allergies
];

$errors = validatePatientInput($cleanInput);

if ($contactNo === '' || $contactNo === null) {
    $errors['contact_no'] = 'Contact number is required for walk-in registration.';
}

if ($middleInitial !== null && !preg_match('/^[A-Za-z]$/', $middleInitial)) {
    $errors['middle_initial'] = 'Middle initial must be a single letter (A-Z).';
}

if (!empty($errors)) {
    send_error('Validation failed.', $errors, 422);
}

try {
    // Duplicate check on registration
    $dupSql = "SELECT patient_id, first_name, last_name, date_of_birth, contact_no
               FROM patients
               WHERE deleted_at IS NULL
                 AND ((first_name = ? AND last_name = ? AND date_of_birth = ?)
                      OR (contact_no = ? AND contact_no IS NOT NULL AND contact_no != ''))
               LIMIT 1";
    $dupStmt = $pdo->prepare($dupSql);
    $dupStmt->execute([$firstName, $lastName, $dob, $contactNo]);
    $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        $patCode = 'PAT-' . str_pad((string)$existing['patient_id'], 4, '0', STR_PAD_LEFT);
        send_error(
            "A patient record for '{$existing['first_name']} {$existing['last_name']}' already exists ({$patCode}). Please select the existing patient from the directory.",
            ['duplicate' => $existing],
            409
        );
    }

    $stmt = $pdo->prepare(
        "INSERT INTO patients (first_name, middle_initial, last_name, gender, date_of_birth, contact_no, address, allergies_alerts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $firstName,
        $middleInitial,
        $lastName,
        $gender,
        $dob,
        $contactNo,
        $address,
        $allergies
    ]);

    $newId = (int)$pdo->lastInsertId();
    log_audit($pdo, (int)$_SESSION['user_id'], 'REGISTER_WALKIN', 'patient', $newId, null, $cleanInput);

    send_success('Patient record created successfully.', ['patient_id' => $newId], 201);
} catch (PDOException $e) {
    error_log('Walk-in patient controller DB error: ' . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
}

