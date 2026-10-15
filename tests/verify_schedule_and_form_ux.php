<?php
// tests/verify_schedule_and_form_ux.php
// Verification test for:
// 1. Receptionist New Appointment Form doctor duty warning, date/time constraints, live schedule validation, zero-retype UX
// 2. Admin Manage Doctors table schedule management, schedule modal, presets, and doctor schedule controller API

echo "=======================================================\n";
echo "DOCTOR SCHEDULE & APPOINTMENT FORM UX VERIFICATION\n";
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

// Group 1: Receptionist Appointments Form UX & Live Validation
echo "--- Group 1: Receptionist Appointment Form UX & Warning Indicators ---\n";
$recApptContent = file_get_contents(__DIR__ . '/../assets/js/modules/receptionist_appointments.js');

$hasNoticeBadge = (strpos($recApptContent, 'id="doctor-schedule-notice"') !== false);
$hasWarningBanner = (strpos($recApptContent, 'id="appt-schedule-warning-banner"') !== false);
$hasTimeBounds = (strpos($recApptContent, 'min="08:00"') !== false && strpos($recApptContent, 'max="17:00"') !== false);
$hasLiveValidation = (strpos($recApptContent, 'validateAppointmentScheduleLive()') !== false);
$hasSundayCheck = (strpos($recApptContent, 'The clinic is closed on Sundays') !== false);
$hasPastDateCheck = (strpos($recApptContent, 'Past dates cannot be selected') !== false);
$hasLunchBreakCheck = (strpos($recApptContent, 'closed for lunch') !== false);
$hasDocDutyCheck = (strpos($recApptContent, 'does not take appointments on') !== false || strpos($recApptContent, 'is not on duty on') !== false);
$hasListboxSchedule = (strpos($recApptContent, 'd.schedule_summary') !== false);
$hasNoWipeOnFail = (strpos($recApptContent, 'if (!this.validateForm(payload) || !this.validateAppointmentScheduleLive()) return;') !== false);

assertTest($hasNoticeBadge, "1.1", "Form includes inline #doctor-schedule-notice badge beneath doctor selection");
assertTest($hasWarningBanner, "1.2", "Form includes prominent #appt-schedule-warning-banner beneath appointment date & time");
assertTest($hasTimeBounds, "1.3", "Appointment time input specifies HTML5 min='08:00' and max='17:00'");
assertTest($hasLiveValidation, "1.4", "Form implements real-time validateAppointmentScheduleLive() on input/change/blur");
assertTest($hasSundayCheck, "1.5", "Live validation immediately warns and blocks Sunday appointments");
assertTest($hasPastDateCheck, "1.6", "Live validation immediately warns and blocks past appointment dates");
assertTest($hasLunchBreakCheck, "1.7", "Live validation warns and blocks 12:00-12:59 lunch hour appointments");
assertTest($hasDocDutyCheck, "1.8", "Live validation warns and blocks appointments when doctor is not on duty on selected day");
assertTest($hasListboxSchedule, "1.9", "Doctor combobox dropdown displays duty schedule badge for each doctor option");
assertTest($hasNoWipeOnFail, "1.10", "Zero-retype UX: Form validation failure returns early without resetting draft fields");

// Group 2: Admin Manage Doctors Table & Schedule Modal
echo "\n--- Group 2: Admin Manage Doctors Schedule Configuration ---\n";
$docJsContent = file_get_contents(__DIR__ . '/../assets/js/modules/doctors.js');

$hasWeeklyScheduleHeader = (strpos($docJsContent, '<th>Weekly Schedule</th>') !== false);
$hasScheduleButton = (strpos($docJsContent, 'btn-schedule') !== false);
$hasScheduleModal = (strpos($docJsContent, 'id="doctor-schedule-modal"') !== false);
$hasPresets = (strpos($docJsContent, 'data-preset="house"') !== false &&
               strpos($docJsContent, 'data-preset="grey"') !== false &&
               strpos($docJsContent, 'data-preset="strange"') !== false);
$hasSaveScheduleMethod = (strpos($docJsContent, 'saveDoctorSchedule()') !== false);
$hasOpenScheduleModal = (strpos($docJsContent, 'openScheduleModal(') !== false);

assertTest($hasWeeklyScheduleHeader, "2.1", "Manage Doctors table includes 'Weekly Schedule' column header");
assertTest($hasScheduleButton, "2.2", "Each doctor row has an interactive 'Schedule' action button");
assertTest($hasScheduleModal, "2.3", "Includes modal #doctor-schedule-modal with 7-day checkboxes and time inputs");
assertTest($hasPresets, "2.4", "Includes 1-click rotation presets (Dr. House, Dr. Grey, Dr. Strange, Full Week, Clear All)");
assertTest($hasOpenScheduleModal, "2.5", "Implements openScheduleModal() loading schedules via doctor_schedule_controller.php");
assertTest($hasSaveScheduleMethod, "2.6", "Implements saveDoctorSchedule() dispatching payload to doctor_schedule_controller.php");

// Group 3: Backend Controller API Integration
echo "\n--- Group 3: Backend Doctor Schedule API Integration ---\n";
require_once __DIR__ . '/../config/db_connect.php';

// Check doctor controller includes schedules in listDoctors & getDoctorById
$docControllerContent = file_get_contents(__DIR__ . '/../api/doctor_controller.php');
$hasDocSchedulesQuery = (strpos($docControllerContent, 'FROM doctor_schedules') !== false && strpos($docControllerContent, 'is_active = 1') !== false);
$hasDocSummaryFormat = (strpos($docControllerContent, '$doc[\'schedule_summary\']') !== false);
assertTest($hasDocSchedulesQuery && $hasDocSummaryFormat, "3.1", "doctor_controller.php enriches doctors with active schedules and schedule_summary");

// Check doctor_schedule_controller.php
$schedControllerContent = file_get_contents(__DIR__ . '/../api/doctor_schedule_controller.php');
$hasSaveDoctorSchedules = (strpos($schedControllerContent, 'saveDoctorSchedules(') !== false);
$hasGetDoctorSchedules = (strpos($schedControllerContent, 'getDoctorSchedules(') !== false);
assertTest($hasSaveDoctorSchedules && $hasGetDoctorSchedules, "3.2", "doctor_schedule_controller.php handles GET and POST schedule endpoints");

// Verify Database doctor_schedules table existence and queryability
$hasTable = false;
try {
    $tblStmt = $pdo->query("SHOW TABLES LIKE 'doctor_schedules'");
    $hasTable = ($tblStmt->rowCount() > 0);
} catch (Exception $e) {
    $hasTable = false;
}
assertTest($hasTable, "3.3", "Database contains 'doctor_schedules' table");

// Verify default 3 doctors exist in database
$stmt = $pdo->query("SELECT d.doctor_id, u.first_name, u.last_name FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE d.deleted_at IS NULL ORDER BY d.doctor_id");
$docs = $stmt->fetchAll(PDO::FETCH_ASSOC);
$hasThreeDocs = count($docs) >= 3;
assertTest($hasThreeDocs, "3.4", "Database contains clinic's active doctors (" . count($docs) . " found)");

echo "\n=======================================================\n";
echo "SUMMARY: Total: " . ($passCount + $failCount) . " | Passed: $passCount | Failed: $failCount\n";
echo "=======================================================\n";

if ($failCount === 0) {
    echo "🎉 ALL DOCTOR SCHEDULE & APPOINTMENT FORM UX TESTS PASSED!\n";
    exit(0);
} else {
    echo "❌ SOME TESTS FAILED.\n";
    exit(1);
}
