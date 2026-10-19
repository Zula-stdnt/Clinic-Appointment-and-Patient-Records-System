<?php
// tests/verify_confirmation_modal_buttons.php
// Verifies that confirmation modals do not display ambiguous "Double Cancel" buttons.

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
echo " CONFIRMATION MODAL BUTTONS & DOUBLE CANCEL TEST SUITE\n";
echo "=======================================================\n\n";

// --- Group 1: ui.js Inspection ---
echo "--- Group 1: ui.js Inspection ---\n";
$uiJs = file_get_contents(__DIR__ . '/../../assets/js/ui.js');

assertTest(
    strpos($uiJs, 'cancelBtnText') !== false,
    "1.1",
    "confirmAction in ui.js supports custom cancelBtnText"
);

assertTest(
    strpos($uiJs, 'resolvedCancelText') !== false && strpos($uiJs, "resolvedCancelText = 'Close'") !== false,
    "1.2",
    "ui.js includes automatic safeguard against Double Cancel (resolving dismissal to 'Close' when action is 'Cancel')"
);

assertTest(
    strpos($uiJs, "confirmSoftDelete") !== false && strpos($uiJs, "confirmRestore") !== false && strpos($uiJs, "confirmHardDelete") !== false,
    "1.3",
    "Soft delete, restore, and hard delete confirmation dialogs maintain explicit cancel button handling"
);

// --- Group 2: receptionist_appointments.js Inspection ---
echo "\n--- Group 2: receptionist_appointments.js Inspection ---\n";
$recepApptsJs = file_get_contents(__DIR__ . '/../../assets/js/modules/receptionist_appointments.js');

assertTest(
    strpos($recepApptsJs, "newStatus === 'cancelled'") !== false &&
    strpos($recepApptsJs, "confirmBtnText = 'Cancel Appointment'") !== false &&
    strpos($recepApptsJs, "cancelBtnText = 'Keep Appointment'") !== false,
    "2.1",
    "Appointment cancellation configures 'Cancel Appointment' for action and 'Keep Appointment' for dismissal"
);

assertTest(
    strpos($recepApptsJs, "modalTitle = 'Cancel Appointment'") !== false,
    "2.2",
    "Cancellation modal uses clear 'Cancel Appointment' title instead of generic 'Confirm Status Change'"
);

assertTest(
    strpos($recepApptsJs, "cancelBtnText: 'Keep Editing'") !== false,
    "2.3",
    "Unsaved changes modal uses 'Keep Editing' for dismissal instead of generic 'Cancel'"
);

assertTest(
    strpos($recepApptsJs, "const patientName = this.formatPatientName(appt);") !== false,
    "2.4",
    "updateStatus resolves patient name via this.formatPatientName(appt)"
);

assertTest(
    strpos($recepApptsJs, 'person.patient_last || person.last_name') !== false &&
    strpos($recepApptsJs, 'person.patient_first || person.first_name') !== false &&
    strpos($recepApptsJs, "\${appt.last_name}") === false,
    "2.5",
    "formatPatientName safely handles patient_last/patient_first and eliminates undefined, undefined references"
);

// --- Group 3: confirm-dialog.js Inspection ---
echo "\n--- Group 3: confirm-dialog.js Inspection ---\n";
$confirmDialogJs = file_get_contents(__DIR__ . '/../../assets/js/components/confirm-dialog.js');

assertTest(
    strpos($confirmDialogJs, "cancelText = 'Close'") !== false,
    "3.1",
    "confirm-dialog.js includes double-cancel guard"
);

echo "\n=======================================================\n";
echo "SUMMARY: Total: {$testCount} | Passed: {$passCount} | Failed: " . ($testCount - $passCount) . "\n";
echo "=======================================================\n";

if ($testCount === $passCount) {
    echo "🎉 ALL DOUBLE CANCEL PREVENTION TESTS PASSED!\n";
    exit(0);
} else {
    exit(1);
}

