<?php
// tests/verify_receptionist_edits.php

$db_host = getenv('DB_HOST') ?: '127.0.0.1';
$db_port = getenv('DB_PORT') ?: '3306';
$db_name = getenv('DB_NAME') ?: 'hospital_db_test';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$db_charset = getenv('DB_CHARSET') ?: 'utf8mb4';

// Safety Guard: Refuse to run if targeting production
if ($db_name !== 'hospital_db_test') {
    echo "ERROR: Test script must strictly target 'hospital_db_test'.\n";
    exit(1);
}
if (!in_array($db_host, ['127.0.0.1', 'localhost'], true)) {
    echo "ERROR: Test DB host must be loopback.\n";
    exit(1);
}

$dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset={$db_charset}";
try {
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    echo "ERROR: Could not connect: " . $e->getMessage() . "\n";
    exit(1);
}

// Fixture tracking
$fixtures = ['appointments' => [], 'vital_signs' => [], 'doctors' => [], 'patients' => [], 'users' => [], 'roles' => [], 'consultation' => [], 'diagnosis' => []];
function track_fixture($table, $id) {
    global $fixtures;
    $fixtures[$table][] = $id;
    return $id;
}

$cleanupDone = false;
function do_cleanup($pdo) {
    global $fixtures, $cleanupDone;
    if ($cleanupDone) return true;
    if ($pdo->query("SELECT DATABASE()")->fetchColumn() !== 'hospital_db_test') return false;

    $idCols = [
        'diagnosis' => 'diagnosis_id',
        'consultation' => 'consultation_id',
        'vital_signs' => 'vital_sign_id',
        'appointments' => 'appointment_id',
        'doctors' => 'doctor_id',
        'patients' => 'patient_id',
        'users' => 'user_id',
        'roles' => 'role_id'
    ];

    foreach ($idCols as $table => $col) {
        if (!empty($fixtures[$table])) {
            $ids = implode(',', array_unique(array_map('intval', $fixtures[$table])));
            $pdo->exec("DELETE FROM $table WHERE $col IN ($ids)");
        }
    }
    $cleanupDone = true;
    return true;
}
register_shutdown_function(function() use ($pdo) { do_cleanup($pdo); });

function find_free_port($start) {
    while (true) {
        $fp = @fsockopen('127.0.0.1', $start, $errno, $errstr, 0.1);
        if (!$fp) return $start;
        fclose($fp);
        $start++;
    }
}

$port1 = find_free_port(8080);
$port2 = find_free_port($port1 + 1);

// Start 2 PHP built-in servers for concurrency
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$env = getenv();
$env['DB_NAME'] = $db_name;
$env['DB_HOST'] = $db_host;

$cwd = realpath(__DIR__ . '/../');
$healthMarker = uniqid('health_');
$routerCode = "<?php if (\$_SERVER['REQUEST_URI'] === '/$healthMarker') { require_once 'config/db_connect.php'; echo \$pdo->query('SELECT DATABASE()')->fetchColumn(); exit; } return false; ";
file_put_contents("$cwd/router_$healthMarker.php", $routerCode);
register_shutdown_function(function() use ($cwd, $healthMarker) { @unlink("$cwd/router_$healthMarker.php"); });

$phpExe = 'c:\\xampp\\php\\php.exe';
$p1 = proc_open("$phpExe -S 127.0.0.1:$port1 router_$healthMarker.php", $descriptors, $pipes1, $cwd, $env);
$p2 = proc_open("$phpExe -S 127.0.0.1:$port2 router_$healthMarker.php", $descriptors, $pipes2, $cwd, $env);

register_shutdown_function(function() use ($p1, $p2) {
    if (is_resource($p1)) { @proc_terminate($p1, 9); @proc_close($p1); }
    if (is_resource($p2)) { @proc_terminate($p2, 9); @proc_close($p2); }
});

// Wait for servers
$ready1 = false; $ready2 = false;
for ($i = 0; $i < 20; $i++) {
    if (!$ready1 && @file_get_contents("http://127.0.0.1:$port1/$healthMarker") === 'hospital_db_test') $ready1 = true;
    if (!$ready2 && @file_get_contents("http://127.0.0.1:$port2/$healthMarker") === 'hospital_db_test') $ready2 = true;
    if ($ready1 && $ready2) break;
    usleep(200000);
}
if (!$ready1 || !$ready2) { echo "ERROR: Test servers failed to start.\n"; exit(1); }

$baseUrl1 = "http://127.0.0.1:$port1";
$baseUrl2 = "http://127.0.0.1:$port2";

function http_request(string $method, string $url, $data = null, ?string $cookieFile = null, array $headers = []): array {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($cookieFile) { curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile); curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile); }
    if ($data !== null) { $headers[] = 'Content-Type: application/json'; curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data)); }
    if ($headers) curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $body = curl_exec($ch);
    return ['status' => curl_getinfo($ch, CURLINFO_HTTP_CODE), 'json' => json_decode($body, true) ?: []];
}

$passedTests = 0; $failedTests = 0;
function run_test(string $name, callable $fn) {
    global $passedTests, $failedTests;
    try {
        $result = $fn();
        if ($result === true) { echo "[PASS] $name\n"; $passedTests++; }
        else { echo "[FAIL] $name: $result\n"; $failedTests++; }
    } catch (Throwable $e) {
        echo "[FAIL] $name EXCEPTION: " . $e->getMessage() . "\n"; $failedTests++;
    }
}

// SETUP ROLES
$existingRoles = $pdo->query("SELECT role_id FROM roles WHERE role_id IN (2, 3)")->fetchAll(PDO::FETCH_COLUMN);
$pdo->exec("INSERT IGNORE INTO roles (role_id, role_name) VALUES (2, 'Receptionist'), (3, 'Doctor')");
if (!in_array(2, $existingRoles)) track_fixture('roles', 2);
if (!in_array(3, $existingRoles)) track_fixture('roles', 3);

// SETUP RECEP
$recepUser = 'rec_' . uniqid();
$pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (2, '$recepUser', '" . password_hash('Pass123!', PASSWORD_DEFAULT) . "', 'R', 'T', 'Male')");
$recepId = track_fixture('users', $pdo->lastInsertId());
$cookieRecep = tempnam(sys_get_temp_dir(), 'ck_rec_');
register_shutdown_function(function() use ($cookieRecep) { @unlink($cookieRecep); });
$loginRecep = http_request('POST', "$baseUrl1/api/auth_controller.php?action=login", ['username' => $recepUser, 'password' => 'Pass123!'], $cookieRecep);
$csrfRecep = $loginRecep['json']['data']['csrf_token'] ?? '';

// SETUP DOC
$docUser = 'doc_' . uniqid();
$pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$docUser', '" . password_hash('Pass123!', PASSWORD_DEFAULT) . "', 'D', 'T', 'Male')");
$docUserId = track_fixture('users', $pdo->lastInsertId());
$pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($docUserId, '123')");
$docId = track_fixture('doctors', $pdo->lastInsertId());
$cookieDoc = tempnam(sys_get_temp_dir(), 'ck_doc_');
register_shutdown_function(function() use ($cookieDoc) { @unlink($cookieDoc); });
$loginDoc = http_request('POST', "$baseUrl1/api/auth_controller.php?action=login", ['username' => $docUser, 'password' => 'Pass123!'], $cookieDoc);
$csrfDoc = $loginDoc['json']['data']['csrf_token'] ?? '';

// SETUP PATIENT
$pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth) VALUES ('P', 'T', 'Male', '2000-01-01')");
$patId = track_fixture('patients', $pdo->lastInsertId());

echo "=== Running Receptionist Isolated Tests ===\n";

run_test("Doctor forbidden from receptionist API", function() use ($pdo, $baseUrl1, $cookieDoc, $csrfDoc, $patId, $docId, $recepId) {
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $recepId, '2050-01-01', '09:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    $res = http_request('PUT', "$baseUrl1/api/appointment_controller.php?id=$apptId", [
        'patient_id' => $patId, 'doctor_id' => $docId, 'appointment_date' => '2050-01-01', 'appointment_time' => '10:00:00', 'status' => 'confirmed'
    ], $cookieDoc, ["X-CSRF-Token: $csrfDoc"]);

    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";
    return true;
});

run_test("Receptionist edits active appointment and clears vitals", function() use ($pdo, $baseUrl1, $cookieRecep, $csrfRecep, $patId, $docId, $recepId) {
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $recepId, '2050-01-01', '09:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO vital_signs (appointment_id, blood_pressure, temperature) VALUES ($apptId, '120/80', 37.0)");

    $res = http_request('PUT', "$baseUrl1/api/appointment_controller.php?id=$apptId", [
        'patient_id' => $patId, 'doctor_id' => $docId, 'appointment_date' => '2050-01-02', 'appointment_time' => '10:00:00', 'status' => 'confirmed',
        'blood_pressure' => '', 'temperature' => '', 'oxygen_saturation' => ''
    ], $cookieRecep, ["X-CSRF-Token: $csrfRecep"]);

    if ($res['status'] !== 200) return "Expected 200, got {$res['status']} " . json_encode($res['json']);
    
    $appt = $pdo->query("SELECT appointment_date, appointment_time, status FROM appointments WHERE appointment_id = $apptId")->fetch();
    if ($appt['appointment_date'] !== '2050-01-02' || $appt['appointment_time'] !== '10:00:00' || $appt['status'] !== 'confirmed') return "DB not updated properly";

    $vCheck = $pdo->query("SELECT COUNT(*) FROM vital_signs WHERE appointment_id = $apptId")->fetchColumn();
    if ($vCheck > 0) return "Vitals not cleared from DB";

    return true;
});

run_test("Terminal status rejection", function() use ($pdo, $baseUrl1, $cookieRecep, $csrfRecep, $patId, $docId, $recepId) {
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $recepId, '2050-01-03', '09:00:00', 'completed')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    $res = http_request('PUT', "$baseUrl1/api/appointment_controller.php?id=$apptId", [
        'patient_id' => $patId, 'doctor_id' => $docId, 'appointment_date' => '2050-01-03', 'appointment_time' => '10:00:00', 'status' => 'scheduled'
    ], $cookieRecep, ["X-CSRF-Token: $csrfRecep"]);

    if ($res['status'] !== 409) return "Expected 409, got {$res['status']}";
    return true;
});

run_test("Stale status transition prevention (confirmed -> scheduled)", function() use ($pdo, $baseUrl1, $cookieRecep, $csrfRecep, $patId, $docId, $recepId) {
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $recepId, '2050-01-03', '09:00:00', 'confirmed')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    $res = http_request('PUT', "$baseUrl1/api/appointment_controller.php?id=$apptId", [
        'patient_id' => $patId, 'doctor_id' => $docId, 'appointment_date' => '2050-01-03', 'appointment_time' => '10:00:00', 'status' => 'scheduled'
    ], $cookieRecep, ["X-CSRF-Token: $csrfRecep"]);

    if ($res['status'] !== 422) return "Expected 422, got {$res['status']}";
    if (empty($res['json']['errors']['status'])) return "Missing status error field";
    return true;
});

run_test("Archived patient/doctor behavior is safely preserved", function() use ($pdo, $baseUrl1, $cookieRecep, $csrfRecep, $recepId) {
    // Archived Doc
    $aDocUser = 'adoc_' . uniqid();
    $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$aDocUser', 'xx', 'A', 'D', 'Male')");
    $aDocUserId = track_fixture('users', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO doctors (user_id, contact_no, deleted_at) VALUES ($aDocUserId, '123', NOW())");
    $aDocId = track_fixture('doctors', $pdo->lastInsertId());
    
    // Archived Pat
    $pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth, deleted_at) VALUES ('A', 'P', 'Male', '2000-01-01', NOW())");
    $aPatId = track_fixture('patients', $pdo->lastInsertId());

    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($aPatId, $aDocId, $recepId, '2050-01-04', '09:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    // Edit without changing the patient/doc IDs (simulating UI passing them)
    $res = http_request('PUT', "$baseUrl1/api/appointment_controller.php?id=$apptId", [
        'patient_id' => $aPatId, 'doctor_id' => $aDocId, 'appointment_date' => '2050-01-04', 'appointment_time' => '11:00:00', 'status' => 'scheduled'
    ], $cookieRecep, ["X-CSRF-Token: $csrfRecep"]);

    if ($res['status'] !== 200) return "Expected 200, got {$res['status']} " . json_encode($res['json']);
    return true;
});

run_test("Real Concurrency: DB-controlled lock wait and reschedule prevention", function() use ($pdo, $baseUrl1, $cookieRecep, $csrfRecep, $patId, $docId, $recepId) {
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $recepId, '2050-01-05', '09:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    // 1. Test script acquires the lock on the target doctor
    $pdo->beginTransaction();
    $pdo->query("SELECT doctor_id FROM doctors WHERE doctor_id = $docId FOR UPDATE")->fetchAll();

    // 2. Start the API request asynchronously
    $mh = curl_multi_init();
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$baseUrl1/api/appointment_controller.php?id=$apptId");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieRecep);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', "X-CSRF-Token: $csrfRecep"]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['patient_id' => $patId, 'doctor_id' => $docId, 'appointment_date' => '2050-01-05', 'appointment_time' => '11:00:00', 'status' => 'scheduled']));
    curl_multi_add_handle($mh, $ch);

    $active = null;
    do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);

    // 3. Observe the lock wait: wait up to 0.5s to verify the API request blocks
    $waited = 0;
    while ($active && $mrc == CURLM_OK && $waited < 5) {
        if (curl_multi_select($mh, 0.1) != -1) {
            do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
        }
        $waited++;
    }

    if (!$active) {
        $pdo->rollBack();
        return "Concurrency unverified: API request completed without waiting for the DB lock.";
    }

    // 4. Create the conflict while we hold the lock
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $recepId, '2050-01-05', '11:00:00', 'scheduled')");
    track_fixture('appointments', $pdo->lastInsertId());

    // 5. Release the lock, allowing the API request to resume and immediately hit the conflict
    $pdo->commit();

    // 6. Complete the API request
    do {
        if (curl_multi_select($mh, 0.1) != -1) {
            do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
        }
    } while ($active);
    
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_multi_remove_handle($mh, $ch);
    curl_multi_close($mh);

    if ($code !== 409) return "Expected 409 double-booking rejection after lock release, got $code";

    return true;
});

run_test("ITE 387 Required: Complete multiple encounters and verify patient history", function() use ($pdo, $baseUrl1, $cookieDoc, $csrfDoc, $cookieRecep, $csrfRecep, $docId, $recepId) {
    // Fresh patient
    $pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth) VALUES ('H', 'P', 'Male', '2000-01-01')");
    $hPatId = track_fixture('patients', $pdo->lastInsertId());

    // 1. Create first appointment via API
    $resA1 = http_request('POST', "$baseUrl1/api/appointment_controller.php", [
        'patient_id' => $hPatId, 'doctor_id' => $docId, 'appointment_date' => '2026-01-01', 'appointment_time' => '09:00:00'
    ], $cookieRecep, ["X-CSRF-Token: $csrfRecep"]);
    if ($resA1['status'] !== 201) return "Appointment 1 creation failed: {$resA1['status']} " . json_encode($resA1['json']);
    $appt1Id = track_fixture('appointments', $resA1['json']['data']['appointment_id']);
    
    // 2. Doctor saves consultation 1 with Diagnosis A
    $res1 = http_request('POST', "$baseUrl1/api/consultation_controller.php", [
        'appointment_id' => $appt1Id,
        'notes' => 'Visit 1',
        'diagnoses' => [['icd10_code' => 'A00', 'diagnosis_name' => 'Diag 1']]
    ], $cookieDoc, ["X-CSRF-Token: $csrfDoc"]);
    if ($res1['status'] !== 200) return "Consultation 1 failed: {$res1['status']}";
    $cid1 = $res1['json']['data']['consultation_id'];
    track_fixture('consultation', $cid1);
    foreach ($pdo->query("SELECT diagnosis_id FROM diagnosis WHERE consultation_id = $cid1")->fetchAll(PDO::FETCH_COLUMN) as $d) track_fixture('diagnosis', $d);

    // 3. Create second appointment via API
    $resA2 = http_request('POST', "$baseUrl1/api/appointment_controller.php", [
        'patient_id' => $hPatId, 'doctor_id' => $docId, 'appointment_date' => '2026-02-01', 'appointment_time' => '09:00:00'
    ], $cookieRecep, ["X-CSRF-Token: $csrfRecep"]);
    if ($resA2['status'] !== 201) return "Appointment 2 creation failed: {$resA2['status']} " . json_encode($resA2['json']);
    $appt2Id = track_fixture('appointments', $resA2['json']['data']['appointment_id']);

    // 4. Doctor saves consultation 2 with Diagnosis B
    $res2 = http_request('POST', "$baseUrl1/api/consultation_controller.php", [
        'appointment_id' => $appt2Id,
        'notes' => 'Visit 2',
        'diagnoses' => [['icd10_code' => 'B00', 'diagnosis_name' => 'Diag 2']]
    ], $cookieDoc, ["X-CSRF-Token: $csrfDoc"]);
    if ($res2['status'] !== 200) return "Consultation 2 failed: {$res2['status']}";
    $cid2 = $res2['json']['data']['consultation_id'];
    track_fixture('consultation', $cid2);
    foreach ($pdo->query("SELECT diagnosis_id FROM diagnosis WHERE consultation_id = $cid2")->fetchAll(PDO::FETCH_COLUMN) as $d) track_fixture('diagnosis', $d);

    // 5. Verify Patient History (Doctor context)
    $histRes = http_request('GET', "$baseUrl1/api/doctor_patients_controller.php?action=history&patient_id=$hPatId", null, $cookieDoc);
    if ($histRes['status'] !== 200) return "History failed: {$histRes['status']}";
    $items = $histRes['json']['data']['encounters'] ?? [];
    if (count($items) !== 2) return "History should have 2 encounters, found " . count($items);
    
    $enc1 = array_filter($items, function($e) use ($appt1Id) { return $e['appointment_id'] == $appt1Id; });
    $enc2 = array_filter($items, function($e) use ($appt2Id) { return $e['appointment_id'] == $appt2Id; });
    
    if (empty($enc1)) return "Encounter for appointment 1 missing from history.";
    if (empty($enc2)) return "Encounter for appointment 2 missing from history.";
    
    $enc1 = reset($enc1);
    $enc2 = reset($enc2);
    
    $d1 = array_map(function($d) { return $d['diagnosis_name']; }, $enc1['diagnoses'] ?? []);
    $d2 = array_map(function($d) { return $d['diagnosis_name']; }, $enc2['diagnoses'] ?? []);
    
    if (!in_array('Diag 1', $d1)) return "Diag 1 not attached to encounter 1.";
    if (!in_array('Diag 2', $d2)) return "Diag 2 not attached to encounter 2.";
    
    // 6. Verify Receptionist is blocked from accessing history via doctor_patients_controller
    $recRes = http_request('GET', "$baseUrl1/api/doctor_patients_controller.php?action=history&patient_id=$hPatId", null, $cookieRecep);
    if ($recRes['status'] !== 403) return "Receptionist should be blocked from patient history, got {$recRes['status']}";

    return true;
});
    


echo "Total tests: " . ($passedTests + $failedTests) . ". Passed: $passedTests. Failed: $failedTests.\n";
exit($failedTests === 0 ? 0 : 1);
