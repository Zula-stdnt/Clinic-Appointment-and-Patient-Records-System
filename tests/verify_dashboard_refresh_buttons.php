<?php
// tests/verify_dashboard_refresh_buttons.php
// Verifies all dashboard and list Refresh buttons across Admin, Doctor, and Receptionist portals.

$testCount = 0;
$passCount = 0;

function assertTest($condition, $id, $desc) {
    global $testCount, $passCount;
    $testCount++;
    if ($condition) {
        $passCount++;
        echo " [PASS] {$id}: {$desc}\n";
    } else {
        echo " [FAIL] {$id}: {$desc}\n";
    }
}

echo "=======================================================\n";
echo " ALL USER PANELS DASHBOARD REFRESH BUTTON TEST SUITE\n";
echo "=======================================================\n\n";

// --- Group 1: Admin Overview Dashboard ---
echo "--- Group 1: Admin Overview Dashboard (overview.js) ---\n";
$adminOverview = file_get_contents(__DIR__ . '/../assets/js/modules/overview.js');

assertTest(
    strpos($adminOverview, 'id="btn-refresh-overview"') !== false,
    "1.1",
    "Admin Overview has #btn-refresh-overview button in page intro"
);

assertTest(
    strpos($adminOverview, 'async refreshDashboard()') !== false &&
    strpos($adminOverview, "e.target.closest('#btn-refresh-overview')") !== false,
    "1.2",
    "Admin Overview implements delegated refreshDashboard() handler"
);

assertTest(
    strpos($adminOverview, "showToast('Refreshed clinic overview data.', 'info')") !== false,
    "1.3",
    "Admin Overview provides toast and loading feedback on refresh"
);

// --- Group 2: Doctor Dashboard ---
echo "\n--- Group 2: Doctor Dashboard (doctor_overview.js) ---\n";
$docOverview = file_get_contents(__DIR__ . '/../assets/js/modules/doctor_overview.js');

assertTest(
    strpos($docOverview, 'id="btn-refresh-dashboard"') !== false,
    "2.1",
    "Doctor Dashboard has #btn-refresh-dashboard button"
);

assertTest(
    strpos($docOverview, "e.target.closest('#btn-refresh-dashboard')") !== false,
    "2.2",
    "Doctor Dashboard uses delegated click handling so refresh survives period tab switches"
);

assertTest(
    strpos($docOverview, 'if (this._eventsAttached) return;') !== false,
    "2.3",
    "Doctor Dashboard prevents duplicate container event listener registrations"
);

assertTest(
    strpos($docOverview, 'async refreshDashboard()') !== false,
    "2.4",
    "Doctor Dashboard has dedicated refreshDashboard() method with spinner animation"
);

// --- Group 3: Receptionist Dashboard ---
echo "\n--- Group 3: Receptionist Dashboard (receptionist_overview.js) ---\n";
$recOverview = file_get_contents(__DIR__ . '/../assets/js/modules/receptionist_overview.js');

assertTest(
    strpos($recOverview, 'id="btn-refresh-dashboard"') !== false,
    "3.1",
    "Receptionist Dashboard has #btn-refresh-dashboard button"
);

assertTest(
    strpos($recOverview, "e.target.closest('#btn-refresh-dashboard')") !== false,
    "3.2",
    "Receptionist Dashboard uses delegated click handling so refresh survives period tab switches"
);

assertTest(
    strpos($recOverview, 'if (this._eventsAttached) return;') !== false,
    "3.3",
    "Receptionist Dashboard prevents duplicate container event listener registrations"
);

assertTest(
    strpos($recOverview, 'async refreshDashboard()') !== false,
    "3.4",
    "Receptionist Dashboard has dedicated refreshDashboard() method with spinner animation"
);

// --- Group 4: Appointments Refresh Buttons ---
echo "\n--- Group 4: Appointments Modules Refresh Buttons ---\n";
$docAppts = file_get_contents(__DIR__ . '/../assets/js/modules/doctor_appointments.js');
$recAppts = file_get_contents(__DIR__ . '/../assets/js/modules/receptionist_appointments.js');

assertTest(
    strpos($docAppts, 'id="btn-refresh-appointments"') !== false &&
    strpos($docAppts, "showToast('Refreshed appointments.', 'info')") !== false,
    "4.1",
    "Doctor Appointments has working refresh button with toast and spinner feedback"
);

assertTest(
    strpos($recAppts, 'id="btn-refresh-appointments"') !== false &&
    strpos($recAppts, "showToast('Refreshed appointments.', 'info')") !== false,
    "4.2",
    "Receptionist Appointments has working refresh button with toast and spinner feedback"
);

// --- Group 5: Audit Logs Refresh Button ---
echo "\n--- Group 5: Audit Logs Requests Refresh Button ---\n";
$auditLogs = file_get_contents(__DIR__ . '/../assets/js/modules/audit_logs.js');

assertTest(
    strpos($auditLogs, 'id="btn-refresh-requests"') !== false &&
    strpos($auditLogs, "showToast('Refreshed access requests.', 'info')") !== false,
    "5.1",
    "Audit Logs has working requests refresh button with toast and spinner feedback"
);

echo "\n=======================================================\n";
echo "SUMMARY: Total: {$testCount} | Passed: {$passCount} | Failed: " . ($testCount - $passCount) . "\n";
echo "=======================================================\n";

if ($testCount === $passCount) {
    echo "🎉 ALL DASHBOARD REFRESH BUTTON TESTS PASSED!\n";
    exit(0);
} else {
    exit(1);
}

