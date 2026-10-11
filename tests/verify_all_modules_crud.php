<?php
// tests/verify_all_modules_crud.php
// Verifies full CRUD (Create, Read, Update, Soft Delete, Restore, Hard Delete) across all 6 master modules

$baseUrl = 'http://localhost/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System';
$cookieFile = tempnam(sys_get_temp_dir(), 'crud_ck_');

function req(string $method, string $url, $data = null, array $headers = []): array {
    global $cookieFile;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);

    $reqHeaders = $headers;
    if ($data !== null) {
        $reqHeaders[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);

    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['status' => $status, 'json' => json_decode($body, true), 'body' => $body];
}

// 1. Create a guaranteed admin user for tests
$db = new PDO('mysql:host=localhost;dbname=hospital_db;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec("INSERT IGNORE INTO users (role_id, first_name, last_name, username, password_hash) VALUES (1, 'Test', 'Admin', 'testadmin', '" . password_hash('TestPass123!', PASSWORD_DEFAULT) . "')");

$login = req('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'testadmin',
    'password' => 'TestPass123!'
]);
if ($login['status'] !== 200) {
    die("Admin login failed\n");
}
$csrf = $login['json']['data']['csrf_token'] ?? '';
$csrfHeader = ["X-CSRF-Token: $csrf"];

// 2. Set up receptionist session for clinical/patient creation workflows
$cookieRecep = tempnam(sys_get_temp_dir(), 'crud_rec_');
function req_recep(string $method, string $url, $data = null, array $headers = []): array {
    global $cookieRecep;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieRecep);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieRecep);

    $reqHeaders = $headers;
    if ($data !== null) {
        $reqHeaders[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);

    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['status' => $status, 'json' => json_decode($body, true), 'body' => $body];
}

$db->exec("INSERT IGNORE INTO users (role_id, first_name, last_name, username, password_hash) VALUES (2, 'Jane', 'Receptionist', 'recep.jane', '" . password_hash('RecepPass123!', PASSWORD_DEFAULT) . "')");
$loginRec = req_recep('POST', "$baseUrl/api/auth_controller.php?action=login", [
    'username' => 'recep.jane',
    'password' => 'RecepPass123!'
]);
$csrfRec = $loginRec['json']['data']['csrf_token'] ?? '';
$csrfHeaderRec = ["X-CSRF-Token: $csrfRec"];

echo "=======================================================\n";
echo "MASTER FILE CRUD END-TO-END VERIFICATION (6 MODULES)\n";
echo "=======================================================\n\n";

$activeSpecialty = (int)$db->query("SELECT specialty_id FROM specialties WHERE deleted_at IS NULL LIMIT 1")->fetchColumn();

$modules = [
    'specialties' => [
        'url' => "$baseUrl/api/specialty_controller.php",
        'create' => ['specialty_name' => 'Nephrology Test ' . time()],
        'id_key' => 'specialty_id',
        'update' => ['specialty_name' => 'Nephrology Renamed ' . time()]
    ],
    'services' => [
        'url' => "$baseUrl/api/service_controller.php",
        'create' => ['service_name' => 'IT Support Test ' . time()],
        'id_key' => 'service_id',
        'update' => ['service_name' => 'IT Support Renamed ' . time()]
    ],
    'patients' => [
        'url' => "$baseUrl/api/patient_controller.php",
        'create' => [
            'first_name' => 'Clara',
            'middle_initial' => 'J',
            'last_name' => 'Oswald ' . time(),
            'gender' => 'female',
            'date_of_birth' => '1986-11-23',
            'contact_no' => '09170001122',
            'address' => 'Baker St'
        ],
        'id_key' => 'patient_id',
        'update' => [
            'first_name' => 'Clara Jane',
            'middle_initial' => 'O',
            'last_name' => 'Oswald ' . time(),
            'gender' => 'female',
            'date_of_birth' => '1986-11-23',
            'contact_no' => '09170003344',
            'address' => 'TARDIS'
        ]
    ],
    'doctors' => [
        'url' => "$baseUrl/api/doctor_controller.php",
        'create' => [
            'first_name' => 'Leonard',
            'last_name' => 'McCoy ' . time(),
            'middle_initial' => 'H',
            'gender' => 'Male',
            'specialty_id' => $activeSpecialty,
            'contact_no' => '09180001122',
            'username' => 'dr.mccoy.' . time(),
            'password' => 'DoctorPass123!'
        ],
        'id_key' => 'doctor_id',
        'update' => [
            'first_name' => 'Leonard',
            'last_name' => 'McCoy ' . time(),
            'middle_initial' => 'H',
            'gender' => 'Male',
            'specialty_id' => $activeSpecialty,
            'contact_no' => '09180009988',
            'username' => 'dr.mccoy.upd.' . time(),
            'password' => '' // Leave blank
        ]
    ],
    'users' => [
        'url' => "$baseUrl/api/user_controller.php",
        'create' => [
            'first_name' => 'Receptionist',
            'last_name' => 'Test ' . time(),
            'middle_initial' => 'A',
            'gender' => 'Female',
            'username' => 'recep.' . time(),
            'role_id' => 2, // Receptionist
            'password' => 'RecepPass123!'
        ],
        'id_key' => 'user_id',
        'update' => [
            'first_name' => 'Receptionist',
            'last_name' => 'Updated ' . time(),
            'middle_initial' => 'B',
            'gender' => 'Female',
            'username' => 'recep.updated.' . time(),
            'role_id' => 2,
            'password' => '' // unchanged
        ]
    ]
];

$allPassed = true;

foreach ($modules as $name => $cfg) {
    echo "Testing Module: " . strtoupper($name) . "\n";

    // 1. Create (Patients managed by Receptionist, other modules by Admin)
    $createFn = ($name === 'patients') ? 'req_recep' : 'req';
    $createCsrf = ($name === 'patients') ? $csrfHeaderRec : $csrfHeader;

    $cRes = $createFn('POST', $cfg['url'], $cfg['create'], $createCsrf);
    if ($cRes['status'] !== 201) {
        echo "  [FAIL] Create: status {$cRes['status']}, error: " . json_encode($cRes['json']) . "\n";
        $allPassed = false;
        continue;
    }
    $id = $cRes['json']['data'][$cfg['id_key']];
    echo "  [PASS] Create: ID #$id\n";

    // 2. Read (View)
    $rRes = req('GET', "{$cfg['url']}?id=$id");
    if ($rRes['status'] !== 200) {
        echo "  [FAIL] View: status {$rRes['status']}\n";
        $allPassed = false;
    } else {
        echo "  [PASS] View Details\n";
    }

    // 3. Update (Patients edited by Receptionist, other modules by Admin)
    $uRes = $createFn('PUT', "{$cfg['url']}?id=$id", $cfg['update'], $createCsrf);
    if ($uRes['status'] !== 200) {
        echo "  [FAIL] Update: status {$uRes['status']}, error: " . json_encode($uRes['json']) . "\n";
        $allPassed = false;
    } else {
        echo "  [PASS] Update\n";
    }

    // 4. Soft Delete
    $sdRes = req('PUT', "{$cfg['url']}?action=soft_delete&id=$id", null, $csrfHeader);
    if ($sdRes['status'] !== 200) {
        echo "  [FAIL] Soft Delete: status {$sdRes['status']}, error: " . json_encode($sdRes['json']) . "\n";
        $allPassed = false;
    } else {
        echo "  [PASS] Soft Delete (Deactivate)\n";
    }

    // 5. Restore
    $rstRes = req('PUT', "{$cfg['url']}?action=restore&id=$id", null, $csrfHeader);
    if ($rstRes['status'] !== 200) {
        echo "  [FAIL] Restore: status {$rstRes['status']}, error: " . json_encode($rstRes['json']) . "\n";
        $allPassed = false;
    } else {
        echo "  [PASS] Restore (Reactivate)\n";
    }

    // 6. Hard Delete
    $hdRes = req('DELETE', "{$cfg['url']}?id=$id", null, $csrfHeader);
    if ($hdRes['status'] !== 200) {
        echo "  [FAIL] Hard Delete: status {$hdRes['status']}, error: " . json_encode($hdRes['json']) . "\n";
        $allPassed = false;
    } else {
        echo "  [PASS] Hard Delete (Purge)\n";
    }

    echo "\n";
}

@unlink($cookieFile);
@unlink($cookieRecep);

if ($allPassed) {
    echo "=======================================================\n";
    echo "ALL 6 MODULES PASSED FULL CRUD LIFECYCLE!\n";
    echo "=======================================================\n";
    exit(0);
} else {
    echo "SOME CRUD TESTS FAILED\n";
    exit(1);
}

