<?php
// tests/verify_appointment_pagination.php
// Verification test for Receptionist appointment pagination, filtering, and Doctor backward-compatibility.

require_once __DIR__ . '/../config/db_connect.php';

// Safety Guard: Refuse to run outside hospital_db_test
$currentDb = $pdo->query("SELECT DATABASE()")->fetchColumn();
if ($currentDb !== 'hospital_db_test') {
    die("ERROR: Safety Guard - tests must only target 'hospital_db_test'. Detected '{$currentDb}'. Blocked.\n");
}

$port = $argv[1] ?? 8088;
echo "Connecting to isolated API test server on port {$port}...\n";

function call_api($method, $path, $session_cookie = '', $data = null) {
    global $port;
    $url = 'http://127.0.0.1:' . $port . '/' . ltrim($path, '/');
    $csrf = $data['csrf_token'] ?? 'test_token';
    $headers = [
        'Content-Type: application/json',
        'X-Requested-With: XMLHttpRequest',
        'X-CSRF-Token: ' . $csrf
    ];
    if ($session_cookie) {
        $headers[] = 'Cookie: ' . $session_cookie;
    }

    $options = [
        'http' => [
            'method' => $method,
            'header' => $headers,
            'ignore_errors' => true
        ]
    ];
    if ($data !== null) {
        $options['http']['content'] = json_encode($data);
    }

    $context = stream_context_create($options);
    $response = @file_get_contents($url, false, $context);
    $status_line = $http_response_header[0] ?? '';
    preg_match('{HTTP\/\S*\s(\d{3})}', $status_line, $match);
    $status = (int)($match[1] ?? 0);

    return [
        'status' => $status,
        'body' => json_decode($response, true),
        'headers' => $http_response_header ?? []
    ];
}

function login($username, $password) {
    $res = call_api('POST', 'api/auth_controller.php?action=login', '', [
        'username' => $username,
        'password' => $password,
        'csrf_token' => 'test_token'
    ]);
    $cookie = '';
    if (!empty($res['headers'])) {
        foreach ($res['headers'] as $hdr) {
            if (preg_match('/^Set-Cookie:\s*(PHPSESSID=[^;]+)/i', $hdr, $m)) {
                $cookie = $m[1];
                break;
            }
        }
    }
    return $cookie;
}

// Track temporary appointments created by this test
$createdAppointmentIds = [];

register_shutdown_function(function() use (&$createdAppointmentIds, $pdo) {
    if (!empty($createdAppointmentIds)) {
        echo "Cleaning up " . count($createdAppointmentIds) . " test appointment fixtures...\n";
        $in = implode(',', array_map('intval', $createdAppointmentIds));
        $pdo->exec("DELETE FROM vital_signs WHERE appointment_id IN ($in)");
        $pdo->exec("DELETE FROM appointments WHERE appointment_id IN ($in)");
    }
});

// Seed additional appointments to test multi-page pagination if total < 12
$currentCount = (int)$pdo->query("SELECT COUNT(*) FROM appointments")->fetchColumn();
if ($currentCount < 12) {
    echo "- Seeding additional appointments for pagination tests...\n";
    $patId = (int)$pdo->query("SELECT patient_id FROM patients LIMIT 1")->fetchColumn();
    $docId = (int)$pdo->query("SELECT doctor_id FROM doctors LIMIT 1")->fetchColumn();
    $userId = (int)$pdo->query("SELECT user_id FROM users WHERE role_id = 2 LIMIT 1")->fetchColumn(); // Receptionist

    for ($i = $currentCount + 1; $i <= 12; $i++) {
        $ins = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status)
                             VALUES (?, ?, ?, '2026-11-15', '10:00:00', ?, ?)");
        $status = ($i % 2 === 0) ? 'confirmed' : 'scheduled';
        $ins->execute([$patId, $docId, $userId, "Pagination complaint {$i}", $status]);
        $createdAppointmentIds[] = (int)$pdo->lastInsertId();
    }
}

// Log in as Receptionist and Doctor
$recCookie = login('rec', 'Pass123!');
$docCookie = login('doc', 'Pass123!');
if (!$recCookie || !$docCookie) {
    die("Failed to login as rec or doc.\n");
}

echo "\n=== Testing Appointment Pagination (api/appointment_controller.php) ===\n";

// Test 1: Page 1 with page_size=5
echo "- Test 1: Paginated request (page=1, page_size=5)...\n";
$resP1 = call_api('GET', 'api/appointment_controller.php?page=1&page_size=5', $recCookie);
if ($resP1['status'] !== 200) {
    die("FAILED: Expected 200 for page 1, got {$resP1['status']}\n");
}
$data1 = $resP1['body']['data'] ?? [];
if (!isset($data1['total']) || !isset($data1['page']) || !isset($data1['page_size']) || !isset($data1['pages'])) {
    die("FAILED: Pagination metadata missing from response: " . json_encode($data1) . "\n");
}
if ($data1['page'] !== 1 || $data1['page_size'] !== 5 || count($data1['items']) !== 5) {
    die("FAILED: Expected page 1, page_size 5, items count 5. Got: " . json_encode($data1) . "\n");
}
echo "  [PASS] Page 1 returned exactly 5 items out of {$data1['total']} total (pages: {$data1['pages']}).\n";

// Test 2: Page 2 navigation
echo "- Test 2: Page 2 navigation (page=2, page_size=5)...\n";
$resP2 = call_api('GET', 'api/appointment_controller.php?page=2&page_size=5', $recCookie);
if ($resP2['status'] !== 200) {
    die("FAILED: Expected 200 for page 2, got {$resP2['status']}\n");
}
$data2 = $resP2['body']['data'] ?? [];
if ($data2['page'] !== 2 || count($data2['items']) !== 5) {
    die("FAILED: Expected page 2 with 5 items. Got: " . json_encode($data2) . "\n");
}
// Confirm items on page 1 and page 2 are different
$p1Ids = array_column($data1['items'], 'appointment_id');
$p2Ids = array_column($data2['items'], 'appointment_id');
if (!empty(array_intersect($p1Ids, $p2Ids))) {
    die("FAILED: Page 1 and Page 2 contain overlapping appointment IDs!\n");
}
echo "  [PASS] Page 2 returned distinct items without overlap.\n";

// Test 3: Invalid page sizes and bounds
echo "- Test 3: Bounded page sizes (negative/zero/excessive)...\n";
$resZero = call_api('GET', 'api/appointment_controller.php?page=0&page_size=-10', $recCookie);
$dataZero = $resZero['body']['data'] ?? [];
if ($dataZero['page'] < 1 || $dataZero['page_size'] < 1) {
    die("FAILED: Negative/zero values not bounded: " . json_encode($dataZero) . "\n");
}
echo "  [PASS] Page 0 and negative size correctly bounded (page: {$dataZero['page']}, page_size: {$dataZero['page_size']}).\n";

$resMax = call_api('GET', 'api/appointment_controller.php?page=1&page_size=500', $recCookie);
$dataMax = $resMax['body']['data'] ?? [];
if ($dataMax['page_size'] > 100) {
    die("FAILED: Excessive page size not bounded to 100: " . json_encode($dataMax) . "\n");
}
echo "  [PASS] Excessive page size bounded to {$dataMax['page_size']} (max 100).\n";

// Test 4: Server-side status filtering with pagination
echo "- Test 4: Status filter with pagination (status=confirmed)...\n";
$resStatus = call_api('GET', 'api/appointment_controller.php?status=confirmed&page=1&page_size=10', $recCookie);
$dataStatus = $resStatus['body']['data'] ?? [];
foreach ($dataStatus['items'] as $item) {
    if ($item['status'] !== 'confirmed') {
        die("FAILED: Filtered by confirmed but got status '{$item['status']}'\n");
    }
}
echo "  [PASS] All {$dataStatus['total']} returned items match status 'confirmed'.\n";

// Test 5: Server-side search filtering
echo "- Test 5: Search filtering (search=Pagination)...\n";
$resSearch = call_api('GET', 'api/appointment_controller.php?search=Pagination&page=1&page_size=10', $recCookie);
$dataSearch = $resSearch['body']['data'] ?? [];
if (empty($dataSearch['items'])) {
    die("FAILED: Expected search results for 'Pagination'\n");
}
echo "  [PASS] Search returned {$dataSearch['total']} matching records.\n";

// Test 6: Empty results handling
echo "- Test 6: Empty search results...\n";
$resEmpty = call_api('GET', 'api/appointment_controller.php?search=NonExistentQueryXYZ999&page=1&page_size=10', $recCookie);
$dataEmpty = $resEmpty['body']['data'] ?? [];
if ($dataEmpty['total'] !== 0 || !empty($dataEmpty['items']) || $dataEmpty['pages'] !== 1) {
    die("FAILED: Expected empty result structure: " . json_encode($dataEmpty) . "\n");
}
echo "  [PASS] Empty search results handled gracefully (total: 0, items: [], pages: 1).\n";

// Test 7: Doctor Dashboard KPI backward compatibility
echo "\n=== Testing Doctor KPI Consumer Compatibility ===\n";
echo "- Test 7: Doctor appointments call without pagination params...\n";
$resDoc = call_api('GET', 'api/appointment_controller.php', $docCookie);
if ($resDoc['status'] !== 200) {
    die("FAILED: Expected 200 for Doctor call, got {$resDoc['status']}\n");
}
$docData = $resDoc['body']['data'] ?? [];
$docItems = $docData['items'] ?? [];

// Calculate KPIs exactly like doctor_overview.js:
// today appointments (appointment_date == CURDATE())
// pending appointments (status in ['scheduled', 'confirmed'] on today)
$today = date('Y-m-d');
$todayAppts = array_filter($docItems, function($a) use ($today) {
    return $a['appointment_date'] === $today;
});
$pendingToday = array_filter($todayAppts, function($a) {
    return in_array($a['status'], ['scheduled', 'confirmed']);
});

$totalTodayCount = count($todayAppts);
$pendingTodayCount = count($pendingToday);

echo "  Doctor today appointments count: {$totalTodayCount}\n";
echo "  Doctor pending today count: {$pendingTodayCount}\n";

if ($totalTodayCount !== 3 || $pendingTodayCount !== 2) {
    die("FAILED: Expected Doctor KPI 3 today and 2 pending today, got {$totalTodayCount} and {$pendingTodayCount}!\n");
}
echo "  [PASS] Doctor 3-total / 2-pending today KPI behavior verified backward-compatible!\n";

echo "\nALL APPOINTMENT PAGINATION & KPI TESTS PASSED SUCCESSFULLY!\n";
