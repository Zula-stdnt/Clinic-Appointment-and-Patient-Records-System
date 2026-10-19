<?php
require_once __DIR__ . '/../../config/db_connect.php';

// 1. Database Safety Guard
if ($pdo->query("SELECT DATABASE()")->fetchColumn() !== 'hospital_db_test') {
    die("ERROR: Safety Guard - tests must only target 'hospital_db_test'. Default fallback detected and blocked.\n");
}

$port = $argv[1] ?? 8088;
function call_api($method, $path, $session_cookie = '', $data = null) {
    global $port;
    $url = 'http://127.0.0.1:' . $port . '/' . ltrim($path, '/');
    $options = [
        'http' => [
            'method' => $method,
            'header' => [
                'Cookie: ' . $session_cookie,
                'Content-Type: application/json',
                'X-Requested-With: XMLHttpRequest',
                'X-CSRF-Token: ' . ($data['csrf_token'] ?? 'test_token')
            ],
            'ignore_errors' => true
        ]
    ];
    if ($data !== null) {
        $options['http']['content'] = json_encode($data);
    }
    
    $context = stream_context_create($options);
    $response = file_get_contents($url, false, $context);
    
    $status_line = $http_response_header[0] ?? '';
    preg_match('{HTTP\/\S*\s(\d{3})}', $status_line, $match);
    $status = $match[1] ?? 0;

    return ['status' => (int)$status, 'body' => json_decode($response, true), 'headers' => $http_response_header];
}

echo "Starting tests for api/appointment_patient_controller.php...\n";

// Login helpers
function login($username, $password) {
    $res = call_api('POST', 'api/auth_controller.php?action=login', '', ['username' => $username, 'password' => $password, 'csrf_token' => 'test_token']);
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

// Ensure seed data exists
echo "- Verifying seed data...\n";
$rec_cookie = login('rec', 'Pass123!');
$doc_cookie = login('doc', 'Pass123!');
if (!$rec_cookie || !$doc_cookie) die("Failed to login as rec or doc. Ensure seed.php was run.\n");

$rec_csrf = get_csrf_token($rec_cookie);
$doc_csrf = get_csrf_token($doc_cookie);

// Test 1: Doctor Denial
echo "- Test 1: Doctor denial (403)...\n";
$res = call_api('GET', 'api/appointment_patient_controller.php?appointment_id=1', $doc_cookie);
if ($res['status'] !== 403) die("Expected 403 for Doctor, got {$res['status']}\n");

// Test 2: Missing or invalid appointment ID
echo "- Test 2: Missing appointment ID (400)...\n";
$res = call_api('GET', 'api/appointment_patient_controller.php', $rec_cookie);
if ($res['status'] !== 400) die("Expected 400 for missing ID, got {$res['status']}\n");

$res = call_api('GET', 'api/appointment_patient_controller.php?appointment_id=-1', $rec_cookie);
if ($res['status'] !== 400) die("Expected 400 for invalid ID, got {$res['status']}\n");

// Test 3: Terminal appointment restrictions
echo "- Test 3: Terminal appointment restrictions (403 on PUT)...\n";
// ID 3 is completed in our seed data
$res = call_api('PUT', 'api/appointment_patient_controller.php?appointment_id=3', $rec_cookie, [
    'first_name' => 'John', 'last_name' => 'Doe', 'gender' => 'Male', 'date_of_birth' => '1990-01-01', 'contact_no' => '09123456789', 'csrf_token' => $rec_csrf
]);
if ($res['status'] !== 403) die("Expected 403 for terminal appointment update, got {$res['status']}\n");

// Test 4: Linkage reading/updating
echo "- Test 4: Correct linkage to appointment patient...\n";
// Read appointment 1
$res = call_api('GET', 'api/appointment_patient_controller.php?appointment_id=1', $rec_cookie);
if ($res['status'] !== 200 || $res['body']['data']['first_name'] !== 'John') {
    die("Expected 200 and John for patient data, got " . json_encode($res) . "\n");
}

// Update appointment 1
$res = call_api('PUT', 'api/appointment_patient_controller.php?appointment_id=1', $rec_cookie, [
    'first_name' => 'Johnny', 'last_name' => 'Doe', 'gender' => 'Male', 'date_of_birth' => '1990-01-01', 'contact_no' => '09123456789', 'csrf_token' => $rec_csrf
]);
if ($res['status'] !== 200) die("Expected 200 for valid update, got " . json_encode($res) . "\n");

// Verify DB updated
$stmt = $pdo->query("SELECT first_name FROM patients WHERE patient_id = 1");
if ($stmt->fetchColumn() !== 'Johnny') die("Database was not updated correctly!\n");

// Restore patient 1
$pdo->exec("UPDATE patients SET first_name = 'John' WHERE patient_id = 1");

echo "All tests passed successfully.\n";
