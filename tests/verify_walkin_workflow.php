<?php
// tests/verify_walkin_workflow.php

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
$cookie_files = [];
$router_files = [];

function track_fixture($table, $id) {
    global $fixtures;
    $fixtures[$table][] = $id;
    return $id;
}

$cleanupDone = false;
function do_cleanup($pdo) {
    global $fixtures, $cleanupDone, $cookie_files, $router_files;
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
    foreach ($cookie_files as $cf) { @unlink($cf); }
    foreach ($router_files as $rf) { @unlink($rf); }
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

$descriptors = [0 => ["pipe", "r"], 1 => ["pipe", "w"], 2 => ["pipe", "w"]];
$env = getenv();
$env['DB_NAME'] = 'hospital_db_test';
$env['DB_HOST'] = '127.0.0.1';

$cwd = realpath(__DIR__ . '/../');
$healthMarker = uniqid('health_');
$routerCode = "<?php if (\$_SERVER['REQUEST_URI'] === '/$healthMarker') { require_once 'config/db_connect.php'; echo \$pdo->query('SELECT DATABASE()')->fetchColumn(); exit; } return false; ";
file_put_contents("$cwd/router_$healthMarker.php", $routerCode);
$router_files[] = "$cwd/router_$healthMarker.php";

$phpExe = 'c:\\xampp\\php\\php.exe';
echo "Starting PHP server...\n";
$p1 = proc_open("$phpExe -S 127.0.0.1:$port1 router_$healthMarker.php", $descriptors, $pipes1, $cwd, $env);

register_shutdown_function(function() use ($p1) {
    if (is_resource($p1)) { @proc_terminate($p1, 9); @proc_close($p1); }
});

echo "Waiting for server to be ready on port $port1 with marker $healthMarker...\n";
// Wait for server
$ready1 = false;
$ctx = stream_context_create(['http' => ['timeout' => 1]]);
for ($i = 0; $i < 20; $i++) {
    $r = @file_get_contents("http://127.0.0.1:$port1/$healthMarker", false, $ctx);
    if (!$ready1 && $r === 'hospital_db_test') $ready1 = true;
    if ($ready1) break;
    usleep(200000);
}

if (!$ready1) {
    echo "ERROR: Could not verify test server database connection.\n";
    exit(1);
}

echo "Server ready. Logging in...\n";

$baseUrl = "http://127.0.0.1:$port1";

// Helper HTTP Request
function http_request($method, $url, $data = null, $cookie = null, $headers = []) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $allHeaders = ['Content-Type: application/json'];
    if ($headers) $allHeaders = array_merge($allHeaders, $headers);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $allHeaders);
    if ($cookie) {
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie);
    }
    if ($data !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $code, 'body' => $res, 'json' => json_decode($res, true)];
}

// Setup Roles
function get_or_create_role($pdo, $roleName, $defaultId) {
    $roleId = $pdo->query("SELECT role_id FROM roles WHERE role_name = '$roleName'")->fetchColumn();
    if (!$roleId) {
        $pdo->exec("INSERT INTO roles (role_id, role_name) VALUES ($defaultId, '$roleName')");
        track_fixture('roles', $defaultId);
        return $defaultId;
    }
    return $roleId;
}
$adminRoleId = get_or_create_role($pdo, 'Administrator', 1);
$docRoleId = get_or_create_role($pdo, 'Doctor', 2);
$recepRoleId = get_or_create_role($pdo, 'Receptionist', 3);

// Setup Users
$runId = uniqid('u');
$users = [
    ['admin_' . $runId, 'admin', $adminRoleId, 'Adm', 'A', 'admin'],
    ['doc_' . $runId, 'doc', $docRoleId, 'Doc', 'D', 'doc'],
    ['rec_' . $runId, 'rec', $recepRoleId, 'Rec', 'R', 'rec']
];
$userIds = [];
$plain_creds = [];
foreach ($users as $u) {
    $hash = password_hash($u[1], PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (username, password_hash, role_id, first_name, last_name, gender) VALUES ('{$u[0]}', '$hash', {$u[2]}, '{$u[3]}', '{$u[4]}', 'Male')");
    $userIds[$u[5]] = track_fixture('users', $pdo->lastInsertId());
    $plain_creds[$u[5]] = [$u[0], $u[1]];
}

// Setup Doctor
$pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ({$userIds['doc']}, '123')");
$docId = track_fixture('doctors', $pdo->lastInsertId());

// Login Helpers
function login($user, $pass) {
    global $baseUrl, $cookie_files;
    $cookie = tempnam(sys_get_temp_dir(), 'cookie');
    $cookie_files[] = $cookie;
    $res = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", ['username' => $user, 'password' => $pass], $cookie);
    if ($res['status'] !== 200) {
        die("Login failed for $user: " . json_encode($res));
    }
    return [$cookie, $res['json']['data']['csrf_token'] ?? ''];
}

list($cookieAdmin, $csrfAdmin) = login($plain_creds['admin'][0], $plain_creds['admin'][1]);
list($cookieDoc, $csrfDoc) = login($plain_creds['doc'][0], $plain_creds['doc'][1]);
list($cookieRec, $csrfRec) = login($plain_creds['rec'][0], $plain_creds['rec'][1]);

$tests = 0; $passed = 0;
function run_test($name, $fn) {
    global $tests, $passed;
    $tests++;
    try {
        $res = $fn();
        if ($res === true) { echo "[PASS] $name\n"; $passed++; }
        else { echo "[FAIL] $name: $res\n"; }
    } catch (Exception $e) { echo "[FAIL] $name EXCEPTION: " . $e->getMessage() . "\n"; }
}

echo "=== Running Walk-in Patient Workflow Tests ===\n";

run_test("Receptionist can create walk-in patient and book appointment", function() use ($baseUrl, $cookieRec, $csrfRec, $docId) {
    // 1. Create Patient
    $pData = [
        'first_name' => 'Walkin',
        'last_name' => 'Test',
        'gender' => 'Male',
        'date_of_birth' => '1990-01-01',
        'contact_no' => '09123456789'
    ];
    $resP = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($resP['status'] !== 201) return "Patient create failed: {$resP['status']} " . json_encode($resP['json']);
    
    $patId = track_fixture('patients', $resP['json']['data']['patient_id']);
    if (!$patId) return "No patient ID returned.";

    // 2. Book Appointment
    $aData = [
        'patient_id' => $patId,
        'doctor_id' => $docId,
        'appointment_date' => '2026-05-05',
        'appointment_time' => '10:00:00'
    ];
    $resA = http_request('POST', "$baseUrl/api/appointment_controller.php", $aData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($resA['status'] !== 201) return "Appointment book failed: {$resA['status']} " . json_encode($resA['json']);
    track_fixture('appointments', $resA['json']['data']['appointment_id']);
    
    // 3. Edit Patient Details
    $editData = [
        'first_name' => 'Walkin Edited',
        'last_name' => 'Test',
        'middle_initial' => 'A', // valid
        'gender' => 'Male',
        'date_of_birth' => '1990-01-01',
        'contact_no' => '09171112222'
    ];
    $apptId = $resA['json']['data']['appointment_id'];
    $resE = http_request('PUT', "$baseUrl/api/appointment_patient_controller.php?appointment_id=$apptId", $editData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($resE['status'] !== 200) return "Patient edit failed: {$resE['status']} " . json_encode($resE['json']);

    // Check invalid middle initial
    $invalidEditData = $editData;
    $invalidEditData['middle_initial'] = 'AB'; // invalid
    $resE2 = http_request('PUT', "$baseUrl/api/appointment_patient_controller.php?appointment_id=$apptId", $invalidEditData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($resE2['status'] !== 422) return "Expected 422 for bad middle initial, got {$resE2['status']}";
    
    return true;
});

run_test("Invalid walk-in patient input is rejected", function() use ($baseUrl, $cookieRec, $csrfRec) {
    $pData = [
        'first_name' => '', // Invalid
        'last_name' => 'Test',
        'gender' => '', // Invalid
        'date_of_birth' => '3000-01-01', // Invalid (future)
        'contact_no' => '' // Invalid (required)
    ];
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($res['status'] !== 422) return "Expected 422, got {$res['status']}";
    if (!isset($res['json']['errors']['first_name'])) return "Missing first_name error";
    if (!isset($res['json']['errors']['gender'])) return "Missing gender error";
    if (!isset($res['json']['errors']['date_of_birth'])) return "Missing date_of_birth error";
    if (!isset($res['json']['errors']['contact_no'])) return "Missing contact_no error";
    return true;
});

run_test("Duplicate patient creation is permitted (name & dob match)", function() use ($baseUrl, $cookieRec, $csrfRec) {
    $pData = ['first_name' => 'Dup', 'last_name' => 'Test', 'gender' => 'Male', 'date_of_birth' => '1995-05-05', 'contact_no' => '09171234567'];
    
    // First creation
    $res1 = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    track_fixture('patients', $res1['json']['data']['patient_id']);
    
    // Duplicate creation
    $res2 = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($res2['status'] !== 201) return "Expected 201 created, got {$res2['status']}";
    track_fixture('patients', $res2['json']['data']['patient_id']);
    return true;
});

run_test("Contact number validation (11 digits, starts with 09)", function() use ($baseUrl, $cookieRec, $csrfRec) {
    $baseData = ['first_name' => 'Contact', 'last_name' => 'Test', 'gender' => 'Male', 'date_of_birth' => '1990-01-01'];
    
    // Invalid 1: Too short
    $pData = $baseData;
    $pData['contact_no'] = '0912345678';
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($res['status'] !== 422) return "Expected 422 for short number, got {$res['status']}";
    
    // Invalid 2: Doesn't start with 09
    $pData['contact_no'] = '08123456789';
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($res['status'] !== 422) return "Expected 422 for non-09 number, got {$res['status']}";
    
    // Valid
    $pData['contact_no'] = '09123456789';
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($res['status'] !== 201) return "Expected 201 for valid number, got {$res['status']}";
    track_fixture('patients', $res['json']['data']['patient_id']);
    return true;
});

run_test("Doctors are denied walk-in creation", function() use ($baseUrl, $cookieDoc, $csrfDoc) {
    $pData = ['first_name' => 'DocPat', 'last_name' => 'Test', 'gender' => 'Male', 'date_of_birth' => '1990-01-01', 'contact_no' => '09123456789'];
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieDoc, ["X-CSRF-Token: $csrfDoc"]);
    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";
    return true;
});

run_test("Admin can use walk-in creation", function() use ($baseUrl, $cookieAdmin, $csrfAdmin) {
    $pData = ['first_name' => 'AdmPat', 'last_name' => 'Test', 'gender' => 'Male', 'date_of_birth' => '1990-01-01', 'contact_no' => '09123456789'];
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $pData, $cookieAdmin, ["X-CSRF-Token: $csrfAdmin"]);
    if ($res['status'] !== 201) return "Expected 201, got {$res['status']}";
    track_fixture('patients', $res['json']['data']['patient_id']);
    return true;
});

run_test("Receptionist is denied access to Admin patient management (list/view/edit/delete)", function() use ($baseUrl, $cookieRec, $csrfRec) {
    // Attempt List
    $resList = http_request('GET', "$baseUrl/api/patient_controller.php", null, $cookieRec);
    if ($resList['status'] !== 403) return "List: Expected 403, got {$resList['status']}";
    
    // Attempt Create
    $pData = ['first_name' => 'RecPat', 'last_name' => 'Test', 'gender' => 'Male', 'date_of_birth' => '1990-01-01'];
    $resCreate = http_request('POST', "$baseUrl/api/patient_controller.php", $pData, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($resCreate['status'] !== 403) return "Create: Expected 403, got {$resCreate['status']}";
    
    // Attempt Delete
    $resDel = http_request('DELETE', "$baseUrl/api/patient_controller.php?action=hard_delete&id=1", null, $cookieRec, ["X-CSRF-Token: $csrfRec"]);
    if ($resDel['status'] !== 403) return "Delete: Expected 403, got {$resDel['status']}";
    
    return true;
});

run_test("Admin patient management still works", function() use ($baseUrl, $cookieAdmin, $csrfAdmin) {
    $pData = ['first_name' => 'Admin2', 'last_name' => 'Test', 'gender' => 'Male', 'date_of_birth' => '1990-01-01'];
    $resCreate = http_request('POST', "$baseUrl/api/patient_controller.php", $pData, $cookieAdmin, ["X-CSRF-Token: $csrfAdmin"]);
    if ($resCreate['status'] !== 201) return "Admin create failed: {$resCreate['status']}";
    $patId = track_fixture('patients', $resCreate['json']['data']['patient_id']);
    
    $resList = http_request('GET', "$baseUrl/api/patient_controller.php?id=$patId", null, $cookieAdmin);
    if ($resList['status'] !== 200) return "Admin read failed: {$resList['status']}";
    
    return true;
});

echo "Total tests: $tests. Passed: $passed. Failed: " . ($tests - $passed) . ".\n";
