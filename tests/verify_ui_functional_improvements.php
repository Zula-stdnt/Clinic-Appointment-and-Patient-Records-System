<?php
// tests/verify_ui_functional_improvements.php
// Verification Suite for System UI & Functional Improvement To-Do List

echo "=======================================================\n";
echo "SYSTEM UI & FUNCTIONAL IMPROVEMENT VERIFICATION SUITE\n";
echo "=======================================================\n\n";

$passCount = 0;
$failCount = 0;

function assertTest($condition, $testId, $description) {
    global $passCount, $failCount;
    if ($condition) {
        echo " [PASS] $testId: $description\n";
        $passCount++;
    } else {
        echo " [FAIL] $testId: $description\n";
        $failCount++;
    }
}

// Group 1: Bug Fix Verification (patient-record-view.js)
echo "--- Group 1: Patient Record View Bug Fix ---\n";
$prvContent = file_get_contents(__DIR__ . '/../assets/js/components/patient-record-view.js');
$hasRecordDecl = (strpos($prvContent, 'const record = data || {};') !== false);
$hasNoUndeclaredRecord = preg_match('/function renderReceptionistDemographicsView\s*\([^)]*\)\s*\{[^}]*const record = data \|\| \{\};/s', $prvContent);
assertTest($hasRecordDecl && $hasNoUndeclaredRecord, "1.1", "renderReceptionistDemographicsView safely declares 'const record = data || {};'");

// Group 2: Backend Date Range Filtering & Vitals Data (api/appointment_controller.php)
echo "\n--- Group 2: Appointment Controller API Date Range & Vitals ---\n";
$acContent = file_get_contents(__DIR__ . '/../api/appointment_controller.php');
$hasStartDate = (strpos($acContent, '$_GET[\'start_date\']') !== false);
$hasEndDate = (strpos($acContent, '$_GET[\'end_date\']') !== false);
$hasBetween = (strpos($acContent, 'a.appointment_date BETWEEN :start_date AND :end_date') !== false);
$hasVitalsSelect = (strpos($acContent, 'v.blood_pressure, v.temperature, v.oxygen_saturation') !== false);
assertTest($hasStartDate && $hasEndDate && $hasBetween, "2.1", "appointment_controller.php supports start_date and end_date BETWEEN filtering");
assertTest($hasVitalsSelect, "2.2", "appointment_controller.php queries blood_pressure, temperature, and oxygen_saturation");

// Group 3: Receptionist Overview UI Enhancements
echo "\n--- Group 3: Receptionist Overview Enhancements ---\n";
$recContent = file_get_contents(__DIR__ . '/../assets/js/modules/receptionist_overview.js');
$hasRecAllTime = (strpos($recContent, 'data-period="all"') !== false);
$hasRecDateRange = (strpos($recContent, 'id="rec-range-start"') !== false && strpos($recContent, 'id="rec-range-end"') !== false);
$hasRecApplyBtn = (strpos($recContent, 'id="btn-rec-apply-range"') !== false);
$hasRecPagination = (strpos($recContent, 'id="rec-page-size"') !== false && strpos($recContent, 'id="btn-rec-prev"') !== false && strpos($recContent, 'id="btn-rec-next"') !== false);
$hasRecCcEllipsis = (strpos($recContent, 'text-overflow: ellipsis') !== false || strpos($recContent, 'overflow: hidden') !== false);
$hasRecCcCol = (strpos($recContent, 'Chief Complaint</th>') !== false);
$hasRecVitalsCol = (strpos($recContent, 'Triage Vitals</th>') !== false && strpos($recContent, 'vital-badge') !== false);
assertTest($hasRecAllTime, "3.1", "receptionist_overview.js has All-Time period filter restored");
assertTest($hasRecDateRange && $hasRecApplyBtn, "3.2", "receptionist_overview.js has custom Date Range Picker with start/end inputs and Filter button");
assertTest($hasRecPagination, "3.3", "receptionist_overview.js has Rows per Page selector (10, 25, 50) and pagination controls");
assertTest($hasRecCcEllipsis, "3.4", "receptionist_overview.js constrains Chief Complaint with max-width and ellipsis truncation");
assertTest($hasRecCcCol, "3.5", "receptionist_overview.js has dedicated Chief Complaint column");
assertTest($hasRecVitalsCol, "3.6", "receptionist_overview.js has standardized Triage Vitals column with stacked vital badges");

// Group 4: Doctor Module UI Enhancements
echo "\n--- Group 4: Doctor Module Enhancements ---\n";
$docOvContent = file_get_contents(__DIR__ . '/../assets/js/modules/doctor_overview.js');
$hasDocOvAllTime = (strpos($docOvContent, 'data-period="all"') !== false);
$hasDocOvDateRange = (strpos($docOvContent, 'id="doc-range-start"') !== false && strpos($docOvContent, 'id="doc-range-end"') !== false);
$hasDocOvVitalsCol = (strpos($docOvContent, 'Triage Vitals</th>') !== false);
$hasDocOvPagination = (strpos($docOvContent, 'doc-overview-page-size') !== false && strpos($docOvContent, 'btn-doc-prev') !== false && strpos($docOvContent, 'btn-doc-next') !== false);
assertTest($hasDocOvAllTime, "4.1", "doctor_overview.js has All-Time period filter restored");
assertTest($hasDocOvDateRange, "4.2", "doctor_overview.js has custom Date Range Picker");
assertTest($hasDocOvVitalsCol, "4.3", "doctor_overview.js has Triage Vitals column restored in queue table");
assertTest($hasDocOvPagination, "4.4", "doctor_overview.js has Rows per Page selector and pagination controls");

$docApptContent = file_get_contents(__DIR__ . '/../assets/js/modules/doctor_appointments.js');
$hasDocApptVitalsCol = (strpos($docApptContent, '<th>Triage Vitals</th>') !== false);
$hasDocApptCompactIcon = (strpos($docApptContent, 'btn-icon btn-request-cancel') !== false || (strpos($docApptContent, 'btn-request-cancel') !== false && strpos($docApptContent, 'width: 30px') !== false));
assertTest($hasDocApptVitalsCol, "4.5", "doctor_appointments.js has Triage Vitals column in thead and tbody");
assertTest($hasDocApptCompactIcon, "4.6", "doctor_appointments.js replaces text 'Request Cancel' with compact ✕ icon button");

// Group 5: CSS Design System Tokens
echo "\n--- Group 5: CSS Design Tokens & Table Cell Scaling ---\n";
$cssContent = file_get_contents(__DIR__ . '/../assets/css/style.css');
$hasVitalBadgeClass = (strpos($cssContent, '.vital-badge') !== false);
$hasDashboardColumnsTable = (strpos($cssContent, '.dashboard-columns .data-table') !== false);
assertTest($hasVitalBadgeClass, "5.1", "style.css defines .vital-badge styling for compact vitals chips");
assertTest($hasDashboardColumnsTable, "5.2", "style.css defines compact cell padding for tables inside .dashboard-columns at 100% zoom");

echo "\n=======================================================\n";
echo "SUMMARY: Total: " . ($passCount + $failCount) . " | Passed: $passCount | Failed: $failCount\n";
echo "=======================================================\n";
if ($failCount === 0) {
    echo "🎉 ALL SYSTEM UI & FUNCTIONAL IMPROVEMENT TESTS PASSED!\n";
    exit(0);
} else {
    echo "❌ SOME TESTS FAILED.\n";
    exit(1);
}
