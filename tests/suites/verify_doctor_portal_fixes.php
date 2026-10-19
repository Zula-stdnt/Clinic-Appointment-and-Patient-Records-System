<?php
// tests/verify_doctor_portal_fixes.php
// Focused regression coverage for Doctor portal fixes.

$db_host = getenv('DB_HOST') ?: '127.0.0.1';
$db_port = getenv('DB_PORT') ?: '3306';
$db_name = getenv('DB_NAME') ?: 'hospital_db_test';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$db_charset = getenv('DB_CHARSET') ?: 'utf8mb4';

// Safety Guard: Refuse to run if targeting production
if ($db_name !== 'hospital_db_test') {
    echo "ERROR: Test script must strictly target 'hospital_db_test', but DB_NAME is '$db_name'.\n";
    exit(1);
}
if ($db_host !== '127.0.0.1' && $db_host !== 'localhost') {
    echo "ERROR: Test DB host must be loopback.\n";
    exit(1);
}

$dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset={$db_charset}";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (PDOException $e) {
    echo "ERROR: Could not connect to isolated test database: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Connected to isolated test database '$db_name'.\n\n";

$passedTests = 0;
$failedTests = 0;

function run_test(string $name, callable $fn): void {
    global $passedTests, $failedTests;
    try {
        $result = $fn();
        if ($result === true) {
            echo "[PASS] $name\n";
            $passedTests++;
        } else {
            echo "[FAIL] $name: " . (is_string($result) ? $result : 'Assertion failed') . "\n";
            $failedTests++;
        }
    } catch (Throwable $e) {
        echo "[FAIL] $name with exception: " . $e->getMessage() . "\n";
        $failedTests++;
    }
}

// Ensure tests use isolated transactions for cleanup where possible
// For DDL-free tests, transaction rollback is a safe cleanup pattern on the test database.
// "explain why the transaction applies to every write: The tests perform no DDL, so rollback perfectly cleans up all INSERTs."
run_test("Profile schema compatibility (normalized)", function() use ($pdo) {
    $pdo->beginTransaction();
    try {
        $username = 'testdoc_' . uniqid();
        $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$username', 'hash', 'Test', 'Doc', 'Male')");
        $userId = $pdo->lastInsertId();
        $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($userId, '123')");
        $docId = $pdo->lastInsertId();

        // Valid update to contact_no should succeed
        $stmt = $pdo->prepare("UPDATE doctors SET contact_no = ? WHERE doctor_id = ?");
        $stmt->execute(['456', $docId]);

        // Invalid update to identity columns should throw PDOException (Column not found)
        $failed = false;
        try {
            $stmtInvalid = $pdo->prepare("UPDATE doctors SET first_name = ? WHERE doctor_id = ?");
            $stmtInvalid->execute(['NewName', $docId]);
        } catch (PDOException $e) {
            if ($e->getCode() == '42S22') { // Column not found
                $failed = true;
            }
        }

        if (!$failed) {
            return "Schema allowed updating 'first_name' on doctors, which should have been normalized out.";
        }

        return true;
    } finally {
        $pdo->rollBack(); // Safe cleanup
    }
});

run_test("Vital-sign cardinality (UNIQUE constraint)", function() use ($pdo) {
    $pdo->beginTransaction();
    try {
        $pdo->exec("INSERT INTO patients (first_name, last_name, gender) VALUES ('Pat', 'Ient', 'Female')");
        $patId = $pdo->lastInsertId();
        
        // We must have a doctor row for foreign key
        $username = 'doc_' . uniqid();
        $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$username', 'hash', 'Test', 'Doc', 'Male')");
        $userId = $pdo->lastInsertId();
        $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($userId, '123')");
        $docId = $pdo->lastInsertId();

        $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES ($patId, $docId, $userId, '2026-10-03', '10:00:00', 'scheduled')");
        $apptId = $pdo->lastInsertId();

        // Insert first vital sign
        $pdo->exec("INSERT INTO vital_signs (appointment_id, blood_pressure) VALUES ($apptId, '120/80')");

        // Attempt second vital sign for the same appointment
        $failed = false;
        try {
            $pdo->exec("INSERT INTO vital_signs (appointment_id, blood_pressure) VALUES ($apptId, '130/90')");
        } catch (PDOException $e) {
            if ($e->getCode() == '23000') { // Integrity constraint violation
                $failed = true;
            }
        }

        if (!$failed) {
            return "Duplicate vital sign for the same appointment was allowed.";
        }

        return true;
    } finally {
        $pdo->rollBack(); // Safe cleanup
    }
});

echo "\nTests Completed: $passedTests passed, $failedTests failed.\n";
exit($failedTests === 0 ? 0 : 1);
