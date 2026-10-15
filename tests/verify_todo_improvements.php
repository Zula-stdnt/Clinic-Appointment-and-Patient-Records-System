<?php
// tests/verify_todo_improvements.php
// Automated Verification Suite for the 4 To-Do System Improvements via HTTP & DB

$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';
$cookieAdmin = tempnam(sys_get_temp_dir(), 'ck_adm_');
$cookieDoctor = tempnam(sys_get_temp_dir(), 'ck_doc_');
$cookieRecep = tempnam(sys_get_temp_dir(), 'ck_rec_');

require_once __DIR__ . '/../config/db_connect.php';

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
echo "TO-DO LIST SYSTEM IMPROVEMENTS VERIFICATION SUITE\n";
echo "=======================================================\n\n";

// --- Authenticate users ---
$adminLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'testadmin',
    'password' => 'TestPass123!'
], $cookieAdmin);
$adminMe = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieAdmin);

$docLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'dr.house',
    'password' => 'DoctorPass123!'
], $cookieDoctor);
$docMe = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoctor);

$recLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'recep.jane',
    'password' => 'RecepPass123!'
], $cookieRecep);
$recMe = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieRecep);

echo "--- 1. Receptionist Patient Pre-population Endpoint ---\n";

run_test("1.1: GET patient_controller.php?id= returns 200 with both flat and nested properties", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/patient_controller.php?id=2", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $json = $res['json'];
    if (!($json['success'] ?? false)) return "Expected success=true";
    $data = $json['data'] ?? [];
    if (empty($data['first_name'])) return "Expected non-empty data.first_name";
    if (empty($data['patient']['first_name'])) return "Expected non-empty data.patient.first_name";
    if (empty($data['date_of_birth'])) return "Expected non-empty data.date_of_birth";
    if (empty($data['gender'])) return "Expected non-empty data.gender";
    return true;
});

echo "\n--- 2. Receptionist Clinical Privacy Enforcement ---\n";

run_test("2.1: Receptionist requesting patient history gets demographics but ZERO clinical encounters", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/patient_record_controller.php?action=history&patient_id=2", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $data = $res['json']['data'] ?? [];
    if (empty($data['patient'])) return "Expected demographic patient object";
    if (!empty($data['encounters'])) return "Clinical encounters exposed to receptionist!";
    return true;
});

echo "\n--- 3. Universal Doctor Directory & Assignment Indicator ---\n";

run_test("3.1: Doctor can browse all hospital patients in doctor_patients_controller.php", function() use ($baseUrl, $cookieDoctor) {
    $res = http_request('GET', "$baseUrl/api/doctor_patients_controller.php?action=list&page=1&page_size=50", null, $cookieDoctor);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $items = $res['json']['data']['items'] ?? [];
    if (count($items) === 0) return "Expected hospital patients in directory";
    foreach ($items as $item) {
        if (!array_key_exists('is_assigned', $item)) return "Missing is_assigned indicator";
        if (!is_bool($item['is_assigned'])) return "is_assigned must be boolean";
    }
    return true;
});

echo "\n--- 4. Doctor Access Boundary & Break-Glass Protocol ---\n";

// Get doctor_id for dr.house
$doctorUserId = (int)($docMe['json']['data']['user']['user_id'] ?? 0);
$stmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
$stmt->execute([$doctorUserId]);
$houseDocId = (int)$stmt->fetchColumn();

// Find an unassigned patient without an active access grant
$stmt = $pdo->prepare("
    SELECT p.patient_id FROM patients p
    WHERE p.deleted_at IS NULL
      AND p.patient_id NOT IN (
          SELECT a.patient_id FROM appointments a WHERE a.doctor_id = ? AND a.status != 'cancelled'
      )
      AND p.patient_id NOT IN (
          SELECT rar.patient_id FROM record_access_requests rar WHERE rar.doctor_id = ? AND rar.status = 'approved' AND rar.expires_at > NOW()
      )
    LIMIT 1
");
$stmt->execute([$houseDocId, $houseDocId]);
$unassignedPid = (int)$stmt->fetchColumn();

if (!$unassignedPid) {
    $pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth, contact_no, address) VALUES ('Emergency', 'Case', 'Female', '1998-04-12', '09171112233', 'Emergency ER Bay 1')");
    $unassignedPid = (int)$pdo->lastInsertId();
}

run_test("4.1: Doctor accessing unassigned patient without break-glass is blocked with 403 & break_glass_required", function() use ($baseUrl, $cookieDoctor, $unassignedPid) {
    $res = http_request('GET', "$baseUrl/api/patient_record_controller.php?action=history&patient_id=$unassignedPid", null, $cookieDoctor);
    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";
    $err = $res['json']['errors'] ?? [];
    if (!($err['break_glass_required'] ?? false)) return "Expected errors.break_glass_required = true";
    return true;
});

run_test("4.2: Doctor break-glass with justification < 10 characters is rejected with 403", function() use ($baseUrl, $cookieDoctor, $unassignedPid) {
    $url = "$baseUrl/api/patient_record_controller.php?action=history&patient_id=$unassignedPid&break_glass=true&break_glass_reason=Urgent";
    $res = http_request('GET', $url, null, $cookieDoctor);
    if ($res['status'] !== 403) return "Expected 403, got {$res['status']}";
    return true;
});

$testReason = "Acute severe myocardial infarction in ER trauma unit";

run_test("4.3: Doctor break-glass with justification >= 10 characters succeeds with 200 & is_break_glass=true", function() use ($baseUrl, $cookieDoctor, $unassignedPid, $testReason) {
    $url = "$baseUrl/api/patient_record_controller.php?action=history&patient_id=$unassignedPid&break_glass=true&break_glass_reason=" . urlencode($testReason);
    $res = http_request('GET', $url, null, $cookieDoctor);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $data = $res['json']['data'] ?? [];
    if (!($data['is_break_glass'] ?? false)) return "Expected data.is_break_glass = true";
    return true;
});

run_test("4.4: Break-Glass event is permanently recorded in audit_logs with exact justification", function() use ($pdo, $docMe, $unassignedPid, $testReason) {
    $userId = (int)($docMe['json']['data']['user']['user_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM audit_logs WHERE action = 'BREAK_GLASS_ACCESS' AND user_id = ? AND entity_id = ? ORDER BY log_id DESC LIMIT 1");
    $stmt->execute([$userId, $unassignedPid]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return "No audit log entry found for BREAK_GLASS_ACCESS";
    if (($row['reason'] ?? '') !== $testReason) return "Audit reason does not match justification: " . ($row['reason'] ?? 'null');
    return true;
});

run_test("4.5: Administrator can retrieve Break-Glass audit entries in audit_log_controller.php", function() use ($baseUrl, $cookieAdmin, $testReason) {
    $res = http_request('GET', "$baseUrl/api/audit_log_controller.php?action_filter=BREAK_GLASS_ACCESS", null, $cookieAdmin);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $items = $res['json']['data']['items'] ?? [];
    if (empty($items)) return "Expected at least 1 Break-Glass audit item";
    $found = false;
    foreach ($items as $item) {
        if ($item['action'] === 'BREAK_GLASS_ACCESS' && str_contains($item['reason'] ?? '', 'myocardial infarction')) {
            $found = true;
            break;
        }
    }
    if (!$found) return "Did not find expected Break-Glass log entry in admin view";
    return true;
});

echo "\n=======================================================\n";
echo "SUMMARY: Total: $totalTests | Passed: $passedTests | Failed: $failedTests\n";
echo "=======================================================\n";

if ($failedTests === 0) {
    echo "🎉 ALL TESTS PASSED!\n";
    exit(0);
} else {
    echo "❌ SOME TESTS FAILED.\n";
    exit(1);
}
