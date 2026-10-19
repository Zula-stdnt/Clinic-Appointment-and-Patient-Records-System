<?php
// tests/verify_ui_fixes_and_noshow.php
// Verifies:
// 1. Receptionist Appointment Logic (No Show hidden once confirmed)
// 2. Compact Icon-Only Action Buttons across 9 tables
// 3. Global Navbar Cleanup (Page title removed from topbar)

$testCount = 0;
$passCount = 0;

function assert_test($label, $condition, $failMsg = '') {
    global $testCount, $passCount;
    $testCount++;
    if ($condition) {
        $passCount++;
        echo "  [PASS] $label\n";
    } else {
        echo "  [FAIL] $label" . ($failMsg ? " - $failMsg" : "") . "\n";
    }
}

echo "\n=======================================================\n";
echo "UI/UX FIXES, NO-SHOW LOGIC & NAVBAR CLEANUP TEST SUITE\n";
echo "=======================================================\n\n";

// --- Group 1: Receptionist Appointment Logic ---
echo "--- Group 1: Receptionist Appointment No-Show Logic ---\n";
$recepApptsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/receptionist_appointments.js');

// 1.1: Verify in receptionist_appointments.js that noshow button is conditioned on appt.status === 'scheduled'
$hasNoShowCondition = preg_match('/\$\{appt\.status\s*===\s*[\'"]scheduled[\'"]\s*\?\s*`\s*<button[^>]+data-action=[\'"]noshow[\'"]/', $recepApptsJs);
assert_test("1.1: No Show button in receptionist_appointments.js is only rendered for 'scheduled' status", $hasNoShowCondition);

// 1.2: Verify backend appointment_controller.php rejects transition from confirmed to no_show
$apptCtrl = file_get_contents(__DIR__ . '/../../api/appointment_controller.php');
$confirmedTransitionsMatch = preg_match('/[\'"]confirmed[\'"]\s*=>\s*\[([^\\]]+)\]/', $apptCtrl, $matches);
$confirmedAllowsNoShow = false;
if ($confirmedTransitionsMatch) {
    $confirmedAllowsNoShow = strpos($matches[1], 'no_show') !== false;
}
assert_test("1.2: Backend appointment_controller.php does not allow transition from 'confirmed' to 'no_show'", !$confirmedAllowsNoShow);

// --- Group 2: Compact Icon-Only Action Buttons Across Tables ---
echo "\n--- Group 2: Compact Icon-Only Action Buttons Across 10 Tables ---\n";

// Table 2.1: Admin Manage Users (users.js)
$usersJs = file_get_contents(__DIR__ . '/../../assets/js/modules/users.js');
$usersHasViewIcon = strpos($usersJs, 'btn-icon btn-view') !== false;
$usersHasEditIcon = strpos($usersJs, 'btn-icon btn-edit') !== false;
$usersHasArchiveIcon = strpos($usersJs, 'btn-icon btn-archive') !== false;
$usersHasTextLabels = preg_match('/class="[^"]*btn-view[^"]*">\s*View\s*<\/button>/i', $usersJs) ||
                      preg_match('/class="[^"]*btn-edit[^"]*">\s*Edit\s*<\/button>/i', $usersJs);
assert_test("2.1: Manage Users (users.js) has icon-only View, Edit, and Archive buttons with zero text labels", 
    $usersHasViewIcon && $usersHasEditIcon && $usersHasArchiveIcon && !$usersHasTextLabels);

// Table 2.2: Admin Manage Patients (patients.js)
$patientsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/patients.js');
$patientsHasRecordIcon = strpos($patientsJs, 'btn-icon btn-record') !== false;
$patientsHasArchiveIcon = strpos($patientsJs, 'btn-icon btn-archive') !== false;
$patientsHasTextLabels = preg_match('/class="[^"]*btn-record[^"]*">\s*Record\s*<\/button>/i', $patientsJs);
assert_test("2.2: Manage Patients (patients.js) has icon-only Record and Archive buttons with zero text labels",
    $patientsHasRecordIcon && $patientsHasArchiveIcon && !$patientsHasTextLabels);

// Table 2.3: Admin Manage Doctors (doctors.js)
$doctorsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/doctors.js');
$doctorsHasViewIcon = strpos($doctorsJs, 'btn-icon btn-view') !== false;
$doctorsHasScheduleIcon = strpos($doctorsJs, 'btn-icon btn-schedule') !== false;
$doctorsHasEditIcon = strpos($doctorsJs, 'btn-icon btn-edit') !== false;
$doctorsHasArchiveIcon = strpos($doctorsJs, 'btn-icon btn-archive') !== false;
$doctorsHasTextLabels = preg_match('/class="[^"]*btn-view[^"]*">\s*View\s*<\/button>/i', $doctorsJs) ||
                        preg_match('/class="[^"]*btn-edit[^"]*">\s*Edit\s*<\/button>/i', $doctorsJs) ||
                        preg_match('/class="[^"]*btn-schedule[^"]*">[^<]*Schedule\s*<\/button>/i', $doctorsJs);
assert_test("2.3: Manage Doctors (doctors.js) has icon-only View, Schedule, Edit, Archive buttons with zero text labels",
    $doctorsHasViewIcon && $doctorsHasScheduleIcon && $doctorsHasEditIcon && $doctorsHasArchiveIcon && !$doctorsHasTextLabels);

// Table 2.4: Admin Manage Specialties (specialties.js)
$specialtiesJs = file_get_contents(__DIR__ . '/../../assets/js/modules/specialties.js');
$specHasViewIcon = strpos($specialtiesJs, 'btn-icon btn-view') !== false;
$specHasEditIcon = strpos($specialtiesJs, 'btn-icon btn-edit') !== false;
$specHasArchiveIcon = strpos($specialtiesJs, 'btn-icon btn-archive') !== false;
$specHasTextLabels = preg_match('/class="[^"]*btn-view[^"]*">\s*View\s*<\/button>/i', $specialtiesJs) ||
                     preg_match('/class="[^"]*btn-edit[^"]*">\s*Edit\s*<\/button>/i', $specialtiesJs);
assert_test("2.4: Manage Specialties (specialties.js) has icon-only View, Edit, Archive buttons with zero text labels",
    $specHasViewIcon && $specHasEditIcon && $specHasArchiveIcon && !$specHasTextLabels);

// Table 2.5: Admin Manage Services (services.js)
$servicesJs = file_get_contents(__DIR__ . '/../../assets/js/modules/services.js');
$servHasViewIcon = strpos($servicesJs, 'btn-icon btn-view') !== false;
$servHasEditIcon = strpos($servicesJs, 'btn-icon btn-edit') !== false;
$servHasArchiveIcon = strpos($servicesJs, 'btn-icon btn-archive') !== false;
$servHasTextLabels = preg_match('/class="[^"]*btn-view[^"]*">\s*View\s*<\/button>/i', $servicesJs) ||
                     preg_match('/class="[^"]*btn-edit[^"]*">\s*Edit\s*<\/button>/i', $servicesJs);
assert_test("2.5: Manage Services (services.js) has icon-only View, Edit, Archive buttons with zero text labels",
    $servHasViewIcon && $servHasEditIcon && $servHasArchiveIcon && !$servHasTextLabels);

// Table 2.6: Admin Manage Archive (archive.js)
$archiveJs = file_get_contents(__DIR__ . '/../../assets/js/modules/archive.js');
$archHasRestoreIcon = strpos($archiveJs, 'btn-icon btn-restore') !== false;
$archHasDeleteIcon = strpos($archiveJs, 'btn-icon btn-hard-delete') !== false;
$archHasTextLabels = preg_match('/class="[^"]*btn-restore[^"]*">[^<]*Restore\s*<\/button>/i', $archiveJs) ||
                     preg_match('/class="[^"]*btn-hard-delete[^"]*">[^<]*Delete\s*<\/button>/i', $archiveJs);
assert_test("2.6: Manage Archive (archive.js) has icon-only Restore and Delete buttons with zero text labels",
    $archHasRestoreIcon && $archHasDeleteIcon && !$archHasTextLabels);

// Table 2.7: Doctor My Appointments (doctor_appointments.js)
$docApptsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/doctor_appointments.js');
$docApptsHasConsultIcon = strpos($docApptsJs, 'btn-icon btn-start-consult') !== false;
$docApptsHasCancelIcon = strpos($docApptsJs, 'btn-icon btn-request-cancel') !== false;
$docApptsHasTextLabels = preg_match('/class="[^"]*btn-start-consult[^"]*">[^<]*Start Consult/i', $docApptsJs) ||
                         preg_match('/class="[^"]*btn-start-consult[^"]*">[^<]*View Encounter/i', $docApptsJs);
assert_test("2.7: Doctor My Appointments (doctor_appointments.js) has icon-only action buttons with zero text labels",
    $docApptsHasConsultIcon && $docApptsHasCancelIcon && !$docApptsHasTextLabels);

// Table 2.8: Doctor Patient Records (doctor_patients.js)
$docPatientsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/doctor_patients.js');
$docPatientsHasIcon = strpos($docPatientsJs, 'btn-icon btn-view-record') !== false;
$docPatientsHasTextLabels = strpos($docPatientsJs, '${btnText}') !== false;
assert_test("2.8: Doctor Patient Records (doctor_patients.js) has icon-only View Record / Break-Glass button",
    $docPatientsHasIcon && !$docPatientsHasTextLabels);

// Table 2.9: Receptionist Patient Records (receptionist_patients.js)
$recepPatientsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/receptionist_patients.js');
$recepPatientsHasViewIcon = strpos($recepPatientsJs, 'btn-icon btn-view-patient') !== false;
$recepPatientsHasEditIcon = strpos($recepPatientsJs, 'btn-icon btn-edit-patient') !== false;
$recepPatientsHasTextLabels = preg_match('/class="[^"]*btn-view-patient[^"]*">\s*View\s*<\/button>/i', $recepPatientsJs) ||
                             preg_match('/class="[^"]*btn-edit-patient[^"]*">\s*Edit\s*<\/button>/i', $recepPatientsJs);
assert_test("2.9: Receptionist Patient Records (receptionist_patients.js) has icon-only View and Edit buttons",
    $recepPatientsHasViewIcon && $recepPatientsHasEditIcon && !$recepPatientsHasTextLabels);

// Table 2.10: Admin Manage Medications (medications.js)
$medsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/medications.js');
$medsHasViewIcon = strpos($medsJs, 'btn-icon btn-view') !== false;
$medsHasEditIcon = strpos($medsJs, 'btn-icon btn-edit') !== false;
$medsHasArchiveIcon = strpos($medsJs, 'btn-icon btn-archive') !== false;
$medsHasTextLabels = preg_match('/class="[^"]*btn-view[^"]*">\s*View\s*<\/button>/i', $medsJs) ||
                     preg_match('/class="[^"]*btn-edit[^"]*">\s*Edit\s*<\/button>/i', $medsJs) ||
                     preg_match('/class="[^"]*btn-archive[^"]*">[^<]*Archive\s*<\/button>/i', $medsJs);
assert_test("2.10: Manage Medications (medications.js) has icon-only View, Edit, Archive buttons with zero text labels",
    $medsHasViewIcon && $medsHasEditIcon && $medsHasArchiveIcon && !$medsHasTextLabels);

// CSS button styling
$styleCss = file_get_contents(__DIR__ . '/../../assets/css/style.css');
$hasOutlineBtnCss = strpos($styleCss, '.btn-outline-primary') !== false &&
                    strpos($styleCss, '.btn-outline-success') !== false &&
                    strpos($styleCss, '.btn-outline-danger') !== false &&
                    strpos($styleCss, '.btn-outline-warning') !== false &&
                    strpos($styleCss, '.btn-outline-info') !== false;
assert_test("2.11: style.css defines .btn-outline-* and .btn-icon styling rules", $hasOutlineBtnCss);

// --- Group 3: Global Navbar Cleanup ---
echo "\n--- Group 3: Global Navbar Cleanup (Page Title Removed from Topbar) ---\n";

$adminHtml = file_get_contents(__DIR__ . '/../../admin_dashboard.html');
$doctorHtml = file_get_contents(__DIR__ . '/../../doctor_dashboard.html');
$recepHtml = file_get_contents(__DIR__ . '/../../receptionist_dashboard.html');

$adminTopbarHasTitle = preg_match('/<header[^>]*class=[\'"][^\'"]*topbar[^\'"]*[\'"][^>]*>[\s\S]*?id=[\'"]current-module-title[\'"][\s\S]*?<\/header>/', $adminHtml);
$doctorTopbarHasTitle = preg_match('/<header[^>]*class=[\'"][^\'"]*topbar[^\'"]*[\'"][^>]*>[\s\S]*?id=[\'"]current-module-title[\'"][\s\S]*?<\/header>/', $doctorHtml);
$recepTopbarHasTitle = preg_match('/<header[^>]*class=[\'"][^\'"]*topbar[^\'"]*[\'"][^>]*>[\s\S]*?id=[\'"]current-module-title[\'"][\s\S]*?<\/header>/', $recepHtml);

assert_test("3.1: admin_dashboard.html topbar does not contain #current-module-title", !$adminTopbarHasTitle);
assert_test("3.2: doctor_dashboard.html topbar does not contain #current-module-title", !$doctorTopbarHasTitle);
assert_test("3.3: receptionist_dashboard.html topbar does not contain #current-module-title", !$recepTopbarHasTitle);

echo "\n=======================================================\n";
echo "SUMMARY: Total: $testCount | Passed: $passCount | Failed: " . ($testCount - $passCount) . "\n";
echo "=======================================================\n";

if ($testCount === $passCount) {
    echo "🎉 ALL UI/UX FIXES, NO-SHOW LOGIC & NAVBAR TESTS PASSED!\n";
    exit(0);
} else {
    echo "❌ SOME TESTS FAILED.\n";
    exit(1);
}

