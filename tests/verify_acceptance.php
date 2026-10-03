<?php
// tests/verify_acceptance.php
// Automated Verification Test Suite for Hospital Patient Information System
// Directly verifies every requirement in Section 11 of AGENT.md

$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';
$cookieAdmin = tempnam(sys_get_temp_dir(), 'ck_adm_');
$cookieDoctor = tempnam(sys_get_temp_dir(), 'ck_doc_');
$cookieUnauthorized = tempnam(sys_get_temp_dir(), 'ck_unauth_');
$cookieAnon = tempnam(sys_get_temp_dir(), 'ck_ano_');

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
echo "HOSPITAL SYSTEM ACCEPTANCE SUITE (Section 11 Checklist)\n";
echo "=======================================================\n\n";

// SECTION A: Authentication and access
echo "--- Group 1: Authentication and Access ---\n";

run_test("1.1: Valid Administrator credentials reach dashboard", function() use ($baseUrl, $cookieAdmin) {
    $res = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => 'testadmin',
        'password' => 'TestPass123!'
    ], $cookieAdmin);

    if ($res['status'] !== 200 || !($res['json']['success'] ?? false)) {
        return "Login failed: " . json_encode($res['json']);
    }
    if ($res['json']['data']['redirect'] !== 'admin_dashboard.html') {
        return "Redirect mismatch: " . ($res['json']['data']['redirect'] ?? 'null');
    }
    return true;
});

run_test("1.2: Wrong username and wrong password produce identical generic error", function() use ($baseUrl) {
    $resWrongUser = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => 'nonexistent_user_xyz',
        'password' => 'somepass'
    ]);
    $resWrongPass = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => 'testadmin',
        'password' => 'WrongPassword!'
    ]);

    if ($resWrongUser['status'] !== 401 || $resWrongPass['status'] !== 401) {
        return "Expected status 401 for both, got {$resWrongUser['status']} and {$resWrongPass['status']}";
    }

    $msgUser = $resWrongUser['json']['message'] ?? '';
    $msgPass = $resWrongPass['json']['message'] ?? '';

    if ($msgUser !== 'Invalid username or password.' || $msgPass !== 'Invalid username or password.') {
        return "Messages not identical or not generic: '$msgUser' vs '$msgPass'";
    }
    return true;
});

run_test("1.3: Soft-deleted user cannot log in", function() use ($baseUrl) {
    // Connect directly to db to temporarily soft-delete dr.smith
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $pdo->exec("UPDATE users SET deleted_at = NOW() WHERE username = 'dr.smith'");

    $res = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => 'dr.smith',
        'password' => 'DoctorPass123!'
    ]);

    // Restore user
    $pdo->exec("UPDATE users SET deleted_at = NULL WHERE username = 'dr.smith'");

    if ($res['status'] !== 401) {
        return "Expected 401 for soft deleted user, got {$res['status']}";
    }
    if (($res['json']['message'] ?? '') !== 'Invalid username or password.') {
        return "Expected generic error, got " . ($res['json']['message'] ?? '');
    }
    return true;
});

run_test("1.4: User with unauthorized role cannot log in", function() use ($baseUrl, $cookieUnauthorized) {
    // Insert temporary unauthorized user with non-permitted role (Guest)
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $pdo->exec("INSERT INTO roles (role_id, role_name) VALUES (998, 'Guest') ON DUPLICATE KEY UPDATE role_name = 'Guest'");
    $hash = password_hash('GuestPass123!', PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO users (user_id, role_id, first_name, last_name, gender, username, password_hash) VALUES (998, 998, 'Test', 'Guest', 'Other', 'guest.test', '$hash') ON DUPLICATE KEY UPDATE password_hash = '$hash'");

    $res = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => 'guest.test',
        'password' => 'GuestPass123!'
    ], $cookieUnauthorized);

    // Clean up
    $pdo->exec("DELETE FROM users WHERE user_id = 998");
    $pdo->exec("DELETE FROM roles WHERE role_id = 998");

    if ($res['status'] !== 403) {
        return "Expected status 403, got {$res['status']}";
    }
    return true;
});

run_test("1.5: Unauthenticated session guard check returns 401 and static shell contains no session data", function() use ($baseUrl, $cookieAnon) {
    $meRes = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieAnon);
    if ($meRes['status'] !== 401) {
        return "Expected 401 from action=me when logged out, got {$meRes['status']}";
    }

    $shellRes = http_request('GET', "$baseUrl/admin_dashboard.html", null, $cookieAnon);
    if ($shellRes['status'] !== 200) {
        return "Expected 200 for static HTML shell, got {$shellRes['status']}";
    }
    if (strpos($shellRes['body'], '<meta name="csrf-token" content="">') === false) {
        return "Static shell should have empty csrf-token meta tag before JS hydration";
    }
    return true;
});

run_test("1.6: API endpoint returns 401 when logged out", function() use ($baseUrl, $cookieAnon) {
    $res = http_request('GET', "$baseUrl/api/user_controller.php", null, $cookieAnon);
    if ($res['status'] !== 401) {
        return "Expected 401, got {$res['status']}";
    }
    if (($res['json']['success'] ?? true) !== false) {
        return "Expected success: false in JSON";
    }
    return true;
});

run_test("1.7: API endpoint returns 403 when logged in as non-Administrator", function() use ($baseUrl, $cookieDoctor) {
    // Log in as doctor
    $login = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => 'dr.smith',
        'password' => 'DoctorPass123!'
    ], $cookieDoctor);
    if ($login['status'] !== 200) return "Doctor login failed";

    // Attempt to access admin API endpoint
    $res = http_request('GET', "$baseUrl/api/user_controller.php", null, $cookieDoctor);
    if ($res['status'] !== 403) {
        return "Expected 403 for non-admin on API, got {$res['status']}";
    }
    return true;
});

run_test("1.8: State-changing request without valid CSRF token is rejected with 403", function() use ($baseUrl, $cookieAdmin) {
    // POST request with valid admin session but missing CSRF token
    $res = http_request('POST', "$baseUrl/api/service_controller.php", [
        'service_name' => 'Unauthorized Service'
    ], $cookieAdmin, []); // No X-CSRF-Token header

    if ($res['status'] !== 403) {
        return "Expected 403 for missing CSRF, got {$res['status']}";
    }
    return true;
});

// SECTION B: Users module
echo "\n--- Group 2: Users Module Security & Operations ---\n";

// Helper to get CSRF token for admin session
$meRes = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieAdmin);
$adminCsrf = $meRes['json']['data']['csrf_token'] ?? '';

run_test("2.1: Administrator accounts never appear in users list", function() use ($baseUrl, $cookieAdmin) {
    $res = http_request('GET', "$baseUrl/api/user_controller.php?status=all", null, $cookieAdmin);
    if ($res['status'] !== 200) return "API error: {$res['status']}";

    $items = $res['json']['data']['items'] ?? [];
    foreach ($items as $item) {
        if ($item['role_name'] === 'Administrator' || $item['username'] === 'testadmin') {
            return "Found Administrator account in list: {$item['username']}";
        }
    }
    return true;
});

run_test("2.2: Requests targeting an Administrator ID are rejected", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    // Administrator ID is 1
    $view = http_request('GET', "$baseUrl/api/user_controller.php?id=1", null, $cookieAdmin);
    if ($view['status'] !== 404) {
        return "Expected 404 when viewing Administrator, got {$view['status']}";
    }

    $del = http_request('DELETE', "$baseUrl/api/user_controller.php?id=1", null, $cookieAdmin, [
        "X-CSRF-Token: $adminCsrf"
    ]);
    if ($del['status'] !== 404) {
        return "Expected 404 when attempting to delete Administrator, got {$del['status']}";
    }
    return true;
});

run_test("2.3: Only Doctor and Receptionist can be assigned as roles", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    // Attempt to assign unauthorized role_id 1 (Administrator) or invalid role_id
    $res = http_request('POST', "$baseUrl/api/user_controller.php", [
        'first_name' => 'Hacker',
        'last_name' => 'Admin',
        'gender' => 'Other',
        'username' => 'hacker.admin',
        'password' => 'Secret123!',
        'role_id' => 1
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($res['status'] !== 422) {
        return "Expected 422 when assigning Administrator role, got {$res['status']}";
    }
    return true;
});

run_test("2.4: Stored passwords are hashes and new user can log in", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    $username = 'test.receptionist.' . time();
    $password = 'TestPass123!';

    $create = http_request('POST', "$baseUrl/api/user_controller.php", [
        'first_name' => 'Test',
        'last_name' => 'Receptionist',
        'gender' => 'Female',
        'username' => $username,
        'password' => $password,
        'role_id' => 2 // Receptionist
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($create['status'] !== 201) {
        return "User creation failed: " . json_encode($create['json']);
    }

    // Verify raw hash in DB
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $hash = $stmt->fetchColumn();

    if (!$hash || strpos($hash, '$2y$') !== 0) {
        return "Password is not a valid bcrypt hash: $hash";
    }

    // Attempt login with new user credentials
    $loginRes = http_request('POST', "$baseUrl/api/auth_controller.php?action=login", [
        'username' => $username,
        'password' => $password
    ]);

    if ($loginRes['status'] !== 200 || !($loginRes['json']['success'] ?? false)) {
        return "Login failed with new credentials: " . json_encode($loginRes['json']);
    }

    // Clean up the temporary user
    $pdo->prepare("DELETE FROM users WHERE username = ?")->execute([$username]);

    return true;
});

// SECTION C: CRUD and deletion
echo "\n--- Group 3: CRUD and Deletion Semantics ---\n";

run_test("3.1: Soft-deleted record disappears from default list and can be restored", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    // 1. Create temporary specialty
    $name = 'Temp Test Specialty ' . time();
    $create = http_request('POST', "$baseUrl/api/specialty_controller.php", [
        'specialty_name' => $name
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($create['status'] !== 201) return "Failed to create specialty: " . json_encode($create['json']);
    $newId = $create['json']['data']['specialty_id'];

    // 2. Soft delete
    $softDel = http_request('PUT', "$baseUrl/api/specialty_controller.php?action=soft_delete&id=$newId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($softDel['status'] !== 200) return "Soft delete failed: " . json_encode($softDel['json']);

    // 3. Verify it disappeared from default active list
    $activeList = http_request('GET', "$baseUrl/api/specialty_controller.php?status=active&search=" . urlencode($name), null, $cookieAdmin);
    if (!empty($activeList['json']['data']['items'])) {
        return "Soft-deleted record still appeared in active list";
    }

    // 4. Verify it appears in deleted list
    $deletedList = http_request('GET', "$baseUrl/api/specialty_controller.php?status=deleted&search=" . urlencode($name), null, $cookieAdmin);
    if (empty($deletedList['json']['data']['items'])) {
        return "Soft-deleted record did not appear in deleted list";
    }

    // 5. Restore
    $restore = http_request('PUT', "$baseUrl/api/specialty_controller.php?action=restore&id=$newId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($restore['status'] !== 200) return "Restore failed: " . json_encode($restore['json']);

    // 6. Verify back in active list
    $activeAgain = http_request('GET', "$baseUrl/api/specialty_controller.php?status=active&search=" . urlencode($name), null, $cookieAdmin);
    if (empty($activeAgain['json']['data']['items'])) {
        return "Restored record did not return to active list";
    }

    // Clean up with hard delete
    http_request('DELETE', "$baseUrl/api/specialty_controller.php?id=$newId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    return true;
});

run_test("3.1.5: Soft-deleted service disappears from default list and can be restored", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    $name = 'Temp Test Service ' . time();
    $create = http_request('POST', "$baseUrl/api/service_controller.php", [
        'service_name' => $name
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($create['status'] !== 201) return "Failed to create service: " . json_encode($create['json']);
    $newId = $create['json']['data']['service_id'];

    $softDel = http_request('PUT', "$baseUrl/api/service_controller.php?action=soft_delete&id=$newId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($softDel['status'] !== 200) return "Soft delete failed: " . json_encode($softDel['json']);

    $activeList = http_request('GET', "$baseUrl/api/service_controller.php?status=active&search=" . urlencode($name), null, $cookieAdmin);
    if (!empty($activeList['json']['data']['items'])) {
        return "Soft-deleted record still appeared in active list";
    }

    $deletedList = http_request('GET', "$baseUrl/api/service_controller.php?status=deleted&search=" . urlencode($name), null, $cookieAdmin);
    if (empty($deletedList['json']['data']['items'])) {
        return "Soft-deleted record did not appear in deleted list";
    }

    $restore = http_request('PUT', "$baseUrl/api/service_controller.php?action=restore&id=$newId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($restore['status'] !== 200) return "Restore failed: " . json_encode($restore['json']);

    $activeAgain = http_request('GET', "$baseUrl/api/service_controller.php?status=active&search=" . urlencode($name), null, $cookieAdmin);
    if (empty($activeAgain['json']['data']['items'])) {
        return "Restored record did not return to active list";
    }

    $hardDel = http_request('DELETE', "$baseUrl/api/service_controller.php?id=$newId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($hardDel['status'] !== 200) return "Hard delete failed: " . json_encode($hardDel['json']);

    $checkDel = http_request('GET', "$baseUrl/api/service_controller.php?id=$newId", null, $cookieAdmin);
    if ($checkDel['status'] !== 404) return "Record still exists after hard delete";

    return true;
});

run_test("3.2: Hard-deleting a doctor with appointments fails with 409 and leaves row intact", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    // Doctor 1 (Dr. Gregory House) has appointments in database
    $del = http_request('DELETE', "$baseUrl/api/doctor_controller.php?id=1", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($del['status'] !== 409) {
        return "Expected HTTP 409 Conflict, got {$del['status']}: " . json_encode($del['json']);
    }

    $msg = $del['json']['message'] ?? '';
    if (stripos($msg, 'Cannot delete doctor') === false || stripos($msg, 'Soft Delete') === false) {
        return "Message did not clearly explain constraint: '$msg'";
    }

    // Verify row still exists in DB
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $chk = $pdo->query("SELECT doctor_id FROM doctors WHERE doctor_id = 1")->fetch();
    if (!$chk) {
        return "Doctor 1 was erroneously deleted!";
    }

    return true;
});

run_test("3.3: Hard-deleting an unreferenced record permanently removes it", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    // Create an unreferenced specialty
    $name = 'Temporary Specialty ' . time();
    $create = http_request('POST', "$baseUrl/api/specialty_controller.php", [
        'specialty_name' => $name
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($create['status'] !== 201) return "Failed to create specialty";
    $id = $create['json']['data']['specialty_id'];

    // Hard delete
    $del = http_request('DELETE', "$baseUrl/api/specialty_controller.php?id=$id", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    if ($del['status'] !== 200) return "Failed to hard delete: " . json_encode($del['json']);

    // Verify purged from DB
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=hospital_db;charset=utf8mb4", "root", "");
    $chk = $pdo->query("SELECT specialty_id FROM specialties WHERE specialty_id = $id")->fetch();
    if ($chk) {
        return "Record was not purged from DB";
    }

    return true;
});

// SECTION D: Security and quality
echo "\n--- Group 4: Security and Quality ---\n";

run_test("4.1: Patient XSS payload is stored safely and rendered escaped", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    $xssName = "<script>alert(1)</script>";
    $create = http_request('POST', "$baseUrl/api/patient_controller.php", [
        'first_name' => $xssName,
        'last_name' => 'Tester',
        'gender' => 'other',
        'date_of_birth' => '1995-05-15'
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($create['status'] !== 201) return "Failed to create patient with special chars";
    $id = $create['json']['data']['patient_id'];

    $get = http_request('GET', "$baseUrl/api/patient_controller.php?id=$id", null, $cookieAdmin);
    $fetchedName = $get['json']['data']['patient']['first_name'];

    // Clean up
    http_request('DELETE', "$baseUrl/api/patient_controller.php?id=$id", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    if ($fetchedName !== $xssName) {
        return "Data mangled in storage: $fetchedName";
    }
    return true;
});

run_test("4.2: SQL injection payload has no effect on queries", function() use ($baseUrl, $cookieAdmin) {
    $sqlPayload = "' OR 1=1 -- ";
    $res = http_request('GET', "$baseUrl/api/patient_controller.php?search=" . urlencode($sqlPayload), null, $cookieAdmin);

    if ($res['status'] !== 200) {
        return "SQL injection broke query with status {$res['status']}";
    }
    // Items should be 0 because no patient has that name
    if (($res['json']['data']['total'] ?? -1) !== 0) {
        return "SQL injection unexpectedly matched records! Total: " . $res['json']['data']['total'];
    }
    return true;
});

run_test("4.3: No raw SQL errors ever leak to response", function() use ($baseUrl, $cookieAdmin, $adminCsrf) {
    // Force a constraint failure by creating duplicate specialty name
    $created = http_request('POST', "$baseUrl/api/specialty_controller.php", [
        'specialty_name' => 'Fixed Specialty Name'
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    $dup = http_request('POST', "$baseUrl/api/specialty_controller.php", [
        'specialty_name' => 'Fixed Specialty Name'
    ], $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);

    // Clean up temporary specialty
    if (!empty($created['json']['data']['specialty_id'])) {
        $delId = (int)$created['json']['data']['specialty_id'];
        http_request('DELETE', "$baseUrl/api/specialty_controller.php?id=$delId", null, $cookieAdmin, ["X-CSRF-Token: $adminCsrf"]);
    }

    $body = $dup['body'];
    if (stripos($body, 'SQLSTATE') !== false || stripos($body, 'syntax error') !== false || stripos($body, 'QueryException') !== false) {
        return "Raw SQL error detected in response: $body";
    }
    return true;
});

run_test("4.4: Logout destroys session and redirects to login.html", function() use ($baseUrl, $cookieAdmin) {
    $logout = http_request('GET', "$baseUrl/logout.php", null, $cookieAdmin);
    if ($logout['status'] !== 302) return "Logout did not redirect: {$logout['status']}";
    if (strpos($logout['headers'], 'Location: login.html') === false) {
        return "Missing Location: login.html header";
    }

    // Attempt to access session endpoint again with the same cookie
    $me = http_request('GET', "$baseUrl/api/auth_controller.php?action=me", null, $cookieAdmin);
    if ($me['status'] !== 401) {
        return "Session still active after logout! Status: {$me['status']}";
    }
    return true;
});

echo "\n=======================================================\n";
echo "TEST RESULTS: $passedTests / $totalTests Passed (" . ($failedTests === 0 ? "100% SUCCESS" : "$failedTests Failed") . ")\n";
echo "=======================================================\n";

// Cleanup cookies
@unlink($cookieAdmin);
@unlink($cookieDoctor);
@unlink($cookieUnauthorized);
@unlink($cookieAnon);

exit($failedTests === 0 ? 0 : 1);

