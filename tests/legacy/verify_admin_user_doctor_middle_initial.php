<?php
// tests/verify_admin_user_doctor_middle_initial.php
// Verification test for middle initial rule on Administrator User and Doctor CRUD.

require_once __DIR__ . '/../../config/db_connect.php';

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

function get_csrf_token($cookie) {
    $res = call_api('GET', 'api/auth_controller.php?action=me', $cookie);
    return $res['body']['data']['csrf_token'] ?? '';
}

// Track fixtures for deterministic cleanup
$createdUserIds = [];
$createdDoctorIds = [];

register_shutdown_function(function() use (&$createdUserIds, &$createdDoctorIds, $pdo) {
    if (!empty($createdDoctorIds)) {
        echo "Cleaning up " . count($createdDoctorIds) . " test doctor fixtures...\n";
        $in = implode(',', array_map('intval', $createdDoctorIds));
        $pdo->exec("DELETE FROM doctor_specialty WHERE doctor_id IN ($in)");
        $pdo->exec("DELETE FROM doctors WHERE doctor_id IN ($in)");
    }
    if (!empty($createdUserIds)) {
        echo "Cleaning up " . count($createdUserIds) . " test user fixtures...\n";
        $in = implode(',', array_map('intval', $createdUserIds));
        $pdo->exec("DELETE FROM users WHERE user_id IN ($in)");
    }
});

// Login as admin
$adminCookie = login('admin', 'Pass123!');
if (!$adminCookie) {
    die("Failed to login as admin. Ensure seed data was populated.\n");
}
$adminCsrf = get_csrf_token($adminCookie);

// Ensure at least one specialty exists
$specId = $pdo->query("SELECT specialty_id FROM specialties WHERE deleted_at IS NULL LIMIT 1")->fetchColumn();
if (!$specId) {
    $pdo->exec("INSERT INTO specialties (specialty_name) VALUES ('General Medicine')");
    $specId = $pdo->lastInsertId();
}

// ==========================================
// 1. ADMIN USER CREATE & UPDATE TESTS
// ==========================================
echo "\n=== Testing Admin User Middle Initial Rules (api/user_controller.php) ===\n";

// 1a. Empty middle initial accepted on User create
$uEmpty = [
    'first_name' => 'UserTest',
    'middle_initial' => '',
    'last_name' => 'EmptyMI_' . uniqid(),
    'gender' => 'Female',
    'username' => 'u_empty_' . uniqid(),
    'password' => 'Pass123!@#',
    'role_id' => 2, // Receptionist
    'csrf_token' => $adminCsrf
];
$resUEmpty = call_api('POST', 'api/user_controller.php', $adminCookie, $uEmpty);
if ($resUEmpty['status'] !== 201 || empty($resUEmpty['body']['data']['user_id'])) {
    die("FAILED: Expected 201 for empty user middle initial, got {$resUEmpty['status']} - " . json_encode($resUEmpty['body']) . "\n");
}
$testUserId = (int)$resUEmpty['body']['data']['user_id'];
$createdUserIds[] = $testUserId;
echo "  [PASS] Empty user middle initial accepted (ID {$testUserId}).\n";

// 1b. One letter middle initial accepted on User create
$uOne = [
    'first_name' => 'UserTest',
    'middle_initial' => 'R',
    'last_name' => 'OneMI_' . uniqid(),
    'gender' => 'Male',
    'username' => 'u_one_' . uniqid(),
    'password' => 'Pass123!@#',
    'role_id' => 2,
    'csrf_token' => $adminCsrf
];
$resUOne = call_api('POST', 'api/user_controller.php', $adminCookie, $uOne);
if ($resUOne['status'] !== 201 || empty($resUOne['body']['data']['user_id'])) {
    die("FAILED: Expected 201 for 1-letter user middle initial, got {$resUOne['status']} - " . json_encode($resUOne['body']) . "\n");
}
$createdUserIds[] = (int)$resUOne['body']['data']['user_id'];
echo "  [PASS] One-letter user middle initial accepted.\n";

// 1c. Multi-letter middle initial rejected on User create
$uMulti = [
    'first_name' => 'UserTest',
    'middle_initial' => 'ABC',
    'last_name' => 'MultiMI_' . uniqid(),
    'gender' => 'Male',
    'username' => 'u_multi_' . uniqid(),
    'password' => 'Pass123!@#',
    'role_id' => 2,
    'csrf_token' => $adminCsrf
];
$resUMulti = call_api('POST', 'api/user_controller.php', $adminCookie, $uMulti);
if ($resUMulti['status'] !== 422 || empty($resUMulti['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for multi-letter user middle initial, got {$resUMulti['status']} - " . json_encode($resUMulti['body']) . "\n");
}
echo "  [PASS] Multi-letter user middle initial rejected (422: {$resUMulti['body']['errors']['middle_initial']}).\n";

// 1d. Non-letter middle initial rejected on User create
$uNonLetter = [
    'first_name' => 'UserTest',
    'middle_initial' => '3',
    'last_name' => 'NonLetterMI_' . uniqid(),
    'gender' => 'Female',
    'username' => 'u_nonletter_' . uniqid(),
    'password' => 'Pass123!@#',
    'role_id' => 2,
    'csrf_token' => $adminCsrf
];
$resUNonLetter = call_api('POST', 'api/user_controller.php', $adminCookie, $uNonLetter);
if ($resUNonLetter['status'] !== 422 || empty($resUNonLetter['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for non-letter user middle initial, got {$resUNonLetter['status']} - " . json_encode($resUNonLetter['body']) . "\n");
}
echo "  [PASS] Non-letter user middle initial rejected (422: {$resUNonLetter['body']['errors']['middle_initial']}).\n";

// 1e. User update tests
$uEmpty['middle_initial'] = 'T';
$resUpOne = call_api('PUT', "api/user_controller.php?id={$testUserId}", $adminCookie, $uEmpty);
if ($resUpOne['status'] !== 200) {
    die("FAILED: Expected 200 for user update to 1-letter MI, got {$resUpOne['status']} - " . json_encode($resUpOne['body']) . "\n");
}
$dbMi = $pdo->query("SELECT middle_initial FROM users WHERE user_id = {$testUserId}")->fetchColumn();
if ($dbMi !== 'T') die("FAILED: User middle_initial not updated to 'T' in DB.\n");
echo "  [PASS] User update to one-letter middle initial succeeded and verified in DB.\n";

$uEmpty['middle_initial'] = 'INVALID';
$resUpMulti = call_api('PUT', "api/user_controller.php?id={$testUserId}", $adminCookie, $uEmpty);
if ($resUpMulti['status'] !== 422 || empty($resUpMulti['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for user update with multi-letter MI, got {$resUpMulti['status']} - " . json_encode($resUpMulti['body']) . "\n");
}
echo "  [PASS] User update to multi-letter middle initial rejected (422).\n";

$uEmpty['middle_initial'] = '$';
$resUpNonLetter = call_api('PUT', "api/user_controller.php?id={$testUserId}", $adminCookie, $uEmpty);
if ($resUpNonLetter['status'] !== 422 || empty($resUpNonLetter['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for user update with non-letter MI, got {$resUpNonLetter['status']} - " . json_encode($resUpNonLetter['body']) . "\n");
}
echo "  [PASS] User update to non-letter middle initial rejected (422).\n";

$uEmpty['middle_initial'] = '';
$resUpEmpty = call_api('PUT', "api/user_controller.php?id={$testUserId}", $adminCookie, $uEmpty);
if ($resUpEmpty['status'] !== 200) {
    die("FAILED: Expected 200 for user update to empty MI, got {$resUpEmpty['status']} - " . json_encode($resUpEmpty['body']) . "\n");
}
$dbMi = $pdo->query("SELECT middle_initial FROM users WHERE user_id = {$testUserId}")->fetchColumn();
if ($dbMi !== null && $dbMi !== '') die("FAILED: User middle_initial not cleared in DB.\n");
echo "  [PASS] User update to empty middle initial succeeded and verified in DB.\n";

// ==========================================
// 2. ADMIN DOCTOR CREATE & UPDATE TESTS
// ==========================================
echo "\n=== Testing Admin Doctor Middle Initial Rules (api/doctor_controller.php) ===\n";

// 2a. Empty middle initial accepted on Doctor create
$dEmpty = [
    'first_name' => 'DoctorTest',
    'middle_initial' => '',
    'last_name' => 'EmptyMI_' . uniqid(),
    'gender' => 'Male',
    'username' => 'doc_empty_' . uniqid(),
    'password' => 'Pass123!@#',
    'specialty_id' => [$specId],
    'contact_no' => '09173334455',
    'csrf_token' => $adminCsrf
];
$resDEmpty = call_api('POST', 'api/doctor_controller.php', $adminCookie, $dEmpty);
if ($resDEmpty['status'] !== 201 || empty($resDEmpty['body']['data']['doctor_id'])) {
    die("FAILED: Expected 201 for empty doctor middle initial, got {$resDEmpty['status']} - " . json_encode($resDEmpty['body']) . "\n");
}
$testDocId = (int)$resDEmpty['body']['data']['doctor_id'];
$createdDoctorIds[] = $testDocId;
$docUserId = (int)$pdo->query("SELECT user_id FROM doctors WHERE doctor_id = {$testDocId}")->fetchColumn();
$createdUserIds[] = $docUserId;
echo "  [PASS] Empty doctor middle initial accepted (Doctor ID {$testDocId}).\n";

// 2b. One letter middle initial accepted on Doctor create
$dOne = [
    'first_name' => 'DoctorTest',
    'middle_initial' => 'E',
    'last_name' => 'OneMI_' . uniqid(),
    'gender' => 'Female',
    'username' => 'doc_one_' . uniqid(),
    'password' => 'Pass123!@#',
    'specialty_id' => [$specId],
    'contact_no' => '09174445566',
    'csrf_token' => $adminCsrf
];
$resDOne = call_api('POST', 'api/doctor_controller.php', $adminCookie, $dOne);
if ($resDOne['status'] !== 201 || empty($resDOne['body']['data']['doctor_id'])) {
    die("FAILED: Expected 201 for 1-letter doctor middle initial, got {$resDOne['status']} - " . json_encode($resDOne['body']) . "\n");
}
$oneDocId = (int)$resDOne['body']['data']['doctor_id'];
$createdDoctorIds[] = $oneDocId;
$oneDocUserId = (int)$pdo->query("SELECT user_id FROM doctors WHERE doctor_id = {$oneDocId}")->fetchColumn();
$createdUserIds[] = $oneDocUserId;
echo "  [PASS] One-letter doctor middle initial accepted.\n";

// 2c. Multi-letter middle initial rejected on Doctor create
$dMulti = [
    'first_name' => 'DoctorTest',
    'middle_initial' => 'XYZ',
    'last_name' => 'MultiMI_' . uniqid(),
    'gender' => 'Male',
    'username' => 'doc_multi_' . uniqid(),
    'password' => 'Pass123!@#',
    'specialty_id' => [$specId],
    'contact_no' => '09175556677',
    'csrf_token' => $adminCsrf
];
$resDMulti = call_api('POST', 'api/doctor_controller.php', $adminCookie, $dMulti);
if ($resDMulti['status'] !== 422 || empty($resDMulti['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for multi-letter doctor middle initial, got {$resDMulti['status']} - " . json_encode($resDMulti['body']) . "\n");
}
echo "  [PASS] Multi-letter doctor middle initial rejected (422: {$resDMulti['body']['errors']['middle_initial']}).\n";

// 2d. Non-letter middle initial rejected on Doctor create
$dNonLetter = [
    'first_name' => 'DoctorTest',
    'middle_initial' => '8',
    'last_name' => 'NonLetterMI_' . uniqid(),
    'gender' => 'Female',
    'username' => 'doc_nonletter_' . uniqid(),
    'password' => 'Pass123!@#',
    'specialty_id' => [$specId],
    'contact_no' => '09176667788',
    'csrf_token' => $adminCsrf
];
$resDNonLetter = call_api('POST', 'api/doctor_controller.php', $adminCookie, $dNonLetter);
if ($resDNonLetter['status'] !== 422 || empty($resDNonLetter['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for non-letter doctor middle initial, got {$resDNonLetter['status']} - " . json_encode($resDNonLetter['body']) . "\n");
}
echo "  [PASS] Non-letter doctor middle initial rejected (422: {$resDNonLetter['body']['errors']['middle_initial']}).\n";

// 2e. Doctor update tests
$dEmpty['middle_initial'] = 'H';
$resDUpOne = call_api('PUT', "api/doctor_controller.php?id={$testDocId}", $adminCookie, $dEmpty);
if ($resDUpOne['status'] !== 200) {
    die("FAILED: Expected 200 for doctor update to 1-letter MI, got {$resDUpOne['status']} - " . json_encode($resDUpOne['body']) . "\n");
}
$dbDocMi = $pdo->query("SELECT middle_initial FROM users WHERE user_id = {$docUserId}")->fetchColumn();
if ($dbDocMi !== 'H') die("FAILED: Doctor middle_initial not updated to 'H' in DB.\n");
echo "  [PASS] Doctor update to one-letter middle initial succeeded and verified in DB.\n";

$dEmpty['middle_initial'] = 'LONG';
$resDUpMulti = call_api('PUT', "api/doctor_controller.php?id={$testDocId}", $adminCookie, $dEmpty);
if ($resDUpMulti['status'] !== 422 || empty($resDUpMulti['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for doctor update with multi-letter MI, got {$resDUpMulti['status']} - " . json_encode($resDUpMulti['body']) . "\n");
}
echo "  [PASS] Doctor update to multi-letter middle initial rejected (422).\n";

$dEmpty['middle_initial'] = '@';
$resDUpNonLetter = call_api('PUT', "api/doctor_controller.php?id={$testDocId}", $adminCookie, $dEmpty);
if ($resDUpNonLetter['status'] !== 422 || empty($resDUpNonLetter['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for doctor update with non-letter MI, got {$resDUpNonLetter['status']} - " . json_encode($resDUpNonLetter['body']) . "\n");
}
echo "  [PASS] Doctor update to non-letter middle initial rejected (422).\n";

$dEmpty['middle_initial'] = '';
$resDUpEmpty = call_api('PUT', "api/doctor_controller.php?id={$testDocId}", $adminCookie, $dEmpty);
if ($resDUpEmpty['status'] !== 200) {
    die("FAILED: Expected 200 for doctor update to empty MI, got {$resDUpEmpty['status']} - " . json_encode($resDUpEmpty['body']) . "\n");
}
$dbDocMi = $pdo->query("SELECT middle_initial FROM users WHERE user_id = {$docUserId}")->fetchColumn();
if ($dbDocMi !== null && $dbDocMi !== '') die("FAILED: Doctor middle_initial not cleared in DB.\n");
echo "  [PASS] Doctor update to empty middle initial succeeded and verified in DB.\n";

echo "\nALL ADMIN USER & DOCTOR MIDDLE INITIAL TESTS PASSED SUCCESSFULLY!\n";
