<?php
// tests/verify_improvements.php
// Automated Verification Suite for System Hardening, Audit Logging, and RBAC improvements

$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';
$cookieAdmin = tempnam(sys_get_temp_dir(), 'ck_adm_');
$cookieDoctor = tempnam(sys_get_temp_dir(), 'ck_doc_');
$cookieRecep = tempnam(sys_get_temp_dir(), 'ck_rec_');

$totalTests = 0;
$passedTests = 0;
$failedTests = 0;

function run_test(string $name, callable $fn): void {
    global $totalTests, $passedTests, $failedTests;
    $totalTests++;
    try {
        $result = $fn();
        if ($result === true) {
            echo " [PASS] $name\n";
            $passedTests++;
        } else {
            echo " [FAIL] $name: " . (is_string($result) ? $result : 'Assertion failed') . "\n";
            $failedTests++;
        }
    } catch (Throwable $e) {
        echo " [FAIL] $name with exception: " . $e->getMessage() . "\n";
        $failedTests++;
    }
}

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

    $json = json_decode($body, true);

    return [
        'status'  => $info['http_code'],
        'headers' => $rawHeader,
        'body'    => $body,
        'json'    => $json
    ];
}

echo "=======================================================\n";
echo "SYSTEM HARDENING & IMPROVEMENTS VERIFICATION SUITE\n";
echo "=======================================================\n\n";

// --- Authentication Setup ---
$adminLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'testadmin',
    'password' => 'TestPass123!'
], $cookieAdmin);
$adminMe = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieAdmin);
$adminCsrf = $adminMe['json']['data']['csrf_token'] ?? '';

$docLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'dr.house',
    'password' => 'DoctorPass123!'
], $cookieDoctor);
$docMe = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoctor);
$docCsrf = $docMe['json']['data']['csrf_token'] ?? '';

$recLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'recep.jane',
    'password' => 'RecepPass123!'
], $cookieRecep);
$recMe = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieRecep);
$recCsrf = $recMe['json']['data']['csrf_token'] ?? '';

echo "--- Group 1: Audit Log Security & Access Control ---\n";

run_test("1.1: Audit log endpoint returns 403 to Doctor role", function() use ($baseUrl, $cookieDoctor) {
    $res = http_request('GET', "$baseUrl/api/audit_log_controller.php", null, $cookieDoctor);
    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";
    return true;
});

run_test("1.2: Audit log endpoint returns 403 to Receptionist role", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/audit_log_controller.php", null, $cookieRecep);
    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";
    return true;
});

run_test("1.3: Audit log endpoint returns 200 with paginated items for Administrator", function() use ($baseUrl, $cookieAdmin) {
    $res = http_request('GET', "$baseUrl/api/audit_log_controller.php?limit=5", null, $cookieAdmin);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    if (!isset($res['json']['data']['items'])) return "Missing items in response";
    if (!isset($res['json']['data']['pagination']['current_page'])) return "Missing pagination metadata";
    return true;
});

run_test("1.4: Audit log rejects non-GET methods (POST, PUT, DELETE) with 405", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    $postRes = http_request('POST', "$baseUrl/api/audit_log_controller.php", ['data' => 1], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($postRes['status'] !== 405) return "Expected 405 for POST, got {$postRes['status']}";
    $delRes = http_request('DELETE', "$baseUrl/api/audit_log_controller.php", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($delRes['status'] !== 405) return "Expected 405 for DELETE, got {$delRes['status']}";
    return true;
});

echo "\n--- Group 2: Audit Trail Event Generation ---\n";

run_test("2.1: Authentication LOGIN event is recorded in audit_logs", function() {
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $stmt = $pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'LOGIN'");
    $count = (int)$stmt->fetchColumn();
    if ($count < 1) return "No LOGIN audit records found";
    return true;
});

run_test("2.2: Doctor CRUD actions write audit logs", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $activeSpecId = $pdo->query("SELECT specialty_id FROM specialties WHERE deleted_at IS NULL LIMIT 1")->fetchColumn();
    if (!$activeSpecId) return "No active specialties found in DB";

    // 1. Create a doctor
    $userSuffix = time();
    $create = http_request('POST', "$baseUrl/api/doctor_controller.php", [
        'first_name' => 'Audit',
        'last_name' => 'Doc' . $userSuffix,
        'gender' => 'Male',
        'username' => 'aud.doc.' . $userSuffix,
        'password' => 'DocPass123!',
        'contact_no' => '09112233445',
        'specialty_id' => $activeSpecId
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($create['status'] !== 201) return "Doctor creation failed: " . json_encode($create['json']);
    $docId = $create['json']['data']['doctor_id'];

    // Verify CREATE_DOCTOR in DB
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE action = 'CREATE_DOCTOR' AND entity_id = ?");
    $stmt->execute([$docId]);
    if ((int)$stmt->fetchColumn() === 0) return "CREATE_DOCTOR was not logged in audit_logs";

    // Clean up
    http_request('DELETE', "$baseUrl/api/doctor_controller.php?id=$docId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    return true;
});

echo "\n--- Group 3: Patient Demographic Integrity & Validation ---\n";

run_test("3.1: Patient validation rejects address longer than 255 characters", function() use ($baseUrl, $cookieRecep, $recCsrf) {
    $longAddress = str_repeat('A', 256);
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", [
        'first_name' => 'Address',
        'last_name' => 'Tester',
        'gender' => 'Female',
        'date_of_birth' => '1990-01-01',
        'contact_no' => '09123456789',
        'address' => $longAddress,
        'doctor_id' => 1,
        'appointment_date' => '2050-10-10',
        'appointment_time' => '14:00'
    ], $cookieRecep, ["X-CSRF-Token: $recCsrf"]);

    if ($res['status'] !== 422) return "Expected 422, got {$res['status']}";
    if (empty($res['json']['errors']['address'])) return "Expected address error in validation errors";
    return true;
});

run_test("3.2: Updating patient to collide with an existing patient's identity returns 409 Conflict", function() use ($baseUrl, $cookieRecep, $recCsrf) {
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    // Fetch two different existing patients
    $patients = $pdo->query("SELECT patient_id, first_name, last_name, date_of_birth, contact_no FROM patients WHERE deleted_at IS NULL LIMIT 2")->fetchAll();
    if (count($patients) < 2) return "Need at least 2 patients to verify duplicate update protection";

    $targetPatient = $patients[0];
    $otherPatient = $patients[1];

    // Attempt to rename targetPatient to match otherPatient exactly
    $res = http_request('PUT', "$baseUrl/api/patient_controller.php?id={$targetPatient['patient_id']}", [
        'first_name' => $otherPatient['first_name'],
        'last_name' => $otherPatient['last_name'],
        'gender' => 'Female',
        'date_of_birth' => $otherPatient['date_of_birth'],
        'contact_no' => '09998887766'
    ], $cookieRecep, ["X-CSRF-Token: $recCsrf"]);

    if ($res['status'] !== 409) return "Expected 409 Conflict on duplicate update collision, got {$res['status']}: " . json_encode($res['json']);
    return true;
});

run_test("3.3: Administrator cannot edit patient demographics via appointment_patient_controller (403)", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    $res = http_request('PUT', "$baseUrl/api/appointment_patient_controller.php?appointment_id=1", [
        'first_name' => 'AdminEdited',
        'last_name' => 'ShouldFail',
        'gender' => 'Male',
        'date_of_birth' => '1990-01-01',
        'contact_no' => '09123456789'
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($res['status'] !== 403) return "Expected 403 for Admin updating patient, got {$res['status']}";
    return true;
});

echo "\n--- Group 4: SQL Error Leakage Guard ---\n";

run_test("4.1: Database errors return generic message without raw SQL leakage in 500 responses", function() use ($baseUrl, $cookieAdmin) {
    // Hit controllers with malformed request that triggers error handling
    $controllers = [
        'api/appointment_controller.php?id=invalid_id',
        'api/medication_controller.php?id=invalid_id',
        'api/patient_record_controller.php?patient_id=999999999'
    ];

    foreach ($controllers as $url) {
        $res = http_request('GET', "$baseUrl/$url", null, $cookieAdmin);
        $body = $res['body'];
        if (stripos($body, 'SQLSTATE') !== false || stripos($body, 'syntax error') !== false || stripos($body, 'table') !== false && stripos($body, 'doesn\'t exist') !== false) {
            return "Raw SQL leakage detected in $url: $body";
        }
    }
    return true;
});

// Clean up cookies
@unlink($cookieAdmin);
@unlink($cookieDoctor);
@unlink($cookieRecep);

echo "\n=======================================================\n";
echo "TEST RESULTS: $passedTests / $totalTests Passed\n";
echo "=======================================================\n";

if ($failedTests > 0) {
    exit(1);
}
exit(0);
