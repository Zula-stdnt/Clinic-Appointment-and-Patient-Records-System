<?php
// tests/verify_admin_patient_middle_initial.php
// Verification test for middle initial rule on Administrator patient create/edit
// and maintaining role boundaries across Receptionist / Doctor roles.

require_once __DIR__ . '/../config/db_connect.php';

// 1. Database Safety Guard
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

// Track created patient IDs for reliable cleanup
$createdPatientIds = [];

register_shutdown_function(function() use (&$createdPatientIds, $pdo) {
    if (!empty($createdPatientIds)) {
        echo "Cleaning up " . count($createdPatientIds) . " test patient fixtures...\n";
        $in = implode(',', array_map('intval', $createdPatientIds));
        $pdo->exec("DELETE FROM patients WHERE patient_id IN ($in)");
    }
});

// Authenticate users
echo "- Logging in users (Admin, Receptionist, Doctor)...\n";
$adminCookie = login('admin', 'Pass123!');
$recCookie = login('rec', 'Pass123!');
$docCookie = login('doc', 'Pass123!');

if (!$adminCookie || !$recCookie || !$docCookie) {
    die("Failed to login all roles. Ensure seed data was populated in hospital_db_test.\n");
}

$adminCsrf = get_csrf_token($adminCookie);
$recCsrf = get_csrf_token($recCookie);

// Test 1: Role Permissions on api/patient_controller.php
echo "- Test 1: Role Permissions on api/patient_controller.php...\n";
$docAccess = call_api('GET', 'api/patient_controller.php', $docCookie);
if ($docAccess['status'] !== 403) {
    die("FAILED: Expected 403 for Doctor on patient_controller, got {$docAccess['status']}\n");
}

$recAccess = call_api('GET', 'api/patient_controller.php', $recCookie);
if ($recAccess['status'] !== 200) {
    die("FAILED: Expected 200 for Receptionist on patient_controller, got {$recAccess['status']}\n");
}

$adminAccess = call_api('GET', 'api/patient_controller.php', $adminCookie);
if ($adminAccess['status'] !== 200) {
    die("FAILED: Expected 200 for Admin on patient_controller, got {$adminAccess['status']}\n");
}

// Verify Admin direct patient creation is blocked (Priority 1)
$adminCreateRes = call_api('POST', 'api/patient_controller.php', $adminCookie, [
    'first_name' => 'Admin', 'last_name' => 'Denied', 'gender' => 'Male', 'date_of_birth' => '1990-01-01', 'csrf_token' => $adminCsrf
]);
if ($adminCreateRes['status'] !== 403) {
    die("FAILED: Expected 403 for Admin patient creation, got {$adminCreateRes['status']}\n");
}
echo "  [PASS] Role permissions verified.\n";

// Test 2: Patient Creation - Middle Initial Rules (Front desk / Receptionist)
echo "- Test 2: Patient creation middle initial rules...\n";

// 2a. Empty middle initial accepted
$pEmpty = [
    'first_name' => 'PatTest',
    'middle_initial' => '',
    'last_name' => 'EmptyMI_' . uniqid(),
    'gender' => 'Male',
    'date_of_birth' => '1990-05-15',
    'contact_no' => '09171112233',
    'address' => '123 Test St',
    'csrf_token' => $recCsrf
];
$resEmpty = call_api('POST', 'api/patient_controller.php', $recCookie, $pEmpty);
if ($resEmpty['status'] !== 201 || empty($resEmpty['body']['data']['patient_id'])) {
    die("FAILED: Expected 201 for empty middle initial, got {$resEmpty['status']} - " . json_encode($resEmpty['body']) . "\n");
}
$createdPatientIds[] = (int)$resEmpty['body']['data']['patient_id'];
$testPatId = (int)$resEmpty['body']['data']['patient_id'];
echo "  [PASS] Empty middle initial accepted (created ID {$testPatId}).\n";

// 2b. One letter middle initial accepted
$pOne = [
    'first_name' => 'PatTest',
    'middle_initial' => 'K',
    'last_name' => 'OneMI_' . uniqid(),
    'gender' => 'Female',
    'date_of_birth' => '1992-08-20',
    'contact_no' => '09182223344',
    'address' => '456 Test Ave',
    'csrf_token' => $recCsrf
];
$resOne = call_api('POST', 'api/patient_controller.php', $recCookie, $pOne);
if ($resOne['status'] !== 201 || empty($resOne['body']['data']['patient_id'])) {
    die("FAILED: Expected 201 for one-letter middle initial, got {$resOne['status']} - " . json_encode($resOne['body']) . "\n");
}
$createdPatientIds[] = (int)$resOne['body']['data']['patient_id'];
echo "  [PASS] One-letter middle initial accepted.\n";

// 2c. Multi-letter middle initial rejected
$pMulti = [
    'first_name' => 'PatTest',
    'middle_initial' => 'ABC',
    'last_name' => 'MultiMI_' . uniqid(),
    'gender' => 'Male',
    'date_of_birth' => '1995-01-01',
    'contact_no' => '09193334455',
    'address' => '789 Test Rd',
    'csrf_token' => $recCsrf
];
$resMulti = call_api('POST', 'api/patient_controller.php', $recCookie, $pMulti);
if ($resMulti['status'] !== 422 || empty($resMulti['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 with middle_initial error for multi-letter, got {$resMulti['status']} - " . json_encode($resMulti['body']) . "\n");
}
echo "  [PASS] Multi-letter middle initial rejected (422: {$resMulti['body']['errors']['middle_initial']}).\n";

// 2d. Non-letter middle initial rejected
$pNonLetter = [
    'first_name' => 'PatTest',
    'middle_initial' => '5',
    'last_name' => 'NumMI_' . uniqid(),
    'gender' => 'Female',
    'date_of_birth' => '1998-03-12',
    'contact_no' => '09204445566',
    'address' => '321 Test Blvd',
    'csrf_token' => $recCsrf
];
$resNonLetter = call_api('POST', 'api/patient_controller.php', $recCookie, $pNonLetter);
if ($resNonLetter['status'] !== 422 || empty($resNonLetter['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 with middle_initial error for non-letter, got {$resNonLetter['status']} - " . json_encode($resNonLetter['body']) . "\n");
}
echo "  [PASS] Non-letter middle initial rejected (422: {$resNonLetter['body']['errors']['middle_initial']}).\n";

// Test 3: Patient Update - Middle Initial Rules (Front desk / Receptionist)
echo "- Test 3: Patient update middle initial rules...\n";

// 3a. Update to one letter accepted
$updateData = [
    'first_name' => 'PatTest',
    'middle_initial' => 'M',
    'last_name' => 'UpdatedMI',
    'gender' => 'Male',
    'date_of_birth' => '1990-05-15',
    'contact_no' => '09171112233',
    'address' => '123 Test St',
    'csrf_token' => $recCsrf
];
$resUpOne = call_api('PUT', "api/patient_controller.php?id={$testPatId}", $recCookie, $updateData);
if ($resUpOne['status'] !== 200) {
    die("FAILED: Expected 200 for update to one-letter MI, got {$resUpOne['status']} - " . json_encode($resUpOne['body']) . "\n");
}
$chk = $pdo->query("SELECT middle_initial FROM patients WHERE patient_id = {$testPatId}")->fetchColumn();
if ($chk !== 'M') {
    die("FAILED: Database middle_initial was not updated to 'M', got '{$chk}'\n");
}
echo "  [PASS] Update to one-letter middle initial succeeded and verified in DB.\n";

// 3b. Update to empty middle initial accepted
$updateData['middle_initial'] = '';
$resUpEmpty = call_api('PUT', "api/patient_controller.php?id={$testPatId}", $recCookie, $updateData);
if ($resUpEmpty['status'] !== 200) {
    die("FAILED: Expected 200 for update to empty MI, got {$resUpEmpty['status']} - " . json_encode($resUpEmpty['body']) . "\n");
}
$chkEmpty = $pdo->query("SELECT middle_initial FROM patients WHERE patient_id = {$testPatId}")->fetchColumn();
if ($chkEmpty !== null && $chkEmpty !== '') {
    die("FAILED: Database middle_initial was not cleared, got '{$chkEmpty}'\n");
}
echo "  [PASS] Update to empty middle initial succeeded and verified in DB.\n";

// 3c. Update to multi-letter rejected
$updateData['middle_initial'] = 'XYZ';
$resUpMulti = call_api('PUT', "api/patient_controller.php?id={$testPatId}", $recCookie, $updateData);
if ($resUpMulti['status'] !== 422 || empty($resUpMulti['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 with middle_initial error for multi-letter update, got {$resUpMulti['status']} - " . json_encode($resUpMulti['body']) . "\n");
}
echo "  [PASS] Update to multi-letter middle initial rejected (422).\n";

// 3d. Update to non-letter rejected
$updateData['middle_initial'] = '#';
$resUpNonLetter = call_api('PUT', "api/patient_controller.php?id={$testPatId}", $recCookie, $updateData);
if ($resUpNonLetter['status'] !== 422 || empty($resUpNonLetter['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 with middle_initial error for non-letter update, got {$resUpNonLetter['status']} - " . json_encode($resUpNonLetter['body']) . "\n");
}
echo "  [PASS] Update to non-letter middle initial rejected (422).\n";

// Test 4: Existing Walk-in Behavior and Receptionist Permissions Preserved
echo "- Test 4: Existing Receptionist walk-in endpoint middle initial enforcement...\n";
$walkinPayload = [
    'first_name' => 'WalkinTest',
    'middle_initial' => 'Z',
    'last_name' => 'Patient_' . uniqid(),
    'gender' => 'Male',
    'date_of_birth' => '1999-09-09',
    'contact_no' => '09179998877',
    'address' => 'Front Desk Walk-in St',
    'csrf_token' => $recCsrf
];
$resWalkin = call_api('POST', 'api/walkin_patient_controller.php', $recCookie, $walkinPayload);
if ($resWalkin['status'] !== 201 || empty($resWalkin['body']['data']['patient_id'])) {
    die("FAILED: Expected 201 for valid Receptionist walk-in, got {$resWalkin['status']} - " . json_encode($resWalkin['body']) . "\n");
}
$createdPatientIds[] = (int)$resWalkin['body']['data']['patient_id'];
echo "  [PASS] Receptionist walk-in registration with valid 1-letter MI accepted.\n";

$walkinPayload['middle_initial'] = 'INVALID';
$resWalkinInv = call_api('POST', 'api/walkin_patient_controller.php', $recCookie, $walkinPayload);
if ($resWalkinInv['status'] !== 422 || empty($resWalkinInv['body']['errors']['middle_initial'])) {
    die("FAILED: Expected 422 for Receptionist walk-in with invalid MI, got {$resWalkinInv['status']} - " . json_encode($resWalkinInv['body']) . "\n");
}
echo "  [PASS] Receptionist walk-in registration with invalid MI rejected (422).\n";

echo "ALL ADMIN PATIENT MIDDLE INITIAL TESTS PASSED SUCCESSFULLY!\n";
