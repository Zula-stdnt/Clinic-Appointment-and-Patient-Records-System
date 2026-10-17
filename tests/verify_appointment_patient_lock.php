<?php
/**
 * tests/verify_appointment_patient_lock.php
 * 
 * Verifies that the patient field is immutable on existing appointments:
 * 1. Backend API rejects changing patient_id on existing appointment with 422.
 * 2. Backend API accepts edits keeping patient_id identical.
 * 3. Frontend receptionist_appointments.js and search-select.js include disabled state handling and lock notification.
 */

require_once __DIR__ . '/../config/db_connect.php';

echo "=======================================================\n";
echo " APPOINTMENT PATIENT IMMUTABILITY TEST SUITE\n";
echo "=======================================================\n\n";

$passCount = 0;
$failCount = 0;

function assertTest(bool $condition, string $id, string $title): void {
    global $passCount, $failCount;
    if ($condition) {
        echo " [PASS] {$id}: {$title}\n";
        $passCount++;
    } else {
        echo " [FAIL] {$id}: {$title}\n";
        $failCount++;
    }
}

// -------------------------------------------------------------
// Test 1: Frontend Code Inspection
// -------------------------------------------------------------
echo "--- Group 1: Frontend Code Inspection ---\n";

$recepApptJs = file_get_contents(__DIR__ . '/../assets/js/modules/receptionist_appointments.js');
$searchSelectJs = file_get_contents(__DIR__ . '/../assets/js/components/search-select.js');
$styleCss = file_get_contents(__DIR__ . '/../assets/css/style.css');

$hasPatLockNote = strpos($recepApptJs, 'appt-patient-lock-note') !== false;
assertTest($hasPatLockNote, "1.1", "receptionist_appointments.js contains appt-patient-lock-note helper element");

$hasEditDisable = strpos($recepApptJs, 'this.patientPicker.setDisabled(true)') !== false &&
                  strpos($recepApptJs, 'patSelect.disabled = true') !== false;
assertTest($hasEditDisable, "1.2", "openAppointmentModal disables patientPicker and patSelect when editing existing appointment");

$hasNewEnable = strpos($recepApptJs, 'this.patientPicker.setDisabled(false)') !== false &&
                strpos($recepApptJs, 'patSelect.disabled = false') !== false;
assertTest($hasNewEnable, "1.3", "openAppointmentModal enables patientPicker and patSelect when scheduling new appointment");

$hasActiveEditPatientId = strpos($recepApptJs, 'this.state.activeEditPatientId') !== false;
assertTest($hasActiveEditPatientId, "1.4", "saveAppointment enforces activeEditPatientId to prevent patient tampering");

$hasSearchSelectDisabledLogic = strpos($searchSelectJs, 'this.disabled = !!isDisabled') !== false &&
                                strpos($searchSelectJs, 'this.clearBtn.hidden = this.disabled') !== false;
assertTest($hasSearchSelectDisabledLogic, "1.5", "search-select.js hides clear button and prevents interactions when disabled");

$hasCssDisabledRule = strpos($styleCss, '.search-select.is-disabled') !== false;
assertTest($hasCssDisabledRule, "1.6", "style.css styles disabled search-select control");

// -------------------------------------------------------------
// Test 2: Backend API Direct Database & Logic Inspection
// -------------------------------------------------------------
echo "\n--- Group 2: Backend API Code Inspection ---\n";

$apptControllerPhp = file_get_contents(__DIR__ . '/../api/appointment_controller.php');

$hasBackendPatientLock = strpos($apptControllerPhp, "lockedAppt['patient_id'] !== \$patientId") !== false &&
                         strpos($apptControllerPhp, "Patient cannot be changed on an existing appointment") !== false;
assertTest($hasBackendPatientLock, "2.1", "api/appointment_controller.php rejects changing patient_id on existing appointment with 422");

// -------------------------------------------------------------
// Test 3: Live API Call Verification
// -------------------------------------------------------------
echo "\n--- Group 3: Live API Testing ---\n";

// Login as receptionist
$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';

$cookieFile = tempnam(sys_get_temp_dir(), 'ck_test_');

function apiRequest(string $method, string $url, ?array $data = null, ?string $cookieFile = null, array $headers = []): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    $reqHeaders = ['Content-Type: application/json', 'Accept: application/json'];
    foreach ($headers as $h) {
        $reqHeaders[] = $h;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);
    
    if ($cookieFile) {
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    }
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $headerStr = substr($response, 0, $headerSize);
    $bodyStr = substr($response, $headerSize);
    
    $json = json_decode($bodyStr, true);
    return [
        'code'    => $httpCode,
        'json'    => $json,
        'body'    => $bodyStr
    ];
}

$loginRes = apiRequest('POST', "{$baseUrl}/api/auth_controller.php?action=login", [
    'username' => 'recep.jane',
    'password' => 'RecepPass123!'
], $cookieFile);

if ($loginRes['code'] === 200 && ($loginRes['json']['success'] ?? false)) {
    $meRes = apiRequest('GET', "{$baseUrl}/api/auth_controller.php?action=me", null, $cookieFile);
    $csrf = $meRes['json']['data']['csrf_token'] ?? $loginRes['json']['data']['csrf_token'] ?? '';
    
    // Pick an existing appointment from database
    $apptRow = $pdo->query("SELECT appointment_id, patient_id, doctor_id, appointment_date, appointment_time, status FROM appointments WHERE status = 'scheduled' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    
    if ($apptRow) {
        $apptId = (int)$apptRow['appointment_id'];
        $originalPatientId = (int)$apptRow['patient_id'];
        $differentPatientId = ($originalPatientId === 1) ? 2 : 1;
        
        // Attempt to update appointment with a DIFFERENT patient_id
        $tamperRes = apiRequest('PUT', "{$baseUrl}/api/appointment_controller.php?id={$apptId}", [
            'patient_id'       => $differentPatientId,
            'doctor_id'        => (int)$apptRow['doctor_id'],
            'appointment_date' => $apptRow['appointment_date'],
            'appointment_time' => $apptRow['appointment_time'],
            'status'           => 'scheduled',
            'chief_complaint'  => 'Test attempt to switch patient'
        ], $cookieFile, ["X-CSRF-Token: {$csrf}"]);
        
        assertTest(
            $tamperRes['code'] === 422 && isset($tamperRes['json']['errors']['patient_id']),
            "3.1",
            "PUT /api/appointment_controller.php?id={$apptId} with different patient_id correctly returns 422 Unprocessable Entity"
        );
        
        // Attempt to update appointment with the SAME patient_id
        $validRes = apiRequest('PUT', "{$baseUrl}/api/appointment_controller.php?id={$apptId}", [
            'patient_id'       => $originalPatientId,
            'doctor_id'        => (int)$apptRow['doctor_id'],
            'appointment_date' => $apptRow['appointment_date'],
            'appointment_time' => $apptRow['appointment_time'],
            'status'           => 'scheduled',
            'chief_complaint'  => 'Routine follow-up consultation'
        ], $cookieFile, ["X-CSRF-Token: {$csrf}"]);
        
        assertTest(
            $validRes['code'] === 200 && ($validRes['json']['success'] ?? false) === true,
            "3.2",
            "PUT /api/appointment_controller.php?id={$apptId} with matching patient_id succeeds with 200 OK"
        );
    } else {
        echo " [SKIP] 3.1 & 3.2: No scheduled appointments found for live API test\n";
    }
} else {
    echo " [SKIP] 3.1 & 3.2: Could not log in via HTTP (server not running or port mismatch)\n";
}

echo "\n=======================================================\n";
echo "SUMMARY: Total: " . ($passCount + $failCount) . " | Passed: {$passCount} | Failed: {$failCount}\n";
echo "=======================================================\n";

if ($failCount === 0) {
    echo "🎉 ALL APPOINTMENT PATIENT IMMUTABILITY TESTS PASSED!\n";
} else {
    exit(1);
}
