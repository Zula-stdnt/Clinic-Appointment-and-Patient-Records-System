<?php

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'hospital_db_test';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$dbCharset = getenv('DB_CHARSET') ?: 'utf8mb4';

if ($dbName !== 'hospital_db_test' || !in_array($dbHost, ['127.0.0.1', 'localhost'], true)) {
    fwrite(STDERR, "Refusing to run unless the database is hospital_db_test on loopback.\n");
    exit(1);
}

$dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset={$dbCharset}";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, $options);
} catch (PDOException $exception) {
    fwrite(STDERR, "Could not connect to isolated database: {$exception->getMessage()}\n");
    exit(1);
}

if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== 'hospital_db_test') {
    fwrite(STDERR, "Connected database identity check failed.\n");
    exit(1);
}

$projectRoot = dirname(__DIR__);
$htdocs = 'C:/xampp/htdocs';
$webName = 'doctor_parallel_' . bin2hex(random_bytes(8));
$webRoot = $htdocs . '/' . $webName;
$cookieFiles = [];
$fixtureIds = ['appointment' => null, 'doctor' => null, 'patient' => null, 'user' => null];
$lockerActive = false;
$multiHandle = null;
$curlHandles = [];
$exitCode = 1;

function ensureDirectory(string $path): void {
    if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
        throw new RuntimeException("Could not create test directory: {$path}");
    }
}

function copyRequiredFile(string $source, string $destination): void {
    ensureDirectory(dirname($destination));
    if (!copy($source, $destination)) {
        throw new RuntimeException("Could not copy required API file: {$source}");
    }
}

function request(string $url, string $method = 'GET', ?array $payload = null, ?string $cookieFile = null, array $headers = []): array {
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CUSTOMREQUEST => $method,
    ]);
    if ($cookieFile !== null) {
        curl_setopt($handle, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($handle, CURLOPT_COOKIEJAR, $cookieFile);
    }
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload, JSON_THROW_ON_ERROR));
    }
    if ($headers) {
        curl_setopt($handle, CURLOPT_HTTPHEADER, $headers);
    }
    $body = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($body === false) {
        throw new RuntimeException("HTTP request failed: {$error}");
    }
    return ['status' => $status, 'body' => $body, 'json' => json_decode($body, true) ?: []];
}

function makeCookieFile(array &$cookieFiles): string {
    $path = tempnam(sys_get_temp_dir(), 'doctor_parallel_');
    if ($path === false) {
        throw new RuntimeException('Could not create a temporary cookie jar.');
    }
    $cookieFiles[] = $path;
    return $path;
}

function eraseTree(string $path): bool {
    if (!is_dir($path) || is_link($path)) {
        return !file_exists($path) || @unlink($path);
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $entry) {
        $ok = $entry->isDir() && !$entry->isLink()
            ? @rmdir($entry->getPathname())
            : @unlink($entry->getPathname());
        if (!$ok) {
            return false;
        }
    }
    return @rmdir($path);
}

function collectLockWaiters(PDO $pdo, int $lockerConnectionId): array {
    $waitingIds = $pdo->query(
        "SELECT trx_mysql_thread_id FROM information_schema.INNODB_TRX WHERE trx_state = 'LOCK WAIT'"
    )->fetchAll(PDO::FETCH_COLUMN);
    $waitingIds = array_fill_keys(array_map('intval', $waitingIds), true);
    $matching = [];
    foreach ($pdo->query('SHOW FULL PROCESSLIST')->fetchAll() as $process) {
        $id = (int)$process['Id'];
        $info = strtolower((string)($process['Info'] ?? ''));
        if ($id !== $lockerConnectionId
            && isset($waitingIds[$id])
            && str_contains($info, 'from appointments')
            && str_contains($info, 'for update')) {
            $matching[$id] = true;
        }
    }
    return array_keys($matching);
}

function drainMultiRequests($multiHandle, array $curlHandles, float $timeoutSeconds): array {
    $deadline = microtime(true) + $timeoutSeconds;
    $active = 0;
    do {
        do {
            $result = curl_multi_exec($multiHandle, $active);
        } while ($result === CURLM_CALL_MULTI_PERFORM);
        if ($active > 0) {
            if (curl_multi_select($multiHandle, 0.1) === -1) {
                usleep(10000);
            }
        }
    } while ($active > 0 && microtime(true) < $deadline);
    if ($active > 0) {
        throw new RuntimeException('Parallel API requests did not finish before timeout.');
    }
    $responses = [];
    foreach ($curlHandles as $handle) {
        $body = curl_multi_getcontent($handle);
        $responses[] = [
            'status' => (int)curl_getinfo($handle, CURLINFO_HTTP_CODE),
            'body' => $body,
            'json' => json_decode((string)$body, true) ?: [],
        ];
    }
    return $responses;
}

try {
    if (!is_dir($htdocs) || !is_writable($htdocs)) {
        throw new RuntimeException('XAMPP htdocs is not available or writable.');
    }
    $apacheProbe = @fsockopen('127.0.0.1', 80, $errorNumber, $errorMessage, 1);
    if (!$apacheProbe) {
        throw new RuntimeException('Local Apache is not listening on 127.0.0.1:80.');
    }
    fclose($apacheProbe);

    $doctorRoleId = $pdo->query("SELECT role_id FROM roles WHERE role_name = 'Doctor'")->fetchColumn();
    if (!$doctorRoleId) {
        throw new RuntimeException('The isolated database is missing the Doctor role.');
    }

    ensureDirectory($webRoot . '/api');
    ensureDirectory($webRoot . '/includes');
    ensureDirectory($webRoot . '/config');
    if (file_put_contents($webRoot . '/.htaccess', "Require local\n") === false) {
        throw new RuntimeException('Could not restrict the temporary API copy to local clients.');
    }
    foreach (['auth_controller.php', 'consultation_controller.php'] as $file) {
        copyRequiredFile("{$projectRoot}/api/{$file}", "{$webRoot}/api/{$file}");
    }
    foreach (['auth.php', 'response.php'] as $file) {
        copyRequiredFile("{$projectRoot}/includes/{$file}", "{$webRoot}/includes/{$file}");
    }

    $testConfig = "<?php\n"
        . '$db_host = ' . var_export($dbHost, true) . ";\n"
        . '$db_port = ' . var_export($dbPort, true) . ";\n"
        . '$db_name = \'hospital_db_test\';' . "\n"
        . '$db_user = ' . var_export($dbUser, true) . ";\n"
        . '$db_pass = ' . var_export($dbPass, true) . ";\n"
        . '$db_charset = ' . var_export($dbCharset, true) . ";\n"
        . '$dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset={$db_charset}";' . "\n"
        . '$pdo = new PDO($dsn, $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);' . "\n"
        . "if (\$pdo->query('SELECT DATABASE()')->fetchColumn() !== 'hospital_db_test') { http_response_code(500); exit; }\n";
    if (file_put_contents($webRoot . '/config/db_connect.php', $testConfig) === false) {
        throw new RuntimeException('Could not write the isolated API database config.');
    }

    $healthToken = bin2hex(random_bytes(16));
    $healthCode = "<?php echo json_encode(['token' => '{$healthToken}', 'sapi' => PHP_SAPI, 'server' => \$_SERVER['SERVER_SOFTWARE'] ?? '']);";
    if (file_put_contents($webRoot . '/health.php', $healthCode) === false) {
        throw new RuntimeException('Could not create the temporary health endpoint.');
    }
    $webPrefix = "http://127.0.0.1/{$webName}";
    $health = request("{$webPrefix}/health.php");
    $healthData = json_decode($health['body'], true);
    if ($health['status'] !== 200
        || ($healthData['token'] ?? null) !== $healthToken
        || ($healthData['sapi'] ?? null) !== 'apache2handler'
        || stripos((string)($healthData['server'] ?? ''), 'Apache') === false) {
        throw new RuntimeException('Temporary local Apache/PHP identity check failed.');
    }

    $username = 'parallel_' . bin2hex(random_bytes(8));
    $password = 'TestPass123!';
    $insertUser = $pdo->prepare(
        'INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $insertUser->execute([$doctorRoleId, $username, password_hash($password, PASSWORD_DEFAULT), 'Parallel', 'Doctor', 'Unknown']);
    $fixtureIds['user'] = (int)$pdo->lastInsertId();

    $insertDoctor = $pdo->prepare('INSERT INTO doctors (user_id, contact_no) VALUES (?, ?)');
    $insertDoctor->execute([$fixtureIds['user'], '09123456789']);
    $fixtureIds['doctor'] = (int)$pdo->lastInsertId();

    $insertPatient = $pdo->prepare('INSERT INTO patients (first_name, last_name, gender, date_of_birth) VALUES (?, ?, ?, ?)');
    $insertPatient->execute(['Parallel', 'Patient', 'Unknown', '1990-01-01']);
    $fixtureIds['patient'] = (int)$pdo->lastInsertId();

    $insertAppointment = $pdo->prepare(
        "INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (?, ?, ?, ?, ?, 'scheduled')"
    );
    $insertAppointment->execute([
        $fixtureIds['patient'], $fixtureIds['doctor'], $fixtureIds['user'], date('Y-m-d'), date('H:i:s'),
    ]);
    $fixtureIds['appointment'] = (int)$pdo->lastInsertId();

    $sessions = [];
    foreach ([1, 2] as $index) {
        $cookieFile = makeCookieFile($cookieFiles);
        $login = request("{$webPrefix}/api/auth_controller.php?action=login", 'POST', [
            'username' => $username,
            'password' => $password,
        ], $cookieFile);
        if ($login['status'] !== 200 || empty($login['json']['data']['csrf_token'])) {
            throw new RuntimeException("Doctor login session {$index} failed: " . json_encode($login));
        }
        $sessions[] = ['cookie' => $cookieFile, 'csrf' => $login['json']['data']['csrf_token']];
    }

    $pdo->beginTransaction();
    $lockerActive = true;
    $lockerId = (int)$pdo->query('SELECT CONNECTION_ID()')->fetchColumn();
    $lockAppointment = $pdo->prepare('SELECT appointment_id FROM appointments WHERE appointment_id = ? FOR UPDATE');
    $lockAppointment->execute([$fixtureIds['appointment']]);
    if (!$lockAppointment->fetchColumn()) {
        throw new RuntimeException('Could not acquire the staging appointment row lock.');
    }

    $multiHandle = curl_multi_init();
    $payloads = [
        ['appointment_id' => $fixtureIds['appointment'], 'notes' => 'Concurrent request one'],
        ['appointment_id' => $fixtureIds['appointment'], 'notes' => 'Concurrent request two'],
    ];
    foreach ($sessions as $index => $session) {
        $handle = curl_init("{$webPrefix}/api/consultation_controller.php");
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payloads[$index], JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $session['csrf']],
            CURLOPT_COOKIEFILE => $session['cookie'],
            CURLOPT_COOKIEJAR => $session['cookie'],
        ]);
        $curlHandles[] = $handle;
        curl_multi_add_handle($multiHandle, $handle);
    }

    $deadline = microtime(true) + 15;
    $active = 0;
    $waitingIds = [];
    do {
        do {
            $multiResult = curl_multi_exec($multiHandle, $active);
        } while ($multiResult === CURLM_CALL_MULTI_PERFORM);
        $waitingIds = collectLockWaiters($pdo, $lockerId);
        if (count($waitingIds) >= 2 || $active === 0) {
            break;
        }
        if (curl_multi_select($multiHandle, 0.05) === -1) {
            usleep(10000);
        }
    } while (microtime(true) < $deadline);

    if (count($waitingIds) < 2) {
        $pdo->rollBack();
        $lockerActive = false;
        drainMultiRequests($multiHandle, $curlHandles, 30);
        throw new RuntimeException('Both API connections were not observed waiting simultaneously on the appointment lock.');
    }

    $pdo->commit();
    $lockerActive = false;
    $responses = drainMultiRequests($multiHandle, $curlHandles, 30);
    $statuses = array_column($responses, 'status');
    sort($statuses);
    if ($statuses !== [200, 409]) {
        throw new RuntimeException('Expected one 200 and one 409 after lock release; received ' . json_encode($statuses));
    }

    $appointmentCheck = $pdo->prepare('SELECT status FROM appointments WHERE appointment_id = ?');
    $appointmentCheck->execute([$fixtureIds['appointment']]);
    if ($appointmentCheck->fetchColumn() !== 'completed') {
        throw new RuntimeException('The winning request did not complete the appointment.');
    }
    $consultationCheck = $pdo->prepare('SELECT COUNT(*) FROM consultation WHERE appointment_id = ?');
    $consultationCheck->execute([$fixtureIds['appointment']]);
    if ((int)$consultationCheck->fetchColumn() !== 1) {
        throw new RuntimeException('Expected exactly one consultation after concurrent submissions.');
    }

    echo "PASS: two distinct authenticated requests were simultaneously observed in InnoDB LOCK WAIT for the same appointment.\n";
    echo "PASS: after releasing the lock, exactly one request returned 200 and the other returned 409.\n";
    echo "PASS: the appointment completed with exactly one consultation row.\n";
    $exitCode = 0;
} catch (Throwable $exception) {
    fwrite(STDERR, "FAIL: {$exception->getMessage()}\n");
} finally {
    if ($lockerActive && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($multiHandle !== null) {
        foreach ($curlHandles as $handle) {
            @curl_multi_remove_handle($multiHandle, $handle);
            @curl_close($handle);
        }
        curl_multi_close($multiHandle);
    }

    $cleanupErrors = [];
    if ($fixtureIds['appointment'] !== null) {
        try {
            $deleteAppointment = $pdo->prepare('DELETE FROM appointments WHERE appointment_id = ?');
            $deleteAppointment->execute([$fixtureIds['appointment']]);
        } catch (Throwable $exception) {
            $cleanupErrors[] = 'appointment: ' . $exception->getMessage();
        }
    }
    foreach (['doctor' => 'doctors', 'patient' => 'patients', 'user' => 'users'] as $key => $table) {
        if ($fixtureIds[$key] !== null) {
            $column = ['doctor' => 'doctor_id', 'patient' => 'patient_id', 'user' => 'user_id'][$key];
            try {
                $deleteFixture = $pdo->prepare("DELETE FROM {$table} WHERE {$column} = ?");
                $deleteFixture->execute([$fixtureIds[$key]]);
            } catch (Throwable $exception) {
                $cleanupErrors[] = "{$key}: " . $exception->getMessage();
            }
        }
    }
    foreach ($cookieFiles as $cookieFile) {
        if (file_exists($cookieFile) && !@unlink($cookieFile)) {
            $cleanupErrors[] = "cookie jar: {$cookieFile}";
        }
    }
    if (is_dir($webRoot) && !eraseTree($webRoot)) {
        $cleanupErrors[] = "temporary API copy: {$webRoot}";
    }
    if ($cleanupErrors) {
        fwrite(STDERR, 'CLEANUP FAILED: ' . implode('; ', $cleanupErrors) . "\n");
        $exitCode = 1;
    }
}

exit($exitCode);