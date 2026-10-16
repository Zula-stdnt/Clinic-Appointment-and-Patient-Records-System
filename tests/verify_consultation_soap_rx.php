<?php
// tests/verify_consultation_soap_rx.php
// Verification suite for Doctor Consultation SOAP Notes and Structured Prescriptions

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

// 1. Schema Column Verification
run_test("Database schema: prescriptions table contains structured clinical columns", function() use ($pdo) {
    $stmt = $pdo->query("SHOW COLUMNS FROM prescriptions");
    $columns = array_column($stmt->fetchAll(), 'Field');

    $required = ['strength', 'dosage', 'route', 'frequency', 'duration', 'instructions', 'time_to_take', 'start_date', 'end_date'];
    foreach ($required as $col) {
        if (!in_array($col, $columns)) {
            return "Missing column '$col' in prescriptions table.";
        }
    }
    return true;
});

// 2. SOAP Parser and Compiler Logic Verification
run_test("SOAP parser and compiler logic: bidirectional round-trip", function() {
    require_once __DIR__ . '/../includes/clinical_notes.php';

    $originalSoap = [
        'subjective' => 'Patient complains of throbbing headache and fever for 2 days.',
        'objective'  => 'BP 125/80 mmHg, Temp 38.3 C, clear lungs, pharyngeal erythema.',
        'assessment' => 'Acute viral upper respiratory tract infection.',
        'plan'       => 'Paracetamol 500mg, oral rehydration, rest for 3 days.'
    ];

    $compiled = compile_soap_notes($originalSoap);
    if (strpos($compiled, 'SUBJECTIVE:') === false || strpos($compiled, 'PLAN:') === false) {
        return "Compiled SOAP text does not contain required section headers.";
    }

    $parsed = parse_soap_notes($compiled);
    if ($parsed['subjective'] !== $originalSoap['subjective']) {
        return "Parsed subjective does not match original: '{$parsed['subjective']}' vs '{$originalSoap['subjective']}'";
    }
    if ($parsed['objective'] !== $originalSoap['objective']) {
        return "Parsed objective does not match original: '{$parsed['objective']}' vs '{$originalSoap['objective']}'";
    }
    if ($parsed['assessment'] !== $originalSoap['assessment']) {
        return "Parsed assessment does not match original: '{$parsed['assessment']}' vs '{$originalSoap['assessment']}'";
    }
    if ($parsed['plan'] !== $originalSoap['plan']) {
        return "Parsed plan does not match original: '{$parsed['plan']}' vs '{$originalSoap['plan']}'";
    }

    return true;
});

// 3. Backward Compatibility with Legacy Plain Notes
run_test("SOAP parser: legacy plain-text note backwards compatibility", function() {
    $legacyNote = "Patient seen for annual routine executive check-up. ECG normal. Advised diet modification.";
    $parsed = parse_soap_notes($legacyNote);

    if ($parsed['subjective'] !== $legacyNote) {
        return "Legacy note was not placed into subjective section.";
    }
    if (!empty($parsed['objective']) || !empty($parsed['assessment']) || !empty($parsed['plan'])) {
        return "Other SOAP sections should be empty for legacy unstructured text.";
    }

    return true;
});

// 4. End-to-End Database Save & Retrieval for SOAP and Structured Prescriptions
run_test("Encounter lifecycle: save SOAP notes and structured prescriptions atomically", function() use ($pdo) {
    $pdo->beginTransaction();
    try {
        // Setup user, doctor, patient, appointment
        $username = 'testdoc_soap_' . uniqid();
        $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$username', 'hash', 'Test', 'Doctor', 'Female')");
        $userId = (int)$pdo->lastInsertId();
        $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($userId, '09123456789')");
        $doctorId = (int)$pdo->lastInsertId();

        $pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth) VALUES ('Juan', 'Dela Cruz', 'male', '1990-05-15')");
        $patientId = (int)$pdo->lastInsertId();

        $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, chief_complaint, status, created_by) VALUES ($patientId, $doctorId, '2026-10-17', '10:00:00', 'Persistent dry cough', 'confirmed', $userId)");
        $appointmentId = (int)$pdo->lastInsertId();

        // Get or insert medication
        $medStmt = $pdo->query("SELECT medication_id FROM medications LIMIT 1");
        $medId = $medStmt->fetchColumn();
        if (!$medId) {
            $pdo->exec("INSERT INTO medications (name, generic_name) VALUES ('Amoxicillin', 'Amoxicillin Trihydrate')");
            $medId = (int)$pdo->lastInsertId();
        }

        // Simulate saveConsultation payload
        $soapInput = [
            'subjective' => 'Dry cough x 5 days, no dyspnea, mild throat itchiness.',
            'objective'  => 'BP 118/76, Temp 36.8 C, SpO2 99%. Lungs clear to auscultation.',
            'assessment' => 'Post-viral bronchial hyperreactivity.',
            'plan'       => 'Hydration, antitussive as needed, follow-up in 1 week.'
        ];
        $compiledNotes = compile_soap_notes($soapInput);

        // 1. Insert consultation
        $pdo->exec("INSERT INTO consultation (appointment_id, notes, consultation_date) VALUES ($appointmentId, " . $pdo->quote($compiledNotes) . ", NOW())");
        $consultationId = (int)$pdo->lastInsertId();

        // 2. Insert structured prescriptions
        $stmtRx = $pdo->prepare("INSERT INTO prescriptions (consultation_id, medication_id, strength, dosage, route, frequency, duration, instructions, time_to_take, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmtRx->execute([
            $consultationId,
            $medId,
            '500 mg',
            '1 capsule',
            'Oral (PO)',
            'Three times daily (TID)',
            '7 days',
            'Take after meals with a full glass of water',
            'After breakfast, lunch, and dinner',
            '2026-10-17',
            '2026-10-24'
        ]);

        // 3. Mark appointment completed
        $pdo->exec("UPDATE appointments SET status = 'completed' WHERE appointment_id = $appointmentId");

        // Verify retrieval matches exactly
        $chkCons = $pdo->query("SELECT notes FROM consultation WHERE consultation_id = $consultationId")->fetch(PDO::FETCH_ASSOC);
        $retrievedSoap = parse_soap_notes($chkCons['notes']);

        if ($retrievedSoap['subjective'] !== $soapInput['subjective']) {
            return "Retrieved subjective does not match saved input.";
        }
        if ($retrievedSoap['plan'] !== $soapInput['plan']) {
            return "Retrieved plan does not match saved input.";
        }

        // Verify prescriptions row
        $chkRx = $pdo->query("SELECT * FROM prescriptions WHERE consultation_id = $consultationId")->fetch(PDO::FETCH_ASSOC);
        if (!$chkRx) {
            return "Prescription row not found.";
        }
        if ($chkRx['strength'] !== '500 mg') {
            return "Prescription strength mismatch: '{$chkRx['strength']}'";
        }
        if ($chkRx['route'] !== 'Oral (PO)') {
            return "Prescription route mismatch: '{$chkRx['route']}'";
        }
        if ($chkRx['frequency'] !== 'Three times daily (TID)') {
            return "Prescription frequency mismatch: '{$chkRx['frequency']}'";
        }
        if ($chkRx['duration'] !== '7 days') {
            return "Prescription duration mismatch: '{$chkRx['duration']}'";
        }
        if ($chkRx['instructions'] !== 'Take after meals with a full glass of water') {
            return "Prescription instructions mismatch: '{$chkRx['instructions']}'";
        }

        return true;
    } finally {
        $pdo->rollBack(); // Clean rollback on isolated test DB
    }
});

// 5. Patient Record Longitudinal Encounter Query Parity
run_test("Patient record controller: longitudinal history retrieves structured prescriptions", function() use ($pdo) {
    $pdo->beginTransaction();
    try {
        $username = 'testdoc_rec_' . uniqid();
        $pdo->exec("INSERT INTO users (role_id, username, password_hash, first_name, last_name, gender) VALUES (3, '$username', 'hash', 'Attending', 'Physician', 'Male')");
        $userId = (int)$pdo->lastInsertId();
        $pdo->exec("INSERT INTO doctors (user_id, contact_no) VALUES ($userId, '09999999999')");
        $doctorId = (int)$pdo->lastInsertId();

        $pdo->exec("INSERT INTO patients (first_name, last_name, gender, date_of_birth) VALUES ('Maria', 'Santos', 'female', '1985-08-20')");
        $patientId = (int)$pdo->lastInsertId();

        $pdo->exec("INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, chief_complaint, status, created_by) VALUES ($patientId, $doctorId, '2026-10-15', '09:00:00', 'Checkup', 'completed', $userId)");
        $appointmentId = (int)$pdo->lastInsertId();

        $pdo->exec("INSERT INTO consultation (appointment_id, notes, consultation_date) VALUES ($appointmentId, 'SUBJECTIVE:\nFollowup.\n\nOBJECTIVE:\nNormal.\n\nASSESSMENT:\nHealthy.\n\nPLAN:\nRoutine.', NOW())");
        $consultationId = (int)$pdo->lastInsertId();

        $medStmt = $pdo->query("SELECT medication_id FROM medications LIMIT 1");
        $medId = $medStmt->fetchColumn();
        if (!$medId) {
            $pdo->exec("INSERT INTO medications (name, generic_name) VALUES ('Cetirizine', 'Cetirizine HCl')");
            $medId = (int)$pdo->lastInsertId();
        }

        $pdo->exec("INSERT INTO prescriptions (consultation_id, medication_id, strength, dosage, route, frequency, duration, instructions, start_date)
                    VALUES ($consultationId, $medId, '10 mg', '1 tablet', 'Oral (PO)', 'Once daily (OD)', '30 days', 'Take at bedtime', '2026-10-15')");

        // Execute exact query from patient_record_controller.php
        $rStmt = $pdo->prepare("SELECT p.prescription_id, p.medication_id, p.strength, p.dosage, p.route,
                                       p.frequency, p.duration, p.instructions, p.time_to_take, p.start_date, p.end_date,
                                       m.name AS medication_name, m.generic_name
                                FROM prescriptions p
                                INNER JOIN medications m ON p.medication_id = m.medication_id
                                WHERE p.consultation_id = ?
                                ORDER BY p.prescription_id ASC");
        $rStmt->execute([$consultationId]);
        $rows = $rStmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($rows) !== 1) {
            return "Expected 1 prescription row, got " . count($rows);
        }
        $rx = $rows[0];
        if ($rx['strength'] !== '10 mg' || $rx['route'] !== 'Oral (PO)' || $rx['instructions'] !== 'Take at bedtime') {
            return "Structured prescription attributes not retrieved correctly by patient record query.";
        }

        return true;
    } finally {
        $pdo->rollBack();
    }
});

echo "\n=======================================================\n";
echo "TEST RESULTS: $passedTests passed, $failedTests failed.\n";
echo "=======================================================\n";

if ($failedTests > 0) {
    exit(1);
}
exit(0);
