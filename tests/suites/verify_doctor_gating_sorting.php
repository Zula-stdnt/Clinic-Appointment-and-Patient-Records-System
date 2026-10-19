<?php
// tests/verify_doctor_gating_sorting.php
// Verification test for Doctor consultation gating, ownership checks, upcoming sorting, and pagination.

require_once __DIR__ . '/../../config/db_connect.php';

// Safety Guard: Refuse to run outside hospital_db_test
$currentDb = $pdo->query("SELECT DATABASE()")->fetchColumn();
if ($currentDb !== 'hospital_db_test') {
    die("ERROR: Safety Guard - tests must only target 'hospital_db_test'. Detected '{$currentDb}'. Blocked.\n");
}

$port = $argv[1] ?? 8088;
echo "Connecting to isolated API test server on port {$port}...\n";

function call_api($method, $path, $auth = null, $data = null) {
    global $port;
    $url = 'http://127.0.0.1:' . $port . '/' . ltrim($path, '/');
    
    $cookie = '';
    $csrf = 'test_token';
    if (is_array($auth)) {
        $cookie = $auth['cookie'] ?? '';
        $csrf = $auth['csrf'] ?? 'test_token';
    } elseif (is_string($auth)) {
        $cookie = $auth;
    }

    $headers = [
        'Content-Type: application/json',
        'X-Requested-With: XMLHttpRequest',
        'X-CSRF-Token: ' . $csrf
    ];
    if ($cookie) {
        $headers[] = 'Cookie: ' . $cookie;
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
    $me = call_api('GET', 'api/auth_controller.php?action=me', $cookie);
    $csrf = $me['body']['data']['csrf_token'] ?? '';
    return ['cookie' => $cookie, 'csrf' => $csrf];
}

// Track temporary records to clean up
$cleanupApptIds = [];
$cleanupUserIds = [];
$cleanupPatientIds = [];

register_shutdown_function(function() use (&$cleanupApptIds, &$cleanupUserIds, &$cleanupPatientIds, $pdo) {
    if (!empty($cleanupApptIds)) {
        $in = implode(',', array_map('intval', $cleanupApptIds));
        $pdo->exec("DELETE FROM diagnosis WHERE consultation_id IN (SELECT consultation_id FROM consultation WHERE appointment_id IN ($in))");
        $pdo->exec("DELETE FROM prescriptions WHERE consultation_id IN (SELECT consultation_id FROM consultation WHERE appointment_id IN ($in))");
        $pdo->exec("DELETE FROM lab_requests WHERE consultation_id IN (SELECT consultation_id FROM consultation WHERE appointment_id IN ($in))");
        $pdo->exec("DELETE FROM consultation WHERE appointment_id IN ($in)");
        $pdo->exec("DELETE FROM vital_signs WHERE appointment_id IN ($in)");
        $pdo->exec("DELETE FROM appointments WHERE appointment_id IN ($in)");
    }
    if (!empty($cleanupUserIds)) {
        $inUsers = implode(',', array_map('intval', $cleanupUserIds));
        $pdo->exec("DELETE FROM doctors WHERE user_id IN ($inUsers)");
        $pdo->exec("DELETE FROM users WHERE user_id IN ($inUsers)");
    }
    if (!empty($cleanupPatientIds)) {
        $inPatients = implode(',', array_map('intval', $cleanupPatientIds));
        $pdo->exec("DELETE FROM patients WHERE patient_id IN ($inPatients)");
    }
});

// Setup doctor 2 if not exists
$doc2UserId = (int)$pdo->query("SELECT user_id FROM users WHERE username = 'doc2'")->fetchColumn();
if (!$doc2UserId) {
    $passHash = password_hash('Pass123!', PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (username, password_hash, first_name, last_name, role_id) VALUES ('doc2', ?, 'DocTwo', 'Test', 3)")->execute([$passHash]);
    $doc2UserId = (int)$pdo->lastInsertId();
    $cleanupUserIds[] = $doc2UserId;
    $pdo->prepare("INSERT INTO doctors (user_id, contact_no) VALUES (?, '09199998888')")->execute([$doc2UserId]);
}
$doc2DoctorId = (int)$pdo->query("SELECT doctor_id FROM doctors WHERE user_id = {$doc2UserId}")->fetchColumn();

// Login as Doctor 1, Doctor 2, Receptionist
$docAuth = login('doc', 'Pass123!');
if (!$docAuth['cookie']) {
    die("ERROR: Failed to log in as Doctor 1 ('doc').\n");
}
$doc2Auth = login('doc2', 'Pass123!');
if (!$doc2Auth['cookie']) {
    die("ERROR: Failed to log in as Doctor 2 ('doc2').\n");
}
$recAuth = login('rec', 'Pass123!');
if (!$recAuth['cookie']) {
    die("ERROR: Failed to log in as Receptionist ('rec').\n");
}

echo "Logged in successfully as doc, doc2, and rec with session tokens.\n";

$assertions = 0;
function assert_true($cond, $msg) {
    global $assertions;
    $assertions++;
    if (!$cond) {
        throw new Exception("Assertion failed: {$msg}");
    }
    echo "  [PASS] {$msg}\n";
}

$patId = (int)$pdo->query("SELECT patient_id FROM patients LIMIT 1")->fetchColumn();
$tomorrow = date('Y-m-d', strtotime('+1 day'));

// Create dedicated fixtures for gating tests
// 1. Scheduled appointment for Doctor 1
$stmtSched = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (?, 1, 1, ?, '09:30:00', 'Scheduled Gating Check', 'scheduled')");
$stmtSched->execute([$patId, $tomorrow]);
$scheduledApptId = (int)$pdo->lastInsertId();
$cleanupApptIds[] = $scheduledApptId;

// 2. Confirmed appointment for Doctor 1
$stmtConf = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (?, 1, 1, ?, '10:30:00', 'Confirmed Gating Check', 'confirmed')");
$stmtConf->execute([$patId, $tomorrow]);
$confirmedApptId = (int)$pdo->lastInsertId();
$cleanupApptIds[] = $confirmedApptId;

// --------------------------------------------------------------------------
// 1. Consultation Gating: Scheduled Appointments
// --------------------------------------------------------------------------
echo "\n--- Test 1: Consultation Gating on Scheduled Appointment ---\n";

$getRes = call_api('GET', "api/consultation_controller.php?appointment_id={$scheduledApptId}", $docAuth);
assert_true($getRes['status'] === 409, "GET scheduled consultation returns 409 Conflict (got {$getRes['status']})");
assert_true($getRes['body']['success'] === false, "GET scheduled consultation body reports success=false");
assert_true(strpos($getRes['body']['message'], 'scheduled') !== false, "GET error message mentions 'scheduled'");

$postRes = call_api('POST', 'api/consultation_controller.php', $docAuth, [
    'appointment_id' => $scheduledApptId,
    'notes' => 'Attempting consultation on scheduled appointment',
    'diagnoses' => [['diagnosis_name' => 'Flu']]
]);
assert_true($postRes['status'] === 409, "POST scheduled consultation returns 409 Conflict (got {$postRes['status']})");
assert_true($postRes['body']['success'] === false, "POST scheduled consultation body reports success=false");

// --------------------------------------------------------------------------
// 2. Consultation Gating: Confirmed Appointments
// --------------------------------------------------------------------------
echo "\n--- Test 2: Consultation on Confirmed Appointment ---\n";

$getConfRes = call_api('GET', "api/consultation_controller.php?appointment_id={$confirmedApptId}", $docAuth);
assert_true($getConfRes['status'] === 200, "GET confirmed consultation returns 200 OK (got {$getConfRes['status']})");
assert_true($getConfRes['body']['success'] === true, "GET confirmed consultation body reports success=true");
assert_true(isset($getConfRes['body']['data']['appointment']), "GET response contains appointment data");

// Save consultation for confirmed appointment
$postConfRes = call_api('POST', 'api/consultation_controller.php', $docAuth, [
    'appointment_id' => $confirmedApptId,
    'notes' => 'Patient has seasonal allergies and mild cough.',
    'diagnoses' => [
        ['icd10_code' => 'J30.9', 'diagnosis_name' => 'Allergic rhinitis', 'notes' => 'Pollen allergy']
    ]
]);
assert_true($postConfRes['status'] === 200, "POST confirmed consultation returns 200 OK (got {$postConfRes['status']})");
assert_true($postConfRes['body']['success'] === true, "POST consultation body reports success=true");

// Verify appointment transitioned to 'completed'
$stmtCheck = $pdo->prepare("SELECT status FROM appointments WHERE appointment_id = ?");
$stmtCheck->execute([$confirmedApptId]);
$apptStatus = $stmtCheck->fetchColumn();
assert_true($apptStatus === 'completed', "Appointment status transitioned to 'completed' (got '{$apptStatus}')");

// --------------------------------------------------------------------------
// 3. Consultation Gating: Completed Appointments View-Only & Immutable
// --------------------------------------------------------------------------
echo "\n--- Test 3: Consultation on Completed Appointment is View-Only ---\n";

// GET on completed appointment returns 200 with saved consultation details
$getCompRes = call_api('GET', "api/consultation_controller.php?appointment_id={$confirmedApptId}", $docAuth);
assert_true($getCompRes['status'] === 200, "GET completed consultation returns 200 OK (got {$getCompRes['status']})");
assert_true(!empty($getCompRes['body']['data']['consultation']), "Consultation data is returned for completed encounter");
assert_true($getCompRes['body']['data']['consultation']['notes'] === 'Patient has seasonal allergies and mild cough.', "Consultation notes match saved data");
assert_true(count($getCompRes['body']['data']['diagnoses']) === 1, "Diagnoses list returned 1 item");
assert_true($getCompRes['body']['data']['diagnoses'][0]['diagnosis_name'] === 'Allergic rhinitis', "Diagnosis name matches");

// POST to overwrite completed consultation returns 409
$postCompRes = call_api('POST', 'api/consultation_controller.php', $docAuth, [
    'appointment_id' => $confirmedApptId,
    'notes' => 'Attempting to overwrite completed consultation'
]);
assert_true($postCompRes['status'] === 409, "POST on completed appointment returns 409 Conflict (got {$postCompRes['status']})");
assert_true(stripos($postCompRes['body']['message'], 'completed') !== false, "Error message states appointment is completed");

// --------------------------------------------------------------------------
// 4. Doctor Ownership Security: 403 on other doctor's appointment
// --------------------------------------------------------------------------
echo "\n--- Test 4: Ownership Protection: 403 on other doctor's appointment ---\n";

// Create a separate patient for Doctor 2 (unassigned to Doctor 1)
$stmtPat2 = $pdo->prepare("INSERT INTO patients (first_name, last_name, gender, date_of_birth, contact_no) VALUES ('Unrelated', 'Patient', 'Female', '1995-05-05', '09120000000')");
$stmtPat2->execute();
$pat2Id = (int)$pdo->lastInsertId();
$cleanupPatientIds[] = $pat2Id;

// Create appointment for Doctor 2
$stmtIns = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (?, ?, 1, ?, '14:00:00', 'Doc2 Patient', 'confirmed')");
$stmtIns->execute([$pat2Id, $doc2DoctorId, $tomorrow]);
$doc2ApptId = (int)$pdo->lastInsertId();
$cleanupApptIds[] = $doc2ApptId;

// Doctor 1 attempts to GET Doctor 2's appointment
$unauthGet = call_api('GET', "api/consultation_controller.php?appointment_id={$doc2ApptId}", $docAuth);
assert_true($unauthGet['status'] === 403, "Doctor 1 GET Doctor 2 appointment returns 403 Forbidden (got {$unauthGet['status']})");

// Doctor 1 attempts to POST to Doctor 2's appointment
$unauthPost = call_api('POST', 'api/consultation_controller.php', $docAuth, [
    'appointment_id' => $doc2ApptId,
    'notes' => 'Malicious doctor access attempt'
]);
assert_true($unauthPost['status'] === 403, "Doctor 1 POST Doctor 2 appointment returns 403 Forbidden (got {$unauthPost['status']})");

// Doctor 2 can access their own appointment
$authGet = call_api('GET', "api/consultation_controller.php?appointment_id={$doc2ApptId}", $doc2Auth);
assert_true($authGet['status'] === 200, "Doctor 2 GET own appointment returns 200 OK (got {$authGet['status']})");

// --------------------------------------------------------------------------
// 5. Doctor Appointments Pagination & Upcoming Sorting
// --------------------------------------------------------------------------
echo "\n--- Test 5: Doctor Appointments Pagination and Upcoming Sorting ---\n";

$nextWeek = date('Y-m-d', strtotime('+7 days'));
$pastDate = date('Y-m-d', strtotime('-5 days'));

// Insert 1 past appointment, 1 near future, 1 far future
$stmtP = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (?, 1, 1, ?, '09:00:00', 'Past Appt', 'completed')");
$stmtP->execute([$patId, $pastDate]);
$cleanupApptIds[] = (int)$pdo->lastInsertId();

$stmtNF = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (?, 1, 1, ?, '15:00:00', 'Near Future Appt', 'scheduled')");
$stmtNF->execute([$patId, $tomorrow]);
$cleanupApptIds[] = (int)$pdo->lastInsertId();

$stmtFF = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (?, 1, 1, ?, '16:00:00', 'Far Future Appt', 'confirmed')");
$stmtFF->execute([$patId, $nextWeek]);
$cleanupApptIds[] = (int)$pdo->lastInsertId();

// Query Doctor appointments with pagination and upcoming sort
$docAppts = call_api('GET', 'api/appointment_controller.php?page=1&page_size=10&sort=upcoming', $docAuth);
assert_true($docAppts['status'] === 200, "Doctor paginated appointments returns 200 OK");
assert_true(isset($docAppts['body']['data']['items']), "Response has items array");
assert_true(isset($docAppts['body']['data']['total']), "Response has total count");
assert_true(isset($docAppts['body']['data']['page']), "Response has page");
assert_true(isset($docAppts['body']['data']['pages']), "Response has pages");

$items = $docAppts['body']['data']['items'];
assert_true(count($items) > 0, "Doctor has appointments returned");

// Verify that all returned appointments belong to doctor 1
$allDoc1 = true;
foreach ($items as $item) {
    if ((int)$item['doctor_id'] !== 1) {
        $allDoc1 = false;
        break;
    }
}
assert_true($allDoc1, "All appointments returned belong to authenticated Doctor (doctor_id = 1)");

// Verify upcoming sorting: active future appointments appear before past/completed appointments
$seenTerminalOrPast = false;
$sortingCorrect = true;
$clinicNow = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d H:i:s');

foreach ($items as $item) {
    $itemDt = $item['appointment_date'] . ' ' . $item['appointment_time'];
    $isUpcoming = in_array($item['status'], ['scheduled', 'confirmed'], true) && ($itemDt >= $clinicNow);
    if (!$isUpcoming) {
        $seenTerminalOrPast = true;
    } else {
        if ($seenTerminalOrPast) {
            $sortingCorrect = false;
            break;
        }
    }
}
assert_true($sortingCorrect, "Upcoming active appointments appear before past/terminal records");

// --------------------------------------------------------------------------
// 6. Doctor Overview KPI Compatibility (Unpaginated Query)
// --------------------------------------------------------------------------
echo "\n--- Test 6: Doctor Overview KPI Unpaginated Compatibility ---\n";

$kpiRes = call_api('GET', 'api/appointment_controller.php', $docAuth);
assert_true($kpiRes['status'] === 200, "Doctor unpaginated appointments returns 200 OK");
assert_true(isset($kpiRes['body']['data']['items']), "Unpaginated response has items array");

$allKpiDoc1 = true;
foreach ($kpiRes['body']['data']['items'] as $item) {
    if ((int)$item['doctor_id'] !== 1) {
        $allKpiDoc1 = false;
        break;
    }
}
assert_true($allKpiDoc1, "Unpaginated query preserves Doctor 1 filtering for Dashboard KPIs");

// --------------------------------------------------------------------------
// 7. Receptionist Doctor Metadata & Scheduling
// --------------------------------------------------------------------------
echo "\n--- Test 7: Receptionist Doctor Combobox Metadata & Booking ---\n";

$metaDocRes = call_api('GET', 'api/appointment_controller.php?meta=doctors', $recAuth);
assert_true($metaDocRes['status'] === 200, "Receptionist GET meta=doctors returns 200 OK");
assert_true(!empty($metaDocRes['body']['data']['items']), "meta=doctors returns doctor list");

// Schedule a new appointment with doctor 1
$schedRes = call_api('POST', 'api/appointment_controller.php', $recAuth, [
    'patient_id' => $patId,
    'doctor_id' => 1,
    'appointment_date' => $tomorrow,
    'appointment_time' => '11:00',
    'chief_complaint' => 'Verified booking check'
]);
assert_true($schedRes['status'] === 201, "Receptionist scheduling appointment returns 201 Created (got {$schedRes['status']})");
if (isset($schedRes['body']['data']['appointment_id'])) {
    $cleanupApptIds[] = (int)$schedRes['body']['data']['appointment_id'];
}

echo "\nAll {$assertions} assertions passed successfully!\n";
