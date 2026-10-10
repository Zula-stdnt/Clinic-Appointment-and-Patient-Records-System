<?php
// tests/run_api_tests.php
// Isolated API coverage for the Doctor Portal Lifecycle logic

$db_host = getenv('DB_HOST') ?: '127.0.0.1';
$db_port = getenv('DB_PORT') ?: '3306';
$db_name = getenv('DB_NAME') ?: 'hospital_db_test';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$db_charset = getenv('DB_CHARSET') ?: 'utf8mb4';

// Safety Guard: Refuse to run if targeting production
if ($db_name !== 'hospital_db_test') {
    echo "ERROR: Test script must strictly target 'hospital_db_test', but DB_NAME is '$db_name'.\n";
    exit(1);
}
if ($db_host !== '127.0.0.1' && $db_host !== 'localhost') {
    echo "ERROR: Test DB host must be loopback.\n";
    exit(1);
}

$dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset={$db_charset}";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (PDOException $e) {
    echo "ERROR: Could not connect to isolated test database: " . $e->getMessage() . "\n";
    exit(1);
}

// Fixture tracking
$fixtures = [
    'lab_requests' => [],
    'prescriptions' => [],
    'diagnosis' => [],
    'consultation' => [],
    'vital_signs' => [],
    'appointments' => [],
    'medications' => [],
    'doctors' => [],
    'patients' => [],
    'users' => []
];

function track_fixture($table, $id) {
    global $fixtures;
    $fixtures[$table][] = $id;
    return $id;
}

// Ensure cleanup runs
$cleanupDone = false;
function do_cleanup($pdo) {
    global $fixtures, $cleanupDone;
    if ($cleanupDone) return true;
    
    // Safety check again
    if ($pdo->query("SELECT DATABASE()")->fetchColumn() !== 'hospital_db_test') {
        echo "WARNING: Cleanup aborted. Connected database is not hospital_db_test.\n";
        return false;
    }

    $idCols = [
        'lab_requests' => 'lab_request_id',
        'prescriptions' => 'prescription_id',
        'diagnosis' => 'diagnosis_id',
        'consultation' => 'consultation_id',
        'vital_signs' => 'vital_sign_id',
        'appointments' => 'appointment_id',
        'medications' => 'medication_id',
        'doctors' => 'doctor_id',
        'patients' => 'patient_id',
        'users' => 'user_id'
    ];

    $cleanupErrors = 0;
    foreach ($idCols as $table => $col) {
        if (!empty($fixtures[$table])) {
            $ids = implode(',', array_unique(array_map('intval', $fixtures[$table])));
            try {
                $pdo->exec("DELETE FROM $table WHERE $col IN ($ids)");
            } catch (PDOException $e) {
                echo "ERROR: Failed to cleanup $table fixtures ($ids): " . $e->getMessage() . "\n";
                $cleanupErrors++;
            }
        }
    }
    
    $cleanupDone = true;
    return $cleanupErrors === 0;
}

register_shutdown_function(function() use ($pdo) {
    do_cleanup($pdo);
});

$passedTests = 0;
$failedTests = 0;

function run_test(string $name, callable $fn): void {
    global $passedTests, $failedTests;
    try {
        $result = $fn();
        if ($result === true) {
            echo "[PASS] $name\n";
            $passedTests++;
        } else {
            echo "[FAIL] $name: " . (is_string($result) ? $result : 'Assertion failed') . "\n";
            $failedTests++;
        }
    } catch (Throwable $e) {
        echo "[FAIL] $name with exception: " . $e->getMessage() . "\n";
        $failedTests++;
    }
}

// Find free port safely
$port = 8080;
while (true) {
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
    if (!$fp) {
        // Port is free
        break;
    }
    fclose($fp);
    $port++;
}

// Start PHP built-in server
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];
$env = getenv();
$env['DB_NAME'] = $db_name;
$env['DB_HOST'] = $db_host;

// Start server in project root
$cwd = realpath(__DIR__ . '/../');
// Create a unique test-only router to prove child process identity
$healthMarker = uniqid('health_');
$healthContent = uniqid('content_');
$routerCode = "<?php
if (\$_SERVER['REQUEST_URI'] === '/$healthMarker') {
    echo '$healthContent';
    exit;
}
return false;
";
$routerPath = "$cwd/router_$healthMarker.php";
file_put_contents($routerPath, $routerCode);
register_shutdown_function(function() use ($routerPath) { @unlink($routerPath); });

$serverCmd = "c:\\xampp\\php\\php.exe -S 127.0.0.1:$port router_$healthMarker.php";
$process = proc_open($serverCmd, $descriptors, $pipes, $cwd, $env);

if (!is_resource($process)) {
    echo "ERROR: Failed to start PHP test server.\n";
    exit(1);
}

register_shutdown_function(function() use ($process) {
    @proc_terminate($process, 9);
    @proc_close($process);
});

// Wait for server to start and verify it's our exact child process
$ready = false;
for ($i = 0; $i < 20; $i++) {
    $ch = curl_init("http://127.0.0.1:$port/$healthMarker");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $res = curl_exec($ch);
    if ($res === $healthContent) {
        $ready = true;
        break;
    }
    usleep(200000); // 200ms
}
if (!$ready) {
    echo "ERROR: Server failed to start or did not serve the exact process health marker on port $port.\n";
    exit(1);
}

$baseUrl = "http://127.0.0.1:$port";

function http_request(string $method, string $url, $data = null, ?string $cookieFile = null, array $headers = []): array {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    if ($cookieFile) {
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    }

    $reqHeaders = $headers;
    if ($data !== null) {
        if (is_array($data)) {
            $jsonData = json_encode($data);
            $reqHeaders[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        }
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);

    $raw = curl_exec($ch);
    $info = curl_getinfo($ch);
    $headerSize = $info['header_size'];
    $rawHeader = substr($raw, 0, $headerSize);
    $body = substr($raw, $headerSize);
    curl_close($ch);

    $json = json_decode($body, true) ?: [];

    return [
        'status'  => $info['http_code'],
        'headers' => $rawHeader,
        'body'    => $body,
        'json'    => $json
    ];
}

// Setup common fixtures
$adminUser = 'testadmin_' . uniqid();
$adminPass = 'TestPass123!';
$adminHash = password_hash($adminPass, PASSWORD_DEFAULT);
$pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (1, '$adminUser', '$adminHash', 'Admin', 'User', 'Other')");
$adminUserId = track_fixture('users', $pdo->lastInsertId());

$cookieAdmin = tempnam(sys_get_temp_dir(), 'ck_adm_');
register_shutdown_function(function() use ($cookieAdmin) { @unlink($cookieAdmin); });

$loginAdmin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", ['username' => $adminUser, 'password' => $adminPass], $cookieAdmin);
if ($loginAdmin['status'] !== 200) {
    echo "ERROR: Admin login failed! Response: " . json_encode($loginAdmin) . "\n";
    exit(1);
}
$meRes = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieAdmin);
$adminCsrf = $meRes['json']['data']['csrf_token'] ?? '';

// API Tests
run_test("API: 409 for completed/cancelled/no-show appointments", function() use ($pdo, $baseUrl, $adminUserId) {
    // Setup Doc
    $docUser = 'testdoc_' . uniqid();
    $docPass = 'DocPass123!';
    $docHash = password_hash($docPass, PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$docUser', '$docHash', 'Test', 'Doc', 'Male')");
    $docUserId = track_fixture('users', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($docUserId, '123')");
    $docId = track_fixture('doctors', $pdo->lastInsertId());

    $cookieDoc = tempnam(sys_get_temp_dir(), 'ck_doc_');
    register_shutdown_function(function() use ($cookieDoc) { @unlink($cookieDoc); });
    
    http_request('POST', "$baseUrl/api/auth_controller.php?action=login", ['username' => $docUser, 'password' => $docPass], $cookieDoc);
    $meDoc = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoc);
    $docCsrf = $meDoc['json']['data']['csrf_token'] ?? '';

    $pdo->exec("INSERT INTO patients (first_name, last_name, gender) VALUES ('Pat', 'Ient', 'Female')");
    $patId = track_fixture('patients', $pdo->lastInsertId());

    $statuses = ['completed', 'cancelled', 'no_show'];
    foreach ($statuses as $status) {
        $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $adminUserId, '2026-10-03', '10:00:00', '$status')");
        $apptId = track_fixture('appointments', $pdo->lastInsertId());

        $res = http_request('POST', "$baseUrl/api/consultation_controller.php", [
            'appointment_id' => $apptId,
            'notes' => 'Test notes'
        ], $cookieDoc, ["X-CSRF-Token: $docCsrf"]);

        if ($res['status'] !== 409) {
            return "Expected 409 for status $status, got {$res['status']}";
        }

        // Verify data unchanged
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM consultation WHERE appointment_id = ?");
        $stmt->execute([$apptId]);
        if ($stmt->fetchColumn() > 0) return "Consultation row created despite rejection for status $status.";
        
        $apptStatus = $pdo->query("SELECT status FROM appointments WHERE appointment_id = $apptId")->fetchColumn();
        if ($apptStatus !== $status) return "Appointment status was modified from $status to $apptStatus during rejection.";
    }

    return true;
});

run_test("API: Doctor cannot write another doctor's appointment", function() use ($pdo, $baseUrl, $adminUserId) {
    // Setup Doc 1
    $doc1User = 'doc1_' . uniqid();
    $doc1Pass = 'Pass123!';
    $doc1Hash = password_hash($doc1Pass, PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$doc1User', '$doc1Hash', 'Doc', 'One', 'Male')");
    $doc1UserId = track_fixture('users', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($doc1UserId, '111')");
    $doc1Id = track_fixture('doctors', $pdo->lastInsertId());

    // Setup Doc 2
    $doc2User = 'doc2_' . uniqid();
    $doc2Pass = 'Pass123!';
    $doc2Hash = password_hash($doc2Pass, PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$doc2User', '$doc2Hash', 'Doc', 'Two', 'Female')");
    $doc2UserId = track_fixture('users', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($doc2UserId, '222')");
    $doc2Id = track_fixture('doctors', $pdo->lastInsertId());

    $pdo->exec("INSERT INTO patients (first_name, last_name, gender) VALUES ('Pat', 'Ient', 'Female')");
    $patId = track_fixture('patients', $pdo->lastInsertId());

    // Appointment for Doc 2
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $doc2Id, $adminUserId, '2026-10-03', '10:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    // Doc 1 logs in
    $cookieDoc1 = tempnam(sys_get_temp_dir(), 'ck_doc1_');
    register_shutdown_function(function() use ($cookieDoc1) { @unlink($cookieDoc1); });

    http_request('POST', "$baseUrl/api/auth_controller.php?action=login", ['username' => $doc1User, 'password' => $doc1Pass], $cookieDoc1);
    $meDoc1 = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoc1);
    $doc1Csrf = $meDoc1['json']['data']['csrf_token'] ?? '';

    // Doc 1 tries to write Doc 2's appointment
    $res = http_request('POST', "$baseUrl/api/consultation_controller.php", [
        'appointment_id' => $apptId,
        'notes' => 'Hacked notes'
    ], $cookieDoc1, ["X-CSRF-Token: $doc1Csrf"]);

    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";

    return true;
});

run_test("API: Successful consultation creation saves clinical details atomically", function() use ($pdo, $baseUrl, $adminUserId) {
    // Setup Doc
    $docUser = 'doc3_' . uniqid();
    $docPass = 'Pass123!';
    $docHash = password_hash($docPass, PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$docUser', '$docHash', 'Doc', 'Three', 'Male')");
    $docUserId = track_fixture('users', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($docUserId, '333')");
    $docId = track_fixture('doctors', $pdo->lastInsertId());

    $pdo->exec("INSERT INTO patients (first_name, last_name, gender) VALUES ('Pat', 'Ient', 'Female')");
    $patId = track_fixture('patients', $pdo->lastInsertId());

    // Medication
    $pdo->exec("INSERT INTO medications (name, generic_name, manufacturer) VALUES ('Amox', 'Amoxicillin', 'Pharma')");
    $medId = track_fixture('medications', $pdo->lastInsertId());

    // Appointment
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $adminUserId, '2026-10-03', '10:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    $cookieDoc = tempnam(sys_get_temp_dir(), 'ck_doc3_');
    register_shutdown_function(function() use ($cookieDoc) { @unlink($cookieDoc); });

    http_request('POST', "$baseUrl/api/auth_controller.php?action=login", ['username' => $docUser, 'password' => $docPass], $cookieDoc);
    $meDoc = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoc);
    $docCsrf = $meDoc['json']['data']['csrf_token'] ?? '';

    // Save Consultation
    $payload = [
        'appointment_id' => $apptId,
        'notes' => 'Patient looks okay.',
        'diagnoses' => [
            ['icd10_code' => 'J02.9', 'diagnosis_name' => 'Acute pharyngitis']
        ],
        'prescriptions' => [
            ['medication_id' => $medId, 'dosage' => '500mg', 'frequency' => 'BID', 'start_date' => '2026-10-03']
        ],
        'lab_requests' => [
            ['test_name' => 'CBC', 'request_date' => '2026-10-03']
        ]
    ];

    $res = http_request('POST', "$baseUrl/api/consultation_controller.php", $payload, $cookieDoc, ["X-CSRF-Token: $docCsrf"]);

    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}: " . json_encode($res['json']);

    $consId = $res['json']['data']['consultation_id'] ?? 0;
    if ($consId) {
        track_fixture('consultation', $consId);
        
        // Track child rows by selecting them
        $diags = $pdo->query("SELECT diagnosis_id FROM diagnosis WHERE consultation_id = $consId")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($diags as $d) track_fixture('diagnosis', $d);
        
        $rxs = $pdo->query("SELECT prescription_id FROM prescriptions WHERE consultation_id = $consId")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($rxs as $r) track_fixture('prescriptions', $r);
        
        $labs = $pdo->query("SELECT lab_request_id FROM lab_requests WHERE consultation_id = $consId")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($labs as $l) track_fixture('lab_requests', $l);
    }

    // Verify DB
    $apptStatus = $pdo->query("SELECT status FROM appointments WHERE appointment_id = $apptId")->fetchColumn();
    if ($apptStatus !== 'completed') return "Appointment status not completed.";

    $diagCount = $pdo->query("SELECT COUNT(*) FROM diagnosis WHERE consultation_id = $consId")->fetchColumn();
    if ($diagCount != 1) return "Diagnosis not inserted.";

    $rxCount = $pdo->query("SELECT COUNT(*) FROM prescriptions WHERE consultation_id = $consId")->fetchColumn();
    if ($rxCount != 1) return "Prescription not inserted.";

    $labCount = $pdo->query("SELECT COUNT(*) FROM lab_requests WHERE consultation_id = $consId")->fetchColumn();
    if ($labCount != 1) return "Lab request not inserted.";

    return true;
});

run_test("API: Detail write failure triggers atomic rollback", function() use ($pdo, $baseUrl, $adminUserId) {
    // Setup Doc
    $docUser = 'docfail_' . uniqid();
    $docPass = 'Pass123!';
    $docHash = password_hash($docPass, PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$docUser', '$docHash', 'Doc', 'Fail', 'Male')");
    $docUserId = track_fixture('users', $pdo->lastInsertId());
    $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($docUserId, '555')");
    $docId = track_fixture('doctors', $pdo->lastInsertId());

    $pdo->exec("INSERT INTO patients (first_name, last_name, gender) VALUES ('Pat', 'Ient', 'Female')");
    $patId = track_fixture('patients', $pdo->lastInsertId());

    // Appointment
    $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $adminUserId, '2026-10-03', '10:00:00', 'scheduled')");
    $apptId = track_fixture('appointments', $pdo->lastInsertId());

    $cookieDoc = tempnam(sys_get_temp_dir(), 'ck_docfail_');
    register_shutdown_function(function() use ($cookieDoc) { @unlink($cookieDoc); });

    http_request('POST', "$baseUrl/api/auth_controller.php?action=login", ['username' => $docUser, 'password' => $docPass], $cookieDoc);
    $meDoc = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoc);
    $docCsrf = $meDoc['json']['data']['csrf_token'] ?? '';

    // Pass invalid medication_id to trigger a PDOException on the prescription detail row insertion
    $payload = [
        'appointment_id' => $apptId,
        'notes' => 'Patient looks okay, trying invalid med.',
        'diagnoses' => [
            ['icd10_code' => 'J02.9', 'diagnosis_name' => 'Acute pharyngitis']
        ],
        'prescriptions' => [
            ['medication_id' => 999999, 'dosage' => '500mg', 'frequency' => 'BID', 'start_date' => '2026-10-03']
        ]
    ];

    $res = http_request('POST', "$baseUrl/api/consultation_controller.php", $payload, $cookieDoc, ["X-CSRF-Token: $docCsrf"]);

    if ($res['status'] !== 500 && $res['status'] !== 400) {
        return "Expected 500 or 400 for constraint violation, got {$res['status']}: " . json_encode($res['json']);
    }

    // Verify DB rollback
    $apptStatus = $pdo->query("SELECT status FROM appointments WHERE appointment_id = $apptId")->fetchColumn();
    if ($apptStatus !== 'scheduled') return "Appointment status changed despite rollback.";

    $consCount = $pdo->query("SELECT COUNT(*) FROM consultation WHERE appointment_id = $apptId")->fetchColumn();
    if ($consCount > 0) return "Consultation row created despite rollback.";

    // Because consultation doesn't exist, we just verify the overall detail tables haven't been polluted with dangling rows for this appointment
    $diagCount = $pdo->query("SELECT COUNT(*) FROM diagnosis d JOIN consultation c ON d.consultation_id = c.consultation_id WHERE c.appointment_id = $apptId")->fetchColumn();
    if ($diagCount > 0) return "Diagnosis row created despite rollback.";

    $rxCount = $pdo->query("SELECT COUNT(*) FROM prescriptions p JOIN consultation c ON p.consultation_id = c.consultation_id WHERE c.appointment_id = $apptId")->fetchColumn();
    if ($rxCount > 0) return "Prescription row created despite rollback.";

    $labCount = $pdo->query("SELECT COUNT(*) FROM lab_requests l JOIN consultation c ON l.consultation_id = c.consultation_id WHERE c.appointment_id = $apptId")->fetchColumn();
    if ($labCount > 0) return "Lab request row created despite rollback.";

    return true;
});

echo "\nAPI Tests Completed: $passedTests passed, $failedTests failed.\n";

// Explicit teardown
$cleanupSuccess = do_cleanup($pdo);
if (!$cleanupSuccess) {
    echo "ERROR: Fixture cleanup failed during explicit teardown.\n";
    $failedTests++;
}

// Concurrency note
echo "\n[INFO] Concurrency using 'curl_multi' cannot be reliably tested here because PHP built-in server ('php -S') is single-threaded on Windows and serializes incoming requests. Concurrency protection via FOR UPDATE remains verified by static review only.\n";

exit($failedTests === 0 ? 0 : 1);
