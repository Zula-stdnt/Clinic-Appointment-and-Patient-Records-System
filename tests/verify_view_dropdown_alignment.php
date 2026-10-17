<?php
/**
 * tests/verify_view_dropdown_alignment.php
 * Automated verification for the View selection dropdown aligned with the Rows dropdown
 * in the Appointments module.
 */

$rootDir = dirname(__DIR__);
$allPassed = true;
$testCount = 0;
$passCount = 0;

function runTest($description, $assertion) {
    global $testCount, $passCount, $allPassed;
    $testCount++;
    if ($assertion) {
        $passCount++;
        echo "  [PASS] Test {$testCount}: {$description}\n";
    } else {
        $allPassed = false;
        echo "  [FAIL] Test {$testCount}: {$description}\n";
    }
}

echo "============================================================\n";
echo "Appointments View Dropdown & Toolbar Alignment Verification\n";
echo "============================================================\n\n";

echo "--- 1. Receptionist Appointments (receptionist_appointments.js) ---\n";
$recApptsPath = $rootDir . '/assets/js/modules/receptionist_appointments.js';
runTest("receptionist_appointments.js exists", file_exists($recApptsPath));
$recContent = file_get_contents($recApptsPath);

runTest("Old appointment-date-tabs banner removed", strpos($recContent, 'appointment-date-tabs') === false);
runTest("Old appt-date-tab buttons removed", strpos($recContent, 'appt-date-tab') === false);
runTest("Old date-filter-indicator removed", strpos($recContent, 'date-filter-indicator') === false);

runTest("View selection converted to #appointments-date-filter select", strpos($recContent, 'id="appointments-date-filter"') !== false);
runTest("View dropdown labeled with 'View:' span", (
    strpos($recContent, '>View:</span>') !== false &&
    preg_match('/<span[^>]*>View:<\/span>\s*<select[^>]*id="appointments-date-filter"/s', $recContent)
));
runTest("View dropdown contains upcoming, today, past, and all options", (
    strpos($recContent, 'value="upcoming"') !== false &&
    strpos($recContent, 'value="today"') !== false &&
    strpos($recContent, 'value="past"') !== false &&
    strpos($recContent, 'value="all"') !== false
));
runTest("View dropdown placed inside .toolbar-filters alongside Rows dropdown", (
    strpos($recContent, 'toolbar-filters') !== false &&
    preg_match('/id="appointments-date-filter".*?id="appointments-page-size"/s', $recContent)
));
runTest("Event listener binds change event to #appointments-date-filter", (
    strpos($recContent, "querySelector('#appointments-date-filter')") !== false &&
    strpos($recContent, "dateFilter.addEventListener('change'") !== false
));
runTest("View change updates state.dateFilter and triggers loadData", (
    strpos($recContent, "this.state.dateFilter = filter") !== false &&
    strpos($recContent, "await this.loadData()") !== false
));
echo "\n";

echo "--- 2. Doctor Appointments (doctor_appointments.js) ---\n";
$docApptsPath = $rootDir . '/assets/js/modules/doctor_appointments.js';
runTest("doctor_appointments.js exists", file_exists($docApptsPath));
$docContent = file_get_contents($docApptsPath);

runTest("Doctor appointments has #doctor-date-filter select", strpos($docContent, 'id="doctor-date-filter"') !== false);
runTest("Doctor appointments has 'View:' label alongside Rows dropdown", (
    strpos($docContent, '>View:</span>') !== false &&
    preg_match('/<span[^>]*>View:<\/span>\s*<select[^>]*id="doctor-date-filter"/s', $docContent)
));
runTest("Doctor View dropdown placed before Rows dropdown", (
    preg_match('/id="doctor-date-filter".*?id="doctor-page-size"/s', $docContent)
));
echo "\n";

echo "--- 3. Cache Query Synchronization ---\n";
$recMain = file_get_contents($rootDir . '/assets/js/receptionist_main.js');
$docMain = file_get_contents($rootDir . '/assets/js/doctor_main.js');
$recHtml = file_get_contents($rootDir . '/receptionist_dashboard.html');
$docHtml = file_get_contents($rootDir . '/doctor_dashboard.html');

runTest("receptionist_main.js imports receptionist_appointments.js?v=40", strpos($recMain, 'receptionist_appointments.js?v=40') !== false);
runTest("doctor_main.js imports doctor_appointments.js?v=34", strpos($docMain, 'doctor_appointments.js?v=34') !== false);
runTest("receptionist_dashboard.html loads receptionist_main.js?v=47", strpos($recHtml, 'receptionist_main.js?v=47') !== false);
runTest("doctor_dashboard.html loads doctor_main.js?v=48", strpos($docHtml, 'doctor_main.js?v=48') !== false);
echo "\n";

echo "============================================================\n";
echo "Verification Summary: {$passCount}/{$testCount} tests passed.\n";
if ($allPassed) {
    echo "STATUS: ALL TESTS PASSED! View selection is cleanly aligned as a dropdown.\n";
} else {
    echo "STATUS: SOME TESTS FAILED.\n";
}
echo "============================================================\n";
exit($allPassed ? 0 : 1);

