<?php
// tests/verify_clinic_schedule_capacity.php
// Verification test for Clinic Schedule Rules (No Sundays, Hours 08:00-17:00, Lunch 12:00-12:59)
// and Daily Clinic Capacity (Max 10 active appointments clinic-wide per day, warn at 8, 9, 10, cancelled/no-show capacity release).

require_once __DIR__ . '/../config/db_connect.php';

// Safety Guard: Refuse to run outside hospital_db_test
$currentDb = $pdo->query("SELECT DATABASE()")->fetchColumn();
if ($currentDb !== 'hospital_db_test') {
    die("ERROR: Safety Guard - tests must only target 'hospital_db_test'. Detected '{$currentDb}'. Blocked.\n");
}

$port = $argv[1] ?? 8088;
echo "Connecting to isolated API test server on port {$port}...\n";

$recCsrf = '';

function call_api($method, $path, $session_cookie = '', $data = null, $csrf_token = '') {
    global $port, $recCsrf;
    $url = 'http://127.0.0.1:' . $port . '/' . ltrim($path, '/');
    $csrf = $csrf_token ?: ($data['csrf_token'] ?? $recCsrf ?? 'test_token');
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

// Track temporary fixtures created by this test for cleanup
$createdAppointmentIds = [];
$createdDoctorIds = [];
$createdUserIds = [];

register_shutdown_function(function() use (&$createdAppointmentIds, &$createdDoctorIds, &$createdUserIds, $pdo) {
    if (!empty($createdAppointmentIds)) {
        echo "Cleaning up " . count($createdAppointmentIds) . " test appointment fixtures...\n";
        $in = implode(',', array_map('intval', $createdAppointmentIds));
        $pdo->exec("DELETE FROM vital_signs WHERE appointment_id IN ($in)");
        $pdo->exec("DELETE FROM appointments WHERE appointment_id IN ($in)");
    }
    if (!empty($createdDoctorIds)) {
        $inDocs = implode(',', array_map('intval', $createdDoctorIds));
        $pdo->exec("DELETE FROM doctor_specialty WHERE doctor_id IN ($inDocs)");
        $pdo->exec("DELETE FROM doctors WHERE doctor_id IN ($inDocs)");
    }
    if (!empty($createdUserIds)) {
        $inUsers = implode(',', array_map('intval', $createdUserIds));
        $pdo->exec("DELETE FROM users WHERE user_id IN ($inUsers)");
    }
});

echo "Authenticating as receptionist...\n";
$cookie = login('rec', 'Pass123!');
if (!$cookie) {
    die("FATAL: Failed to authenticate as receptionist.\n");
}
$recCsrf = get_csrf_token($cookie);
if (!$recCsrf) {
    die("FATAL: Failed to retrieve CSRF token for receptionist.\n");
}

// Fetch doctor and patient IDs from DB
$allDoctors = $pdo->query("SELECT doctor_id FROM doctors WHERE deleted_at IS NULL ORDER BY doctor_id ASC")->fetchAll(PDO::FETCH_COLUMN);
if (count($allDoctors) < 2) {
    // Insert a second doctor for multi-doctor capacity testing
    $doc2Pass = password_hash('Pass123!', PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (username, password_hash, first_name, last_name, role_id) VALUES ('doc2_test', '$doc2Pass', 'Jane', 'Smith', 3)");
    $doc2UserId = (int)$pdo->lastInsertId();
    $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($doc2UserId, '09991234567')");
    $doc2Id = (int)$pdo->lastInsertId();
    $allDoctors[] = $doc2Id;
    $createdDoctorIds[] = $doc2Id;
    $createdUserIds[] = $doc2UserId;
}

$doctorId = (int)$allDoctors[0];
$doctor2Id = (int)$allDoctors[1];
$patientId = (int)$pdo->query("SELECT patient_id FROM patients WHERE deleted_at IS NULL LIMIT 1")->fetchColumn();

if (!$doctorId || !$patientId) {
    die("FATAL: No active doctor or patient available in test database.\n");
}

echo "Using doctor_id={$doctorId}, doctor2_id={$doctor2Id}, patient_id={$patientId}\n";

$passCount = 0;
function assert_test($description, $condition, $details = '') {
    global $passCount;
    if ($condition) {
        echo "  [PASS] {$description}\n";
        $passCount++;
    } else {
        echo "  [FAIL] {$description} - Details: {$details}\n";
        exit(1);
    }
}

echo "\n--- 1. Clinic Schedule Rules (Create) ---\n";

// A. Sunday rejection
$sunday = '2026-11-08'; // 2026-11-08 is a Sunday
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $sunday,
    'appointment_time' => '10:00',
    'chief_complaint' => 'Sunday check'
]);
assert_test("Sunday appointment is rejected with 422", $res['status'] === 422, "Status: " . $res['status'] . ", body: " . json_encode($res['body']));
assert_test("Sunday error message mentions Sunday", stripos($res['body']['errors']['appointment_date'] ?? '', 'Sunday') !== false);

// B. Time before 08:00
$monday = '2026-11-09'; // 2026-11-09 is a Monday
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '07:30',
    'chief_complaint' => 'Early visit'
]);
assert_test("Time before 08:00 is rejected with 422", $res['status'] === 422);
assert_test("Time before 08:00 error mentions 08:00", stripos($res['body']['errors']['appointment_time'] ?? '', '08:00') !== false);

// C. Time after 17:00
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '17:30',
    'chief_complaint' => 'Late visit'
]);
assert_test("Time after 17:00 is rejected with 422", $res['status'] === 422);
assert_test("Time after 17:00 error mentions 17:00", stripos($res['body']['errors']['appointment_time'] ?? '', '17:00') !== false);

// D. Lunch closure (12:00 - 12:59)
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '12:00',
    'chief_complaint' => 'Lunch visit'
]);
assert_test("Time at 12:00 (lunch) is rejected with 422", $res['status'] === 422);
assert_test("Lunch error message mentions lunch", stripos($res['body']['errors']['appointment_time'] ?? '', 'lunch') !== false);

$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '12:45',
    'chief_complaint' => 'Lunch visit'
]);
assert_test("Time at 12:45 (lunch) is rejected with 422", $res['status'] === 422);

// E. Valid slot at 08:00 and 17:00
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '08:00',
    'chief_complaint' => 'Opening slot'
]);
assert_test("Slot at 08:00 is accepted with 201", $res['status'] === 201 && $res['body']['success']);
$createdAppointmentIds[] = (int)$res['body']['data']['appointment_id'];

$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '17:00',
    'chief_complaint' => 'Closing slot'
]);
assert_test("Slot at 17:00 is accepted with 201", $res['status'] === 201 && $res['body']['success']);
$apptMonday17 = (int)$res['body']['data']['appointment_id'];
$createdAppointmentIds[] = $apptMonday17;

// F. Duplicate booking rejected
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $monday,
    'appointment_time' => '08:00',
    'chief_complaint' => 'Duplicate opening slot'
]);
assert_test("Duplicate active slot rejected with 409", $res['status'] === 409);

echo "\n--- 2. Daily Clinic Capacity Limit (Max 10 per day, Warn at 8 and 9) ---\n";

// Target Tuesday (2026-11-10) with multiple doctors and hours
$tuesday = '2026-11-10'; // 2026-11-10 is a Tuesday
$tuesdayApptIds = [];

// 10 appointments across multiple hours and doctors
$schedule = [
    ['doctor_id' => $doctorId,   'time' => '08:30'],
    ['doctor_id' => $doctor2Id,  'time' => '09:00'],
    ['doctor_id' => $doctorId,   'time' => '09:30'],
    ['doctor_id' => $doctor2Id,  'time' => '10:00'],
    ['doctor_id' => $doctorId,   'time' => '10:30'],
    ['doctor_id' => $doctor2Id,  'time' => '11:00'],
    ['doctor_id' => $doctorId,   'time' => '11:30'],
    ['doctor_id' => $doctor2Id,  'time' => '13:30'], // 8th appointment (warn)
    ['doctor_id' => $doctorId,   'time' => '14:00'], // 9th appointment (warn)
    ['doctor_id' => $doctor2Id,  'time' => '14:30'], // 10th appointment (warn/max)
];

// Book slots 1 to 7: should succeed without warning
for ($i = 0; $i < 7; $i++) {
    $item = $schedule[$i];
    $res = call_api('POST', 'api/appointment_controller.php', $cookie, [
        'patient_id' => $patientId,
        'doctor_id' => $item['doctor_id'],
        'appointment_date' => $tuesday,
        'appointment_time' => $item['time'],
        'chief_complaint' => "Daily capacity test slot " . ($i + 1)
    ]);
    assert_test("Slot " . ($i + 1) . " accepted (201)", $res['status'] === 201 && $res['body']['success']);
    assert_test("Slot " . ($i + 1) . " has no warning", !isset($res['body']['data']['warning']));
    $id = (int)$res['body']['data']['appointment_id'];
    $tuesdayApptIds[] = $id;
    $createdAppointmentIds[] = $id;
}

// Book slot 8: should succeed WITH warning
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[7]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => $schedule[7]['time'],
    'chief_complaint' => "Daily capacity test slot 8"
]);
assert_test("Slot 8 accepted (201)", $res['status'] === 201 && $res['body']['success']);
assert_test("Slot 8 returns capacity warning mentioning 8", isset($res['body']['data']['warning']) && stripos($res['body']['data']['warning'], '8') !== false);
$id = (int)$res['body']['data']['appointment_id'];
$tuesdayApptIds[] = $id;
$createdAppointmentIds[] = $id;

// Book slot 9: should succeed WITH warning
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[8]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => $schedule[8]['time'],
    'chief_complaint' => "Daily capacity test slot 9"
]);
assert_test("Slot 9 accepted (201)", $res['status'] === 201 && $res['body']['success']);
assert_test("Slot 9 returns capacity warning mentioning 9", isset($res['body']['data']['warning']) && stripos($res['body']['data']['warning'], '9') !== false);
$id = (int)$res['body']['data']['appointment_id'];
$tuesdayApptIds[] = $id;
$createdAppointmentIds[] = $id;

// Book slot 10: should succeed (reaches daily clinic capacity)
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[9]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => $schedule[9]['time'],
    'chief_complaint' => "Daily capacity test slot 10"
]);
assert_test("Slot 10 accepted (201)", $res['status'] === 201 && $res['body']['success']);
$id = (int)$res['body']['data']['appointment_id'];
$tuesdayApptIds[] = $id;
$createdAppointmentIds[] = $id;

// Attempt to book 11th slot on Tuesday (different doctor/hour): must be rejected with 409
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $tuesday,
    'appointment_time' => '15:00',
    'chief_complaint' => "Daily capacity test slot 11 (overflow)"
]);
assert_test("11th appointment on same date is rejected with 409", $res['status'] === 409);
assert_test("Rejection message states daily clinic capacity reached", stripos($res['body']['message'] ?? '', 'Daily clinic capacity reached') !== false);

echo "\n--- 3. Cancelled and No-Show Records Release Daily Capacity ---\n";

// Cancel appointment #1 on Tuesday
$apptToCancel = $tuesdayApptIds[0];
$res = call_api('PUT', "api/appointment_controller.php?id={$apptToCancel}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[0]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => $schedule[0]['time'],
    'status' => 'cancelled'
]);
assert_test("Appointment cancelled successfully (200)", $res['status'] === 200 && $res['body']['success']);

// Now there are 9 active appointments on Tuesday. Booking slot 15:00 should now succeed!
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $tuesday,
    'appointment_time' => '15:00',
    'chief_complaint' => "New 10th slot replacing cancelled"
]);
assert_test("Slot 15:00 accepted after cancellation released capacity (201)", $res['status'] === 201 && $res['body']['success']);
$createdAppointmentIds[] = (int)$res['body']['data']['appointment_id'];

// Tuesday is at 10 active appointments again. Slot 15:30 should fail.
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctor2Id,
    'appointment_date' => $tuesday,
    'appointment_time' => '15:30',
    'chief_complaint' => "Overflow after replacement"
]);
assert_test("Booking beyond 10 is rejected again with 409", $res['status'] === 409);

// Mark appointment #2 as no_show
$apptToNoShow = $tuesdayApptIds[1];
$res = call_api('PUT', "api/appointment_controller.php?id={$apptToNoShow}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[1]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => $schedule[1]['time'],
    'status' => 'no_show'
]);
assert_test("Appointment marked no_show successfully (200)", $res['status'] === 200 && $res['body']['success']);

// Now there are 9 active appointments again. Booking slot 15:30 should now succeed!
$res = call_api('POST', 'api/appointment_controller.php', $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctor2Id,
    'appointment_date' => $tuesday,
    'appointment_time' => '15:30',
    'chief_complaint' => "New 10th slot replacing no_show"
]);
assert_test("Slot 15:30 accepted after no_show released capacity (201)", $res['status'] === 201 && $res['body']['success']);
$createdAppointmentIds[] = (int)$res['body']['data']['appointment_id'];

echo "\n--- 4. Schedule and Capacity Validation on Reschedule (Update) ---\n";

// Reschedule to Sunday rejected
$activeApptId = $tuesdayApptIds[2];
$res = call_api('PUT', "api/appointment_controller.php?id={$activeApptId}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[2]['doctor_id'],
    'appointment_date' => $sunday,
    'appointment_time' => '10:10',
    'status' => 'scheduled'
]);
assert_test("Reschedule to Sunday rejected with 422", $res['status'] === 422);

// Reschedule to lunch rejected
$res = call_api('PUT', "api/appointment_controller.php?id={$activeApptId}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[2]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => '12:30',
    'status' => 'scheduled'
]);
assert_test("Reschedule to lunch (12:30) rejected with 422", $res['status'] === 422);

// Reschedule to before 08:00 rejected
$res = call_api('PUT', "api/appointment_controller.php?id={$activeApptId}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[2]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => '07:45',
    'status' => 'scheduled'
]);
assert_test("Reschedule to 07:45 rejected with 422", $res['status'] === 422);

// Reschedule into full clinic day: appointment from Monday ($apptMonday17) trying to move to Tuesday (which already has 10 active appointments)
$res = call_api('PUT', "api/appointment_controller.php?id={$apptMonday17}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => $tuesday,
    'appointment_time' => '16:30',
    'status' => 'scheduled'
]);
assert_test("Reschedule into full clinic date (10 appointments) rejected with 409", $res['status'] === 409);
assert_test("Rejection message states daily clinic capacity reached", stripos($res['body']['message'] ?? '', 'Daily clinic capacity reached') !== false);

// Rescheduling an existing appointment on Tuesday to another time on Tuesday succeeds (doesn't count itself)
$res = call_api('PUT', "api/appointment_controller.php?id={$activeApptId}", $cookie, [
    'patient_id' => $patientId,
    'doctor_id' => $schedule[2]['doctor_id'],
    'appointment_date' => $tuesday,
    'appointment_time' => '16:30',
    'status' => 'scheduled'
]);
assert_test("Reschedule on same date (self-update) succeeds (200)", $res['status'] === 200 && $res['body']['success']);

echo "\n--- 5. Doctor Options Metadata (No Invented Rota) ---\n";
$res = call_api('GET', 'api/appointment_controller.php?meta=doctors', $cookie);
assert_test("Doctor metadata options retrieved (200)", $res['status'] === 200 && $res['body']['success']);
$docItems = $res['body']['data']['items'] ?? [];
assert_test("Doctor metadata contains active doctors", count($docItems) > 0);
assert_test("Doctor metadata includes specialty_names key", array_key_exists('specialty_names', $docItems[0]));

echo "\nAll {$passCount} clinic schedule and capacity assertions passed successfully!\n";
