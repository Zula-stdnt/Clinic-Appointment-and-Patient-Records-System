<?php
// tests/verify_patient_records_flow.php
// Verification of ITE 387 Minimum Required Features:
// Flow: Appointment -> Consultation -> Diagnosis -> Medical History
// Demonstrates that previous consultations/diagnoses are accumulated and can be viewed for the patient.

require_once __DIR__ . '/../../config/db_connect.php';

// Safety Guard: Refuse to run outside hospital_db_test
$currentDb = $pdo->query("SELECT DATABASE()")->fetchColumn();
if ($currentDb !== 'hospital_db_test') {
    die("ERROR: Safety Guard - tests must only target 'hospital_db_test'. Detected '{$currentDb}'. Blocked.\n");
}

$port = $argv[1] ?? 8088;
echo "Connecting to isolated API test server on port {$port}...\n";

function call_api($method, $path, $auth = [], $data = null) {
    global $port;
    $url = 'http://127.0.0.1:' . $port . '/' . ltrim($path, '/');
    $headers = [
        'Content-Type: application/json',
        'X-Requested-With: XMLHttpRequest',
        'X-CSRF-Token: ' . ($auth['csrf'] ?? 'test_token')
    ];
    if (!empty($auth['cookie'])) {
        $headers[] = 'Cookie: ' . $auth['cookie'];
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
    $res = call_api('POST', 'api/auth_controller.php?action=login', [], [
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
    $me = call_api('GET', 'api/auth_controller.php?action=me', ['cookie' => $cookie]);
    $csrf = $me['body']['data']['csrf_token'] ?? '';
    return ['cookie' => $cookie, 'csrf' => $csrf];
}

$cleanupApptIds = [];
$cleanupPatientIds = [];

register_shutdown_function(function() use (&$cleanupApptIds, &$cleanupPatientIds, $pdo) {
    if (!empty($cleanupApptIds)) {
        echo "Cleaning up " . count($cleanupApptIds) . " test appointments...\n";
        $in = implode(',', array_map('intval', $cleanupApptIds));
        $pdo->exec("DELETE FROM diagnosis WHERE consultation_id IN (SELECT consultation_id FROM consultation WHERE appointment_id IN ($in))");
        $pdo->exec("DELETE FROM prescriptions WHERE consultation_id IN (SELECT consultation_id FROM consultation WHERE appointment_id IN ($in))");
        $pdo->exec("DELETE FROM lab_requests WHERE consultation_id IN (SELECT consultation_id FROM consultation WHERE appointment_id IN ($in))");
        $pdo->exec("DELETE FROM consultation WHERE appointment_id IN ($in)");
        $pdo->exec("DELETE FROM vital_signs WHERE appointment_id IN ($in)");
        $pdo->exec("DELETE FROM appointments WHERE appointment_id IN ($in)");
    }
    if (!empty($cleanupPatientIds)) {
        $inPats = implode(',', array_map('intval', $cleanupPatientIds));
        $pdo->exec("DELETE FROM patients WHERE patient_id IN ($inPats)");
    }
});

$recAuth = login('rec', 'Pass123!');
$docAuth = login('doc', 'Pass123!');

if (!$recAuth['cookie'] || !$docAuth['cookie']) {
    die("FATAL: Failed to authenticate.\n");
}

$doctorId = (int)$pdo->query("SELECT doctor_id FROM doctors WHERE deleted_at IS NULL LIMIT 1")->fetchColumn();

// Create a dedicated test patient
$pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth, contact_no, address) VALUES ('Demonstration', 'Patient', 'Female', '1985-05-15', '09181234567', '123 Demo St')");
$patientId = (int)$pdo->lastInsertId();
$cleanupPatientIds[] = $patientId;

echo "\n======================================================\n";
echo "VERIFYING MINIMUM REQUIRED FEATURES FLOW\n";
echo "Flow: Appointment -> Consultation -> Diagnosis -> Medical History\n";
echo "======================================================\n";

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

// ----------------------------------------------------
// STEP 1: Set/Create Patient Appointment #1
// ----------------------------------------------------
echo "\n--- Step 1: Set/create Patient Appointment #1 ---\n";
$resAppt1 = call_api('POST', 'api/appointment_controller.php', $recAuth, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => '2026-11-16', // Monday
    'appointment_time' => '09:00',
    'chief_complaint' => 'Persistent dry cough and fever',
    'blood_pressure' => '120/80',
    'temperature' => '38.2',
    'oxygen_saturation' => '98'
]);
assert_test("Appointment #1 created successfully (201)", $resAppt1['status'] === 201 && $resAppt1['body']['success']);
$appt1Id = (int)$resAppt1['body']['data']['appointment_id'];
$cleanupApptIds[] = $appt1Id;

// Receptionist confirms appointment #1
$resConf1 = call_api('PUT', "api/appointment_controller.php?id={$appt1Id}", $recAuth, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => '2026-11-16',
    'appointment_time' => '09:00',
    'status' => 'confirmed'
]);
assert_test("Appointment #1 confirmed by Receptionist (200)", $resConf1['status'] === 200 && $resConf1['body']['success']);

// ----------------------------------------------------
// STEP 2 & 3: Record Consultation #1 & Diagnosis #1
// ----------------------------------------------------
echo "\n--- Step 2 & 3: Record Consultation #1 and Diagnosis #1 ---\n";
// Doctor loads consultation details
$resGetCons1 = call_api('GET', "api/consultation_controller.php?appointment_id={$appt1Id}", $docAuth);
assert_test("Doctor loads confirmed consultation #1 (200)", $resGetCons1['status'] === 200 && $resGetCons1['body']['success']);
assert_test("Vitals loaded for consultation #1", !empty($resGetCons1['body']['data']['vitals']));

// Doctor records Consultation Notes and Diagnosis
$resSaveCons1 = call_api('POST', 'api/consultation_controller.php', $docAuth, [
    'appointment_id' => $appt1Id,
    'notes' => 'Patient presents with a 3-day history of dry cough and low-grade fever. Lung examination reveals bilateral wheezing.',
    'diagnoses' => [
        [
            'icd10_code' => 'J20.9',
            'diagnosis_name' => 'Acute Bronchitis',
            'notes' => 'Prescribed bronchodilator and rest.'
        ]
    ]
]);
assert_test("Consultation #1 and Diagnosis #1 recorded successfully (200)", $resSaveCons1['status'] === 200 && $resSaveCons1['body']['success']);

// Check appointment status updated to completed
$statusAppt1 = $pdo->query("SELECT status FROM appointments WHERE appointment_id = {$appt1Id}")->fetchColumn();
assert_test("Appointment #1 status transitioned to completed", $statusAppt1 === 'completed');

// ----------------------------------------------------
// Follow-up Visit: Appointment #2, Consultation #2, Diagnosis #2
// ----------------------------------------------------
echo "\n--- Follow-up Visit: Appointment #2, Consultation #2, Diagnosis #2 ---\n";
$resAppt2 = call_api('POST', 'api/appointment_controller.php', $recAuth, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => '2026-11-23', // Monday the following week
    'appointment_time' => '10:30',
    'chief_complaint' => 'Follow-up on cough and new headache complaint',
    'blood_pressure' => '145/95',
    'temperature' => '36.8',
    'oxygen_saturation' => '99'
]);
assert_test("Appointment #2 created successfully (201)", $resAppt2['status'] === 201 && $resAppt2['body']['success']);
$appt2Id = (int)$resAppt2['body']['data']['appointment_id'];
$cleanupApptIds[] = $appt2Id;

// Confirm appointment #2
$resConf2 = call_api('PUT', "api/appointment_controller.php?id={$appt2Id}", $recAuth, [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'appointment_date' => '2026-11-23',
    'appointment_time' => '10:30',
    'status' => 'confirmed'
]);
assert_test("Appointment #2 confirmed by Receptionist (200)", $resConf2['status'] === 200 && $resConf2['body']['success']);

// Record Consultation #2 with a second Diagnosis (Hypertension)
$resSaveCons2 = call_api('POST', 'api/consultation_controller.php', $docAuth, [
    'appointment_id' => $appt2Id,
    'notes' => 'Bronchitis resolved. Patient now reports morning headaches. Elevated blood pressure observed.',
    'diagnoses' => [
        [
            'icd10_code' => 'I10',
            'diagnosis_name' => 'Essential (Primary) Hypertension',
            'notes' => 'Start low-dose antihypertensive, lifestyle modifications.'
        ]
    ]
]);
assert_test("Consultation #2 and Diagnosis #2 recorded successfully (200)", $resSaveCons2['status'] === 200 && $resSaveCons2['body']['success']);

$statusAppt2 = $pdo->query("SELECT status FROM appointments WHERE appointment_id = {$appt2Id}")->fetchColumn();
assert_test("Appointment #2 status transitioned to completed", $statusAppt2 === 'completed');

// ----------------------------------------------------
// STEP 4: Generate Patient Medical History
// ----------------------------------------------------
echo "\n--- Step 4: Generate Patient Medical History ---\n";
// Doctor retrieves accumulated medical history for this patient
$resHistory = call_api('GET', "api/doctor_patients_controller.php?action=history&patient_id={$patientId}", $docAuth);
assert_test("Medical History retrieved successfully (200)", $resHistory['status'] === 200 && $resHistory['body']['success']);

$data = $resHistory['body']['data'];
assert_test("Medical history includes patient demographics", isset($data['patient']) && $data['patient']['first_name'] === 'Demonstration');
assert_test("Medical history includes accumulated encounters timeline", isset($data['encounters']) && is_array($data['encounters']));

$encounters = $data['encounters'];
assert_test("Medical history has accumulated exactly 2 completed encounters", count($encounters) === 2);

// Encounter 1 (most recent, 2026-11-23)
$recentEnc = $encounters[0];
assert_test("Most recent encounter is from 2026-11-23", $recentEnc['appointment_date'] === '2026-11-23');
assert_test("Most recent encounter has Essential Hypertension diagnosis", 
    !empty($recentEnc['diagnoses']) && $recentEnc['diagnoses'][0]['diagnosis_name'] === 'Essential (Primary) Hypertension' && $recentEnc['diagnoses'][0]['icd10_code'] === 'I10'
);
assert_test("Most recent encounter includes notes", stripos($recentEnc['notes'], 'Bronchitis resolved') !== false);

// Encounter 2 (earlier, 2026-11-16)
$earlierEnc = $encounters[1];
assert_test("Earlier encounter is from 2026-11-16", $earlierEnc['appointment_date'] === '2026-11-16');
assert_test("Earlier encounter has Acute Bronchitis diagnosis", 
    !empty($earlierEnc['diagnoses']) && $earlierEnc['diagnoses'][0]['diagnosis_name'] === 'Acute Bronchitis' && $earlierEnc['diagnoses'][0]['icd10_code'] === 'J20.9'
);
assert_test("Earlier encounter includes notes", stripos($earlierEnc['notes'], 'dry cough and low-grade fever') !== false);

echo "\n======================================================\n";
echo "All {$passCount} Minimum Required Features assertions PASSED!\n";
echo "Flow: Appointment -> Consultation -> Diagnosis -> Medical History fully verified!\n";
echo "======================================================\n";

