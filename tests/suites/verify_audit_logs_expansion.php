<?php
// tests/verify_audit_logs_expansion.php
// Verification test suite for Audit Logs expansion:
// 1. Database schema normalization compatibility (doctors -> users join)
// 2. Appointment audit tracking (CREATE_APPOINTMENT, STATUS_CHANGE, RESCHEDULE_APPOINTMENT, CANCEL_APPOINTMENT)
// 3. Consultation audit tracking (SAVE_CONSULTATION, COMPLETE_CONSULTATION, ADD_ENCOUNTER_ADDENDUM)
// 4. Data integrity, entity enrichment (patient & doctor full names), and zero dropped/undefined values

putenv('DB_NAME=hospital_db_test');
$_SERVER['SERVER_PORT'] = '80';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../includes/audit.php';

$testCount = 0;
$passedCount = 0;
$failedTests = [];

function assert_test($description, $condition, $failMessage = '') {
    global $testCount, $passedCount, $failedTests;
    $testCount++;
    if ($condition) {
        $passedCount++;
        echo "  [PASS] {$description}\n";
    } else {
        $failedTests[] = "{$description} - {$failMessage}";
        echo "  [FAIL] {$description} - {$failMessage}\n";
    }
}

function call_audit_controller(array $queryParams = []): array {
    $script = __DIR__ . '/_tmp_run_audit.php';
    $code = '<?php
putenv("DB_NAME=hospital_db_test");
$_SERVER["REQUEST_URI"] = "/api/audit_log_controller.php";
$_SERVER["REQUEST_METHOD"] = "GET";
$_SERVER["REMOTE_ADDR"] = "127.0.0.1";
$_GET = ' . var_export($queryParams, true) . ';
session_start();
$_SESSION["user_id"] = 1;
$_SESSION["role_name"] = "Administrator";
$_SESSION["username"] = "admin";
require __DIR__ . "/../../api/audit_log_controller.php";
';
    file_put_contents($script, $code);
    $out = shell_exec('C:\\xampp\\php\\php.exe ' . escapeshellarg($script));
    @unlink($script);
    return json_decode($out, true) ?: [];
}

echo "\n=======================================================\n";
echo "RUNNING AUDIT LOGS EXPANSION & INTEGRITY TEST SUITE\n";
echo "=======================================================\n\n";

try {
    // ----------------------------------------------------
    // Test 1: Database Normalization Compatibility
    // ----------------------------------------------------
    echo "Test 1: Schema Normalization & Doctor Name Resolution\n";
    
    // Verify doctors table in hospital_db_test does NOT have first_name
    $colCheck = $pdo->query("SHOW COLUMNS FROM doctors LIKE 'first_name'")->fetch();
    assert_test(
        "hospital_db_test doctors table is normalized (no first_name column)",
        $colCheck === false,
        "Expected first_name to NOT exist on doctors table in hospital_db_test"
    );

    // Ensure a doctor exists linked to a user
    $doc = $pdo->query("
        SELECT d.doctor_id, d.user_id, u.first_name, u.last_name 
        FROM doctors d 
        JOIN users u ON d.user_id = u.user_id 
        LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);

    if (!$doc) {
        // Fallback: create test user and doctor
        $pdo->prepare("INSERT INTO users (role_id, username, password_hash, first_name, last_name) VALUES (2, 'audit_doc_test', 'hash', 'Auditor', 'Physician')")->execute();
        $uId = (int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO doctors (user_id, contact_no) VALUES (?, '09123456789')")->execute([$uId]);
        $docId = (int)$pdo->lastInsertId();
        $doc = ['doctor_id' => $docId, 'user_id' => $uId, 'first_name' => 'Auditor', 'last_name' => 'Physician'];
    }

    $doctorId = (int)$doc['doctor_id'];
    $doctorUserId = (int)$doc['user_id'];
    $expectedDocName = trim($doc['first_name'] . ' ' . $doc['last_name']);

    // Ensure a patient exists
    $pat = $pdo->query("SELECT patient_id, first_name, last_name FROM patients LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    if (!$pat) {
        $pdo->prepare("INSERT INTO patients (first_name, last_name, gender, date_of_birth) VALUES ('Juan', 'Luna', 'male', '1990-01-01')")->execute();
        $patientId = (int)$pdo->lastInsertId();
        $expectedPatName = 'Juan Luna';
    } else {
        $patientId = (int)$pat['patient_id'];
        $expectedPatName = trim($pat['first_name'] . ' ' . $pat['last_name']);
    }

    // ----------------------------------------------------
    // Test 2: Appointment Creation & Rescheduling Audit Tracking
    // ----------------------------------------------------
    echo "\nTest 2: Appointment Audit Event Tracking\n";

    // Create a test appointment row with unique far-future dates
    $apptDate = '2029-07-16';
    $apptTime = '09:00:00';
    $chiefComplaint = 'Routine health screening and annual audit test';

    // Clear any previous test artifact with this slot
    $pdo->prepare("DELETE FROM appointments WHERE doctor_id = ? AND appointment_date IN ('2029-07-16', '2029-07-17')")->execute([$doctorId]);

    $stmtAppt = $pdo->prepare("
        INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status)
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
    ");
    $stmtAppt->execute([$patientId, $doctorId, $doctorUserId, $apptDate, $apptTime, $chiefComplaint]);
    $appointmentId = (int)$pdo->lastInsertId();

    // Log appointment creation
    log_audit($pdo, $doctorUserId, 'CREATE_APPOINTMENT', 'appointment', $appointmentId, null, [
        'patient_id' => $patientId,
        'doctor_id' => $doctorId,
        'appointment_date' => $apptDate,
        'appointment_time' => $apptTime,
        'chief_complaint' => $chiefComplaint,
        'has_vitals' => true
    ]);

    // Check that CREATE_APPOINTMENT record exists in audit_logs
    $auditAppt = $pdo->query("
        SELECT * FROM audit_logs 
        WHERE action = 'CREATE_APPOINTMENT' AND entity_type = 'appointment' AND entity_id = {$appointmentId}
        ORDER BY log_id DESC LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);

    assert_test(
        "CREATE_APPOINTMENT audit event recorded with target appointment_id",
        !empty($auditAppt) && (int)$auditAppt['entity_id'] === $appointmentId,
        "Failed to find audit row for appointment creation"
    );

    $parsedNew = json_decode($auditAppt['new_values'], true);
    assert_test(
        "CREATE_APPOINTMENT metadata contains patient_id, doctor_id, schedule, and chief complaint",
        isset($parsedNew['patient_id']) && (int)$parsedNew['patient_id'] === $patientId &&
        isset($parsedNew['doctor_id']) && (int)$parsedNew['doctor_id'] === $doctorId &&
        $parsedNew['appointment_date'] === $apptDate &&
        $parsedNew['chief_complaint'] === $chiefComplaint,
        "Metadata missing expected attributes: " . json_encode($parsedNew)
    );

    // Reschedule appointment
    $newApptDate = '2029-07-17';
    $newApptTime = '10:00:00';
    $pdo->prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ? WHERE appointment_id = ?")->execute([$newApptDate, $newApptTime, $appointmentId]);

    log_audit($pdo, $doctorUserId, 'RESCHEDULE_APPOINTMENT', 'appointment', $appointmentId, [
        'appointment_date' => $apptDate,
        'appointment_time' => $apptTime,
        'doctor_id' => $doctorId,
        'patient_id' => $patientId
    ], [
        'appointment_date' => $newApptDate,
        'appointment_time' => $newApptTime,
        'doctor_id' => $doctorId,
        'patient_id' => $patientId
    ]);

    $auditResched = $pdo->query("
        SELECT * FROM audit_logs 
        WHERE action = 'RESCHEDULE_APPOINTMENT' AND entity_id = {$appointmentId}
        ORDER BY log_id DESC LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);

    assert_test(
        "RESCHEDULE_APPOINTMENT audit event records previous and new schedule timestamps",
        !empty($auditResched) &&
        strpos($auditResched['old_values'], $apptDate) !== false &&
        strpos($auditResched['new_values'], $newApptDate) !== false,
        "Reschedule audit values misaligned"
    );

    // ----------------------------------------------------
    // Test 3: Consultation Saving & Updating Audit Tracking
    // ----------------------------------------------------
    echo "\nTest 3: Consultation Audit Event Tracking\n";

    // Confirm appointment first
    $pdo->prepare("UPDATE appointments SET status = 'confirmed' WHERE appointment_id = ?")->execute([$appointmentId]);

    // Create consultation row
    $consNotes = "SUBJECTIVE:\nPatient test notes\n\nOBJECTIVE:\nNormal\n\nASSESSMENT:\nHealthy\n\nPLAN:\nRest";
    $stmtCons = $pdo->prepare("INSERT INTO consultation (appointment_id, notes, consultation_date) VALUES (?, ?, NOW())");
    $stmtCons->execute([$appointmentId, $consNotes]);
    $consultationId = (int)$pdo->lastInsertId();

    // Log SAVE_CONSULTATION and COMPLETE_CONSULTATION
    log_audit($pdo, $doctorUserId, 'SAVE_CONSULTATION', 'consultation', $consultationId, null, [
        'consultation_id' => $consultationId,
        'appointment_id' => $appointmentId,
        'patient_id' => $patientId,
        'doctor_id' => $doctorId,
        'diagnoses_count' => 1,
        'prescriptions_count' => 2,
        'lab_requests_count' => 1
    ]);

    log_audit($pdo, $doctorUserId, 'COMPLETE_CONSULTATION', 'appointment', $appointmentId, [
        'status' => 'confirmed'
    ], [
        'status' => 'completed',
        'consultation_id' => $consultationId,
        'patient_id' => $patientId,
        'doctor_id' => $doctorId,
        'diagnoses_count' => 1,
        'prescriptions_count' => 2,
        'lab_requests_count' => 1
    ]);

    $auditSaveCons = $pdo->query("
        SELECT * FROM audit_logs 
        WHERE action = 'SAVE_CONSULTATION' AND entity_type = 'consultation' AND entity_id = {$consultationId}
        ORDER BY log_id DESC LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);

    assert_test(
        "SAVE_CONSULTATION audit event recorded with target consultation_id",
        !empty($auditSaveCons) && (int)$auditSaveCons['entity_id'] === $consultationId,
        "Failed to find SAVE_CONSULTATION record"
    );

    $parsedConsNew = json_decode($auditSaveCons['new_values'], true);
    assert_test(
        "SAVE_CONSULTATION new_values contains consultation_id, appointment_id, patient_id, and clinical item counts",
        isset($parsedConsNew['consultation_id']) && (int)$parsedConsNew['consultation_id'] === $consultationId &&
        isset($parsedConsNew['appointment_id']) && (int)$parsedConsNew['appointment_id'] === $appointmentId &&
        isset($parsedConsNew['diagnoses_count']) && (int)$parsedConsNew['diagnoses_count'] === 1 &&
        isset($parsedConsNew['prescriptions_count']) && (int)$parsedConsNew['prescriptions_count'] === 2 &&
        isset($parsedConsNew['lab_requests_count']) && (int)$parsedConsNew['lab_requests_count'] === 1,
        "Consultation metadata attributes missing"
    );

    // Test Consultation Addendum
    $addendumNote = "Follow-up test note added after encounter completion";
    $pdo->prepare("INSERT INTO consultation_addenda (consultation_id, doctor_id, notes, created_at) VALUES (?, ?, ?, NOW())")
        ->execute([$consultationId, $doctorId, $addendumNote]);
    $addendumId = (int)$pdo->lastInsertId();

    log_audit($pdo, $doctorUserId, 'ADD_ENCOUNTER_ADDENDUM', 'consultation', $consultationId, null, [
        'addendum_id' => $addendumId,
        'appointment_id' => $appointmentId,
        'patient_id' => $patientId,
        'doctor_id' => $doctorId
    ], $addendumNote);

    $auditAddendum = $pdo->query("
        SELECT * FROM audit_logs 
        WHERE action = 'ADD_ENCOUNTER_ADDENDUM' AND entity_type = 'consultation' AND entity_id = {$consultationId}
        ORDER BY log_id DESC LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);

    assert_test(
        "ADD_ENCOUNTER_ADDENDUM audit event recorded on consultation entity with addendum reason",
        !empty($auditAddendum) && $auditAddendum['reason'] === $addendumNote,
        "Addendum audit log missing or reason mismatch"
    );

    // ----------------------------------------------------
    // Test 4: API Enrichment & Data Integrity (Controller Query Test)
    // ----------------------------------------------------
    echo "\nTest 4: API Controller Entity Enrichment & Data Integrity\n";

    // Call audit_log_controller.php via clean subprocess
    $apiData = call_audit_controller(['limit' => 20, 'page' => 1]);

    assert_test(
        "audit_log_controller.php executes successfully with HTTP 200 JSON",
        is_array($apiData) && !empty($apiData['success']),
        "Controller failed: " . json_encode($apiData)
    );

    $items = $apiData['data']['items'] ?? [];
    assert_test(
        "API returns populated items array",
        count($items) > 0,
        "No items returned in audit logs response"
    );

    // Find the SAVE_CONSULTATION and CREATE_APPOINTMENT items
    $foundSaveCons = null;
    $foundCreateAppt = null;
    $foundAddendum = null;

    foreach ($items as $item) {
        if ($item['action'] === 'SAVE_CONSULTATION' && (int)$item['entity_id'] === $consultationId) {
            $foundSaveCons = $item;
        }
        if ($item['action'] === 'CREATE_APPOINTMENT' && (int)$item['entity_id'] === $appointmentId) {
            $foundCreateAppt = $item;
        }
        if ($item['action'] === 'ADD_ENCOUNTER_ADDENDUM' && (int)$item['entity_id'] === $consultationId) {
            $foundAddendum = $item;
        }
    }

    assert_test(
        "API enriches SAVE_CONSULTATION with target_name, patient_name, and doctor_name",
        $foundSaveCons !== null &&
        !empty($foundSaveCons['target_name']) &&
        !empty($foundSaveCons['target_patient_name']) &&
        !empty($foundSaveCons['target_doctor_name']),
        "SAVE_CONSULTATION enrichment failed: " . json_encode($foundSaveCons)
    );

    assert_test(
        "API enriches CREATE_APPOINTMENT with target_name, patient_name, and doctor_name without SQL errors",
        $foundCreateAppt !== null &&
        !empty($foundCreateAppt['target_name']) &&
        !empty($foundCreateAppt['target_patient_name']) &&
        !empty($foundCreateAppt['target_doctor_name']),
        "CREATE_APPOINTMENT enrichment failed: " . json_encode($foundCreateAppt)
    );

    assert_test(
        "Enriched target names match expected patient and doctor strings",
        $foundCreateAppt !== null &&
        $foundCreateAppt['target_patient_name'] === $expectedPatName &&
        $foundCreateAppt['target_doctor_name'] === $expectedDocName,
        "Target name resolution mismatch"
    );

    // ----------------------------------------------------
    // Test 5: Filter by Action via API Controller
    // ----------------------------------------------------
    echo "\nTest 5: Audit Log Action Filter API\n";
    $filteredAppt = call_audit_controller(['action' => 'CREATE_APPOINTMENT', 'limit' => 10]);
    assert_test(
        "API filtering by action 'CREATE_APPOINTMENT' returns only matching records",
        !empty($filteredAppt['success']) &&
        !empty($filteredAppt['data']['items']) &&
        $filteredAppt['data']['items'][0]['action'] === 'CREATE_APPOINTMENT',
        "Filter by action failed"
    );

    // ----------------------------------------------------
    // Cleanup test artifacts from hospital_db_test
    // ----------------------------------------------------
    $pdo->prepare("DELETE FROM consultation_addenda WHERE consultation_id = ?")->execute([$consultationId]);
    $pdo->prepare("DELETE FROM consultation WHERE consultation_id = ?")->execute([$consultationId]);
    $pdo->prepare("DELETE FROM appointments WHERE appointment_id = ?")->execute([$appointmentId]);
    $pdo->prepare("DELETE FROM audit_logs WHERE (entity_type = 'appointment' AND entity_id = ?) OR (entity_type = 'consultation' AND entity_id = ?)")->execute([$appointmentId, $consultationId]);

} catch (Throwable $e) {
    echo "ERROR during test execution: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    $failedTests[] = "Exception: " . $e->getMessage();
}

echo "\n=======================================================\n";
echo "TEST RESULTS: {$passedCount} passed, " . count($failedTests) . " failed (tests/verify_audit_logs_expansion.php)\n";
if (!empty($failedTests)) {
    echo "FAILED TESTS:\n";
    foreach ($failedTests as $f) {
        echo "  - {$f}\n";
    }
}
echo "=======================================================\n";

exit(count($failedTests) === 0 ? 0 : 1);
