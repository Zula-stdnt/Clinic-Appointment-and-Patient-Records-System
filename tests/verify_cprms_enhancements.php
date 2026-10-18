<?php
// tests/verify_cprms_enhancements.php
// Verification suite for CAPRS (Clinic Appointment and Patient Records System) enhancements

$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';
$cookieAdmin = tempnam(sys_get_temp_dir(), 'ck_adm_enh_');
$cookieDoctor = tempnam(sys_get_temp_dir(), 'ck_doc_enh_');
$cookieRecep = tempnam(sys_get_temp_dir(), 'ck_rec_enh_');

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

function get_csrf_token(string $baseUrl, string $cookieFile): string {
    $res = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieFile);
    return $res['json']['data']['csrf_token'] ?? '';
}

echo "=======================================================\n";
echo "CPRMS ENHANCEMENTS SYSTEM VERIFICATION SUITE\n";
echo "=======================================================\n\n";

// --- Authenticate users ---
http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'testadmin',
    'password' => 'TestPass123!'
], $cookieAdmin);

http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'dr.house',
    'password' => 'DoctorPass123!'
], $cookieDoctor);

http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'recep.jane',
    'password' => 'RecepPass123!'
], $cookieRecep);

$adminCsrf = get_csrf_token($baseUrl, $cookieAdmin);
$docCsrf = get_csrf_token($baseUrl, $cookieDoctor);
$recCsrf = get_csrf_token($baseUrl, $cookieRecep);

echo "--- 1. Live Sync & State Revision Polling ---\n";

run_test("1.1: ?action=sync_state returns 200 with revision, total, and active_today counts", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/appointment_controller.php?action=sync_state", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $data = $res['json']['data'] ?? [];
    if (!isset($data['revision'])) return "Expected data.revision to be set";
    if (!isset($data['total'])) return "Expected data.total to be set";
    if (!isset($data['active_today'])) return "Expected data.active_today to be set";
    if (!isset($data['server_time'])) return "Expected data.server_time to be set";
    return true;
});

echo "\n--- 2. Month Date Filter & Doctor Schedule Lookup ---\n";

run_test("2.1: listAppointments supports ?month=YYYY-MM filter", function() use ($baseUrl, $cookieRecep) {
    $currentMonth = date('Y-m');
    $res = http_request('GET', "$baseUrl/api/appointment_controller.php?month=$currentMonth", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $items = $res['json']['data']['items'] ?? null;
    if (!is_array($items)) return "Expected items array in data";
    return true;
});

run_test("2.2: doctor_schedule_controller.php returns weekly schedule array for Doctor 1", function() use ($baseUrl, $cookieDoctor) {
    $res = http_request('GET', "$baseUrl/api/doctor_schedule_controller.php?doctor_id=1", null, $cookieDoctor);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $data = $res['json']['data'] ?? [];
    if (!isset($data['schedules']) || !is_array($data['schedules'])) return "Expected data.schedules array";
    if (count($data['schedules']) === 0) return "Expected Doctor 1 to have configured schedule days";
    return true;
});

run_test("2.3: meta=doctors includes schedule_summary text for each doctor", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/appointment_controller.php?meta=doctors", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $items = $res['json']['data']['items'] ?? [];
    if (empty($items)) return "Expected doctor items";
    $docWithSummary = false;
    foreach ($items as $d) {
        if (!empty($d['schedule_summary'])) {
            $docWithSummary = true;
            break;
        }
    }
    if (!$docWithSummary) return "Expected at least one doctor to have schedule_summary";
    return true;
});

echo "\n--- 3. Hybrid Break-Glass & Administrative Access Requests ---\n";

$doctorMeRes = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieDoctor);
$docUserId = (int)($doctorMeRes['json']['data']['user']['user_id'] ?? 0);
$docQuery = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
$docQuery->execute([$docUserId]);
$houseDocId = (int)$docQuery->fetchColumn();

// Find an unassigned patient
$patQuery = $pdo->prepare("
    SELECT p.patient_id FROM patients p
    WHERE p.deleted_at IS NULL
      AND p.patient_id NOT IN (
          SELECT a.patient_id FROM appointments a WHERE a.doctor_id = ? AND a.status != 'cancelled'
      )
    LIMIT 1
");
$patQuery->execute([$houseDocId]);
$testPatientId = (int)$patQuery->fetchColumn();

if (!$testPatientId) {
    $pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth, contact_no, address) VALUES ('Emergency', 'Case', 'Female', '1998-04-12', '09171112233', 'Emergency ER Bay 1')");
    $testPatientId = (int)$pdo->lastInsertId();
}

$createdRequestId = 0;

run_test("3.1: Doctor can submit a Standard Access Request (mode='standard', min 10 chars reason)", function() use ($baseUrl, $cookieDoctor, $docCsrf, $testPatientId, &$createdRequestId) {
    $headers = ["X-CSRF-Token: $docCsrf"];
    $res = http_request('POST', "$baseUrl/api/access_request_controller.php", [
        'patient_id'     => $testPatientId,
        'mode'           => 'standard',
        'reason'         => 'Review prior surgical history before referral',
        'duration_hours' => 24
    ], $cookieDoctor, $headers);

    if ($res['status'] !== 201) return "Expected 201 Created, got {$res['status']}: {$res['body']}";
    $data = $res['json']['data'] ?? [];
    if (($data['status'] ?? '') !== 'pending') return "Expected status='pending', got " . ($data['status'] ?? '');
    $createdRequestId = (int)($data['request_id'] ?? 0);
    if ($createdRequestId <= 0) return "Expected positive request_id";
    return true;
});

run_test("3.2: Administrator can view pending access requests in access_request_controller.php", function() use ($baseUrl, $cookieAdmin, &$createdRequestId) {
    $res = http_request('GET', "$baseUrl/api/access_request_controller.php?filter=pending", null, $cookieAdmin);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $items = $res['json']['data']['items'] ?? [];
    $found = false;
    foreach ($items as $it) {
        if ((int)$it['request_id'] === $createdRequestId) {
            $found = true;
            break;
        }
    }
    if (!$found) return "Created request_id $createdRequestId not found in admin pending list";
    return true;
});

run_test("3.3: Administrator can approve standard access request granting 24 hours access", function() use ($baseUrl, $cookieAdmin, $adminCsrf, &$createdRequestId) {
    $headers = ["X-CSRF-Token: $adminCsrf"];
    $res = http_request('PUT', "$baseUrl/api/access_request_controller.php?action=approve", [
        'request_id' => $createdRequestId,
        'notes'      => 'Approved for surgical consultation review'
    ], $cookieAdmin, $headers);

    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}: {$res['body']}";
    $data = $res['json']['data'] ?? [];
    if (($data['status'] ?? '') !== 'approved') return "Expected status='approved'";
    if (empty($data['expires_at'])) return "Expected non-empty expires_at";
    return true;
});

run_test("3.4: Doctor has active chart access during approved 24h window without break_glass flag", function() use ($baseUrl, $cookieDoctor, $testPatientId) {
    // Dr. House accesses unassigned patient who now has an active approved grant
    $res = http_request('GET', "$baseUrl/api/patient_record_controller.php?action=history&patient_id=$testPatientId", null, $cookieDoctor);
    if ($res['status'] !== 200) return "Expected 200 with approved request, got {$res['status']}: {$res['body']}";
    $data = $res['json']['data'] ?? [];
    if (empty($data['patient']['patient_id'])) return "Expected patient record returned";
    return true;
});

run_test("3.5: Administrator can acknowledge Urgent Break-Glass audit override", function() use ($baseUrl, $cookieDoctor, $cookieAdmin, $docCsrf, $adminCsrf, $testPatientId) {
    // Perform urgent break glass on the test patient
    $docHeaders = ["X-CSRF-Token: $docCsrf"];
    $resBg = http_request('GET', "$baseUrl/api/patient_record_controller.php?action=history&patient_id=$testPatientId&break_glass=true&break_glass_reason=Acute+emergency+inpatient+evaluation", null, $cookieDoctor);
    if ($resBg['status'] !== 200) return "Expected 200 break-glass, got {$resBg['status']}";

    // Retrieve flagged requests
    $resFlagged = http_request('GET', "$baseUrl/api/access_request_controller.php?filter=flagged", null, $cookieAdmin);
    if ($resFlagged['status'] !== 200) return "Expected 200 flagged list, got {$resFlagged['status']}";
    $items = $resFlagged['json']['data']['items'] ?? [];
    $urgentReq = null;
    foreach ($items as $it) {
        if ($it['mode'] === 'urgent' && $it['audit_reviewed'] == 0) {
            $urgentReq = $it;
            break;
        }
    }
    if (!$urgentReq) return "Expected unreviewed urgent override in flagged list";

    // Admin acknowledges audit flag
    $adminHeaders = ["X-CSRF-Token: $adminCsrf"];
    $resAck = http_request('PUT', "$baseUrl/api/access_request_controller.php?action=acknowledge_audit", [
        'request_id' => $urgentReq['request_id'],
        'notes'      => 'Emergency audit verified and signed off'
    ], $cookieAdmin, $adminHeaders);
    if ($resAck['status'] !== 200) return "Expected 200 acknowledge_audit, got {$resAck['status']}: {$resAck['body']}";

    return true;
});

echo "\n--- 4. Receptionist Demographics & Appointment History Privacy Guard ---\n";

run_test("4.1: Receptionist patient history returns appointment history without clinical leakage", function() use ($baseUrl, $cookieRecep) {
    $res = http_request('GET', "$baseUrl/api/patient_record_controller.php?action=history&patient_id=2", null, $cookieRecep);
    if ($res['status'] !== 200) return "Expected 200, got {$res['status']}";
    $data = $res['json']['data'] ?? [];

    // Ensure demographics exist
    if (empty($data['patient']['patient_id'])) return "Expected demographics patient object";

    // Ensure appointment_history exists for administrative coordination
    if (!isset($data['appointment_history']) || !is_array($data['appointment_history'])) {
        return "Expected appointment_history array for receptionist";
    }

    // Ensure zero clinical encounters / diagnoses / prescriptions
    if (!empty($data['encounters'])) return "Leaked encounters to Receptionist!";
    if (!empty($data['prescriptions'])) return "Leaked prescriptions to Receptionist!";
    if (!empty($data['diagnoses'])) return "Leaked diagnoses to Receptionist!";

    return true;
});

echo "\n=======================================================\n";
echo "SUMMARY: Total: $totalTests | Passed: $passedTests | Failed: $failedTests\n";
echo "=======================================================\n";

if ($failedTests === 0) {
    echo "🎉 ALL CPRMS ENHANCEMENT TESTS PASSED (100% SUCCESS)!\n";
    exit(0);
} else {
    echo "❌ SOME TESTS FAILED.\n";
    exit(1);
}
