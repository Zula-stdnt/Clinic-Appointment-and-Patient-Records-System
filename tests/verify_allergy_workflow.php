<?php
// tests/verify_allergy_workflow.php
// Automated Verification Suite for Patient Allergy Intake & Clinical Confirmation Workflow

$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';
$cookieRecep = tempnam(sys_get_temp_dir(), 'ck_rec_');
$cookieDoctor = tempnam(sys_get_temp_dir(), 'ck_doc_');

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
echo "PATIENT ALLERGY INTAKE & CLINICAL CONFIRMATION SUITE\n";
echo "=======================================================\n\n";

// 1. Authenticate users
$recLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'recep.jane',
    'password' => 'RecepPass123!'
], $cookieRecep);
$recCsrf = $recLogin['json']['data']['csrf_token'] ?? '';

$docLogin = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'dr.house',
    'password' => 'DoctorPass123!'
], $cookieDoctor);
$docCsrf = $docLogin['json']['data']['csrf_token'] ?? '';

run_test("1.1: Receptionist and Doctor authenticate successfully", function() use ($recLogin, $docLogin, $recCsrf, $docCsrf) {
    if ($recLogin['status'] !== 200 || empty($recCsrf)) return "Receptionist login failed";
    if ($docLogin['status'] !== 200 || empty($docCsrf)) return "Doctor login failed";
    return true;
});

// 2. Test Patient Options includes allergy metadata
run_test("2.1: GET meta=patients returns 200 with allergies_alerts and allergies_confirmed_by_doctor", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/appointment_controller.php?meta=patients", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $items = $res['json']['data']['items'] ?? [];
    if (empty($items)) return "Expected items array in meta=patients";
    $first = $items[0];
    if (!array_key_exists('allergies_alerts', $first)) return "Missing allergies_alerts key in item";
    if (!array_key_exists('allergies_confirmed_by_doctor', $first)) return "Missing allergies_confirmed_by_doctor key in item";
    return true;
});

// 3. Register Walk-in patient with intake allergy
$testPatientId = 0;
$uniqueSuffix = rand(10000, 99999);
$uniqueContact = '0917' . rand(1000000, 9999999);
run_test("3.1: Register Walk-in patient with intake allergy note", function() use ($baseUrl, $cookieRecep, $recCsrf, $uniqueContact, $uniqueSuffix, &$testPatientId, $pdo) {
    $payload = [
        'first_name' => "AllergyTest$uniqueSuffix",
        'middle_initial' => 'A',
        'last_name' => "IntakeCase$uniqueSuffix",
        'gender' => 'Female',
        'date_of_birth' => '1996-06-20',
        'contact_no' => $uniqueContact,
        'address' => '456 Safety Lane',
        'allergies_alerts' => 'Penicillin (anaphylaxis)'
    ];
    $res = http_request('POST', "$baseUrl/api/walkin_patient_controller.php", $payload, $cookieRecep, [
        "X-CSRF-Token: $recCsrf"
    ]);

    if ($res['status'] !== 201) return "Expected 201, got {$res['status']}: " . json_encode($res['json']);
    $testPatientId = (int)($res['json']['data']['patient_id'] ?? 0);
    if ($testPatientId <= 0) return "Expected valid patient_id";

    // Verify DB state: allergies_alerts set, allergies_confirmed_by_doctor = 0
    $stmt = $pdo->prepare("SELECT allergies_alerts, allergies_confirmed_by_doctor FROM patients WHERE patient_id = ?");
    $stmt->execute([$testPatientId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row['allergies_alerts'] !== 'Penicillin (anaphylaxis)') return "Expected allergies_alerts 'Penicillin (anaphylaxis)', got '{$row['allergies_alerts']}'";
    if ((int)$row['allergies_confirmed_by_doctor'] !== 0) return "Expected unconfirmed (0), got {$row['allergies_confirmed_by_doctor']}";

    return true;
});

// 4. Schedule appointment and update intake allergy at booking
$testApptId = 0;
run_test("4.1: Schedule appointment and update intake allergy note (Unconfirmed)", function() use ($baseUrl, $cookieRecep, $recCsrf, &$testPatientId, &$testApptId, $pdo) {
    // Pick an open weekday slot well in the future
    $nextDate = new DateTime('+20 days');
    while ((int)$nextDate->format('w') === 0) { // avoid Sunday
        $nextDate->modify('+1 day');
    }
    $dateStr = $nextDate->format('Y-m-d');

    $payload = [
        'patient_id' => $testPatientId,
        'doctor_id' => 1,
        'appointment_date' => $dateStr,
        'appointment_time' => '14:30:00',
        'chief_complaint' => 'Persistent fever and sore throat',
        'allergies_alerts' => 'Penicillin (anaphylaxis), Sulfa drugs (rash)',
        'blood_pressure' => '120/80',
        'temperature' => '37.5',
        'oxygen_saturation' => '99'
    ];
    $res = http_request('POST', "$baseUrl/api/appointment_controller.php", $payload, $cookieRecep, [
        "X-CSRF-Token: $recCsrf"
    ]);

    if ($res['status'] !== 201) return "Expected 201, got {$res['status']}: " . json_encode($res['json']);
    $testApptId = (int)($res['json']['data']['appointment_id'] ?? 0);
    if ($testApptId <= 0) return "Expected valid appointment_id";

    // Verify patient allergy updated and still unconfirmed (0)
    $stmt = $pdo->prepare("SELECT allergies_alerts, allergies_confirmed_by_doctor FROM patients WHERE patient_id = ?");
    $stmt->execute([$testPatientId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row['allergies_alerts'] !== 'Penicillin (anaphylaxis), Sulfa drugs (rash)') return "Allergy text was not updated on patient";
    if ((int)$row['allergies_confirmed_by_doctor'] !== 0) return "Expected unconfirmed (0)";

    // Verify audit log recorded UPDATE_ALLERGIES_AT_INTAKE
    $auditStmt = $pdo->prepare("SELECT action, entity_id FROM audit_logs WHERE action = 'UPDATE_ALLERGIES_AT_INTAKE' AND entity_id = ? LIMIT 1");
    $auditStmt->execute([$testPatientId]);
    if (!$auditStmt->fetch()) return "Audit log UPDATE_ALLERGIES_AT_INTAKE not found";

    return true;
});

// 5. Query appointment details for printout / view
run_test("5.1: getAppointmentById returns allergy alerts and unconfirmed status", function() use ($baseUrl, $cookieRecep, &$testApptId) {
    $res = http_request('GET', "$baseUrl/api/appointment_controller.php?id=$testApptId", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $item = $res['json']['data']['item'] ?? [];
    if (($item['allergies_alerts'] ?? '') !== 'Penicillin (anaphylaxis), Sulfa drugs (rash)') return "Incorrect allergies_alerts in item";
    if ((int)($item['allergies_confirmed_by_doctor'] ?? 1) !== 0) return "Expected allergies_confirmed_by_doctor = 0";
    return true;
});

// 6. Doctor verifies and confirms allergy in Consultation Room
run_test("6.1: Doctor completes consultation encounter and confirms allergy (Doctor Confirmed)", function() use ($baseUrl, $cookieRecep, $cookieDoctor, $recCsrf, $docCsrf, &$testPatientId, &$testApptId, $pdo) {
    // Transition appointment to confirmed first so doctor can consult
    $confirm = http_request('PUT', "$baseUrl/api/appointment_controller.php?id=$testApptId", [
        'patient_id' => $testPatientId,
        'doctor_id' => 1,
        'status' => 'confirmed'
    ], $cookieRecep, ["X-CSRF-Token: $recCsrf"]);
    if ($confirm['status'] !== 200) return "Failed to confirm appointment: {$confirm['status']}";

    // Doctor saves consultation with confirmed allergy
    $consultPayload = [
        'appointment_id' => $testApptId,
        'notes' => 'Clinical evaluation complete. Verified severe allergy to Penicillin and Sulfa.',
        'allergies_alerts' => 'Penicillin (anaphylaxis), Sulfa drugs (rash) - Clinically Verified',
        'diagnoses' => [
            ['icd10_code' => 'J02.9', 'diagnosis_name' => 'Acute pharyngitis, unspecified', 'notes' => 'Prescribed non-penicillin alternative']
        ],
        'prescriptions' => [],
        'lab_requests' => []
    ];
    $consultRes = http_request('POST', "$baseUrl/api/consultation_controller.php", $consultPayload, $cookieDoctor, [
        "X-CSRF-Token: $docCsrf"
    ]);

    if ($consultRes['status'] !== 200) return "Expected 200, got {$consultRes['status']}: " . json_encode($consultRes['json']);

    // Check DB state: allergies_confirmed_by_doctor must now be 1
    $stmt = $pdo->prepare("SELECT allergies_alerts, allergies_confirmed_by_doctor FROM patients WHERE patient_id = ?");
    $stmt->execute([$testPatientId]);
    $pat = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($pat['allergies_alerts'] !== 'Penicillin (anaphylaxis), Sulfa drugs (rash) - Clinically Verified') return "Allergy text mismatch";
    if ((int)$pat['allergies_confirmed_by_doctor'] !== 1) return "Expected allergies_confirmed_by_doctor = 1 (Doctor Confirmed), got {$pat['allergies_confirmed_by_doctor']}";

    return true;
});

// Clean up test fixtures
if ($testApptId > 0) {
    $cids = $pdo->query("SELECT consultation_id FROM consultation WHERE appointment_id = $testApptId")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($cids as $cid) {
        $pdo->exec("DELETE FROM consultation_addenda WHERE consultation_id = $cid");
        $pdo->exec("DELETE FROM diagnosis WHERE consultation_id = $cid");
        $pdo->exec("DELETE FROM prescriptions WHERE consultation_id = $cid");
        $pdo->exec("DELETE FROM lab_requests WHERE consultation_id = $cid");
    }
    $pdo->exec("DELETE FROM consultation WHERE appointment_id = $testApptId");
    $pdo->exec("DELETE FROM vital_signs WHERE appointment_id = $testApptId");
    $pdo->exec("DELETE FROM appointments WHERE appointment_id = $testApptId");
}
if ($testPatientId > 0) {
    $pdo->exec("DELETE FROM audit_logs WHERE entity_type = 'patient' AND entity_id = $testPatientId");
    $pdo->exec("DELETE FROM patients WHERE patient_id = $testPatientId");
}
@unlink($cookieRecep);
@unlink($cookieDoctor);

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
