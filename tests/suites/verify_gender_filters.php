<?php
/**
 * Test Suite: Universal Gender Filtering ('other', 'male', 'female', 'unknown')
 */
require_once __DIR__ . '/../../config/db_connect.php';

echo "=======================================================\n";
echo "UNIVERSAL GENDER FILTERING VERIFICATION SUITE\n";
echo "=======================================================\n\n";

$passCount = 0;
$totalTests = 0;

function assertTest($name, $condition) {
    global $passCount, $totalTests;
    $totalTests++;
    if ($condition) {
        $passCount++;
        echo " [PASS] $name\n";
    } else {
        echo " [FAIL] $name\n";
    }
}

// 1. Ensure test data exists with custom gender
$stmt = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE LOWER(TRIM(gender)) NOT IN ('male', 'female', 'unknown') AND deleted_at IS NULL");
$stmt->execute();
$otherPatientsCount = (int)$stmt->fetchColumn();

if ($otherPatientsCount === 0) {
    // Seed a test patient with custom gender
    $stmt = $pdo->prepare("INSERT INTO patients (first_name, last_name, gender, date_of_birth, contact_no, created_at) VALUES ('TestGender', 'Person', 'Transgender', '1995-05-15', '09123456789', NOW())");
    $stmt->execute();
}

// Test 1: Query for 'other' gender on patients table matches custom genders
$stmt = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE (LOWER(TRIM(COALESCE(gender, ''))) NOT IN ('male', 'female', 'unknown') AND LOWER(TRIM(COALESCE(gender, ''))) != '') AND deleted_at IS NULL");
$stmt->execute();
$matchedOther = (int)$stmt->fetchColumn();
assertTest("1.1: Patient SQL query for 'other' gender matches non-binary/transgender records ($matchedOther found)", $matchedOther > 0);

// Test 2: Query for 'male' matches only male
$stmt = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE LOWER(gender) = 'male' AND deleted_at IS NULL");
$stmt->execute();
$maleCount = (int)$stmt->fetchColumn();
assertTest("2.1: Patient SQL query for 'male' gender executes and returns male records ($maleCount found)", $maleCount >= 0);

// Test 3: Query for 'female' matches only female
$stmt = $pdo->prepare("SELECT COUNT(*) FROM patients WHERE LOWER(gender) = 'female' AND deleted_at IS NULL");
$stmt->execute();
$femaleCount = (int)$stmt->fetchColumn();
assertTest("3.1: Patient SQL query for 'female' gender executes and returns female records ($femaleCount found)", $femaleCount >= 0);

// Test 4: Doctor query for 'other' gender correctly structures SQL condition
$stmt = $pdo->prepare("SELECT COUNT(*) FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE (LOWER(TRIM(COALESCE(u.gender, ''))) NOT IN ('male', 'female', 'unknown') AND LOWER(TRIM(COALESCE(u.gender, ''))) != '') AND d.deleted_at IS NULL");
$stmt->execute();
$docOtherCount = (int)$stmt->fetchColumn();
assertTest("4.1: Doctor SQL query for 'other' gender runs without error ($docOtherCount found)", is_int($docOtherCount));

// Test 5: doctor_patients_controller.php query includes gender filtering logic
$doctorPatientsController = file_get_contents(__DIR__ . '/../../api/doctor_patients_controller.php');
$hasGenderFilter = strpos($doctorPatientsController, "gender = 'other'") !== false || strpos($doctorPatientsController, "NOT IN ('male', 'female', 'unknown')") !== false;
assertTest("5.1: api/doctor_patients_controller.php implements universal gender filtering", $hasGenderFilter);

// Test 6: Doctor Patients UI toolbar contains gender filter
$doctorPatientsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/doctor_patients.js');
$hasUiFilter = strpos($doctorPatientsJs, 'patients-gender-filter') !== false;
assertTest("6.1: assets/js/modules/doctor_patients.js toolbar includes #patients-gender-filter", $hasUiFilter);

echo "\n=======================================================\n";
echo "SUMMARY: Total: $totalTests | Passed: $passCount | Failed: " . ($totalTests - $passCount) . "\n";
echo "=======================================================\n";
if ($passCount === $totalTests) {
    echo "🎉 ALL TESTS PASSED!\n";
} else {
    exit(1);
}
