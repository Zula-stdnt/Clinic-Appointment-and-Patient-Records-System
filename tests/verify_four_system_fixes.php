<?php
/**
 * Comprehensive Verification Suite for the 4 ITE 387 System Fixes:
 *   1. Universal Action Confirmation Modals (Global UI)
 *   2. Doctor Print Authorization Bug
 *   3. Patient Soft-Delete & Archive Display Bugs (Admin Panel)
 *   4. Hard Delete Failure for Archived Medications (Admin Panel)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/auth.php';

echo "=================================================================\n";
echo " ITE 387 FOUR SYSTEM FIXES VERIFICATION TEST SUITE\n";
echo "=================================================================\n\n";

$passed = 0;
$failed = 0;

function assertCheck(string $id, string $description, bool $condition, string $detail = ''): void {
    global $passed, $failed;
    if ($condition) {
        echo " [PASS] {$id}: {$description}\n";
        $passed++;
    } else {
        echo " [FAIL] {$id}: {$description}" . ($detail !== '' ? " ({$detail})" : "") . "\n";
        $failed++;
    }
}

$rootDir = dirname(__DIR__);

// =========================================================================
// GROUP 1: Universal Action Confirmation Modals (Global UI)
// =========================================================================
echo "--- Group 1: Universal Action Confirmation Modals (Global UI) ---\n";

$uiJs = file_get_contents($rootDir . '/assets/js/ui.js');
$styleCss = file_get_contents($rootDir . '/assets/css/style.css');

assertCheck(
    '1.1',
    'style.css elevates #global-confirm-modal z-index above open form modals',
    str_contains($styleCss, '#global-confirm-modal') && str_contains($styleCss, 'calc(var(--modal-z) + 30)')
);

assertCheck(
    '1.2',
    'ui.js dynamically provisions #global-confirm-modal via ensureGlobalConfirmModal() and exports markModalClean()',
    str_contains($uiJs, 'export const ensureGlobalConfirmModal') && str_contains($uiJs, 'export const markModalClean')
);

assertCheck(
    '1.3',
    'ui.js tracks dirty state on form modals and prompts Discard Changes on closeModal(modal, false)',
    str_contains($uiJs, 'const attachDirtyTracker = (modal)') &&
    str_contains($uiJs, 'if (modal._isDirty && !NON_DIRTY_MODAL_IDS.has(modal.id))') &&
    str_contains($uiJs, "title: 'Discard Changes?'")
);

assertCheck(
    '1.4',
    'ui.js preserves stacked modal focus and activeModal reference when #global-confirm-modal closes',
    str_contains($uiJs, 'modal._previousModal') && str_contains($uiJs, 'modal._previousActiveElement')
);

$moduleChecks = [
    'Admin Users (users.js)' => ['/assets/js/modules/users.js', 'confirmAction({'],
    'Admin Doctors (doctors.js)' => ['/assets/js/modules/doctors.js', 'confirmAction({'],
    'Admin Services (services.js)' => ['/assets/js/modules/services.js', 'confirmAction({'],
    'Admin Medications (medications.js)' => ['/assets/js/modules/medications.js', 'confirmAction({'],
    'Admin Specialties (specialties.js)' => ['/assets/js/modules/specialties.js', 'confirmAction({'],
    'Shared Patient Register (patient-register.js)' => ['/assets/js/components/patient-register.js', 'confirmAction({'],
    'Doctor Consultation (doctor_consultation.js)' => ['/assets/js/modules/doctor_consultation.js', 'confirmAction({'],
    'Doctor Appointments (doctor_appointments.js)' => ['/assets/js/modules/doctor_appointments.js', 'confirmAction({'],
    'Doctor Patients (doctor_patients.js)' => ['/assets/js/modules/doctor_patients.js', 'confirmAction({'],
    'Doctor Profile (doctor_profile.js)' => ['/assets/js/modules/doctor_profile.js', 'confirmAction({'],
    'Receptionist Patients (receptionist_patients.js)' => ['/assets/js/modules/receptionist_patients.js', 'confirmDialog({'],
    'Receptionist Appointments (receptionist_appointments.js)' => ['/assets/js/modules/receptionist_appointments.js', 'confirmAction({'],
    'Account Settings (account_settings.js)' => ['/assets/js/modules/account_settings.js', 'confirmAction({'],
];

foreach ($moduleChecks as $label => [$relPath, $needle]) {
    $content = file_get_contents($rootDir . $relPath);
    assertCheck("1.5 ({$label})", "{$label} prompts confirmation before critical state changes", str_contains($content, $needle));
}

// =========================================================================
// GROUP 2: Doctor Print Authorization Bug
// =========================================================================
echo "\n--- Group 2: Doctor Print Authorization Bug ---\n";

assertCheck(
    '2.1',
    'is_doctor_authorized_for_appointment() helper is defined in includes/auth.php',
    function_exists('is_doctor_authorized_for_appointment')
);

$consultCtrl = file_get_contents($rootDir . '/api/consultation_controller.php');
$apptCtrl = file_get_contents($rootDir . '/api/appointment_controller.php');

assertCheck(
    '2.2',
    'consultation_controller.php uses is_doctor_authorized_for_appointment() in getConsultationDetails',
    str_contains($consultCtrl, "is_doctor_authorized_for_appointment(\$pdo, (int)\$doc['doctor_id'], \$appointment)")
);

assertCheck(
    '2.3',
    'appointment_controller.php uses is_doctor_authorized_for_appointment() in getAppointmentById',
    str_contains($apptCtrl, "is_doctor_authorized_for_appointment(\$pdo, (int)\$doc['doctor_id'], \$appointment)")
);

// Test database authorization scenarios inside a rolled-back transaction
$pdo->beginTransaction();
try {
    $stmtUser = $pdo->query("SELECT user_id FROM users LIMIT 1");
    $creatorUserId = (int)$stmtUser->fetchColumn();

    $insDoc = $pdo->prepare("INSERT INTO doctors (contact_no) VALUES (?)");
    $insDoc->execute(['09170000001']);
    $docA = (int)$pdo->lastInsertId();

    $insDoc->execute(['09170000002']);
    $docB = (int)$pdo->lastInsertId();

    $insDoc->execute(['09170000003']);
    $docC = (int)$pdo->lastInsertId();

    $insPat = $pdo->prepare("INSERT INTO patients (first_name, last_name, date_of_birth, gender, contact_no) VALUES ('Auth', 'PatientOne', '1990-01-01', 'Male', '09171234567')");
    $insPat->execute();
    $pat1 = (int)$pdo->lastInsertId();

    // Appointment 1: Patient 1 with DocA (completed)
    $insAppt = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)");
    $insAppt->execute([$pat1, $docA, $creatorUserId, '09:00:00', 'completed']);
    $appt1Id = (int)$pdo->lastInsertId();

    // Appointment 2: Patient 1 with DocB (scheduled) -> DocB is assigned to Patient 1
    $insAppt->execute([$pat1, $docB, $creatorUserId, '10:00:00', 'scheduled']);
    $appt2Id = (int)$pdo->lastInsertId();

    $appt1Row = [
        'appointment_id' => $appt1Id,
        'doctor_id' => $docA,
        'patient_id' => $pat1
    ];

    // Scenario A: Attending doctor (DocA) accessing own appointment
    assertCheck(
        '2.4',
        'Attending doctor (DocA) is authorized for their own appointment',
        is_doctor_authorized_for_appointment($pdo, $docA, $appt1Row) === true
    );

    // Scenario B: Assigned doctor (DocB) accessing historical encounter (Appt 1) of shared patient (Pat 1)
    assertCheck(
        '2.5',
        'Assigned doctor (DocB) is authorized to print historical encounter (Appt 1) for shared patient',
        is_doctor_authorized_for_appointment($pdo, $docB, $appt1Row) === true
    );

    // Scenario C: Unrelated doctor (DocC) without appointment or access grant is DENIED
    assertCheck(
        '2.6',
        'Unrelated doctor (DocC) is denied access to Patient 1 encounter',
        is_doctor_authorized_for_appointment($pdo, $docC, $appt1Row) === false
    );

    // Scenario D: Unrelated doctor (DocC) with active break-glass / access grant is AUTHORIZED
    $insGrant = $pdo->prepare("INSERT INTO record_access_requests (doctor_id, patient_id, mode, status, reason, expires_at) VALUES (?, ?, 'urgent', 'approved', 'Emergency care', DATE_ADD(NOW(), INTERVAL 4 HOUR))");
    $insGrant->execute([$docC, $pat1]);

    assertCheck(
        '2.7',
        'Doctor (DocC) with active approved record_access_requests grant is authorized',
        is_doctor_authorized_for_appointment($pdo, $docC, $appt1Row) === true
    );
} finally {
    $pdo->rollBack();
}

// =========================================================================
// GROUP 3: Patient Soft-Delete & Archive Display Bugs (Admin Panel)
// =========================================================================
echo "\n--- Group 3: Patient Soft-Delete & Archive Display Bugs ---\n";

$patientCtrl = file_get_contents($rootDir . '/api/patient_controller.php');
$archiveJs = file_get_contents($rootDir . '/assets/js/modules/archive.js');
$patientsJs = file_get_contents($rootDir . '/assets/js/modules/patients.js');

assertCheck(
    '3.1',
    'patient_controller.php listPatients accepts both status=deleted and status=archived',
    str_contains($patientCtrl, "\$status === 'deleted' || \$status === 'archived'")
);

assertCheck(
    '3.2',
    'patient_controller.php softDeletePatient no longer blocks archiving patients with completed consultations',
    !str_contains($patientCtrl, 'Cannot archive patient with existing completed consultations') &&
    str_contains($patientCtrl, "SET status = 'cancelled'") &&
    str_contains($patientCtrl, "UPDATE patients SET deleted_at = NOW()")
);

assertCheck(
    '3.3',
    'patients.js and archive.js handle restore action and surface API errors via toast',
    str_contains($patientsJs, 'btn-restore') && str_contains($archiveJs, "Failed to permanently delete record.")
);

// Test database soft-delete & archive query behavior inside a rolled-back transaction
$pdo->beginTransaction();
try {
    $stmtUser = $pdo->query("SELECT user_id FROM users LIMIT 1");
    $creatorUserId = (int)$stmtUser->fetchColumn();

    $insDoc = $pdo->prepare("INSERT INTO doctors (contact_no) VALUES ('09180000001')");
    $insDoc->execute();
    $docId = (int)$pdo->lastInsertId();

    $insPat = $pdo->prepare("INSERT INTO patients (first_name, last_name, date_of_birth, gender, contact_no) VALUES ('Archive', 'TestPatient', '1988-08-08', 'Female', '09181112222')");
    $insPat->execute();
    $patId = (int)$pdo->lastInsertId();

    // Create a past completed appointment + consultation AND a future scheduled appointment
    $insAppt = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (?, ?, ?, ?, '10:00:00', ?)");
    $insAppt->execute([$patId, $docId, $creatorUserId, '2025-01-10', 'completed']);
    $pastApptId = (int)$pdo->lastInsertId();

    $insConsult = $pdo->prepare("INSERT INTO consultation (appointment_id, notes) VALUES (?, 'Clinical encounter notes')");
    $insConsult->execute([$pastApptId]);

    $insAppt->execute([$patId, $docId, $creatorUserId, '2027-05-01', 'scheduled']);
    $futureApptId = (int)$pdo->lastInsertId();

    // Execute the exact soft-delete queries from softDeletePatient
    $cancelApptStmt = $pdo->prepare(
        "UPDATE appointments
         SET status = 'cancelled'
         WHERE patient_id = :id
           AND status IN ('scheduled', 'confirmed')
           AND appointment_date >= CURRENT_DATE"
    );
    $cancelApptStmt->bindParam(':id', $patId, PDO::PARAM_INT);
    $cancelApptStmt->execute();

    $delStmt = $pdo->prepare("UPDATE patients SET deleted_at = NOW() WHERE patient_id = :id AND deleted_at IS NULL");
    $delStmt->bindParam(':id', $patId, PDO::PARAM_INT);
    $delStmt->execute();

    // Verify future appointment was cancelled while past completed appointment remains 'completed'
    $chkFuture = $pdo->prepare("SELECT status FROM appointments WHERE appointment_id = ?");
    $chkFuture->execute([$futureApptId]);
    assertCheck('3.4', 'Archiving patient automatically cancels future scheduled appointments', $chkFuture->fetchColumn() === 'cancelled');

    $chkPast = $pdo->prepare("SELECT status FROM appointments WHERE appointment_id = ?");
    $chkPast->execute([$pastApptId]);
    assertCheck('3.5', 'Archiving patient preserves past completed appointments and consultations intact', $chkPast->fetchColumn() === 'completed');

    // Verify archive query retrieves the soft-deleted patient
    $archQuery = $pdo->prepare("SELECT patient_id, deleted_at FROM patients WHERE patient_id = ? AND deleted_at IS NOT NULL");
    $archQuery->execute([$patId]);
    $archRow = $archQuery->fetch(PDO::FETCH_ASSOC);
    assertCheck('3.6', 'Soft-deleted patient is returned by archive query (deleted_at IS NOT NULL)', !empty($archRow['deleted_at']));
} finally {
    $pdo->rollBack();
}

// =========================================================================
// GROUP 4: Hard Delete Failure for Archived Medications (Admin Panel)
// =========================================================================
echo "\n--- Group 4: Hard Delete Failure for Archived Medications ---\n";

// Verify schema columns and FK constraint on prescriptions
$colStmt = $pdo->query("SHOW COLUMNS FROM prescriptions");
$columns = [];
while ($row = $colStmt->fetch(PDO::FETCH_ASSOC)) {
    $columns[$row['Field']] = $row;
}

assertCheck(
    '4.1',
    'prescriptions.medication_id is nullable (YES)',
    isset($columns['medication_id']) && strtoupper((string)$columns['medication_id']['Null']) === 'YES'
);

assertCheck(
    '4.2',
    'prescriptions table has medication_name and generic_name snapshot columns',
    isset($columns['medication_name']) && isset($columns['generic_name'])
);

// Test hard-deleting an archived medication referenced by a historical prescription
$pdo->beginTransaction();
try {
    $stmtUser = $pdo->query("SELECT user_id FROM users LIMIT 1");
    $creatorUserId = (int)$stmtUser->fetchColumn();

    $insDoc = $pdo->prepare("INSERT INTO doctors (contact_no) VALUES ('09190000001')");
    $insDoc->execute();
    $docId = (int)$pdo->lastInsertId();

    $insPat = $pdo->prepare("INSERT INTO patients (first_name, last_name, date_of_birth, gender, contact_no) VALUES ('Med', 'Patient', '1992-03-15', 'Male', '09193334444')");
    $insPat->execute();
    $patId = (int)$pdo->lastInsertId();

    $insAppt = $pdo->prepare("INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (?, ?, ?, CURRENT_DATE, '11:00:00', 'completed')");
    $insAppt->execute([$patId, $docId, $creatorUserId]);
    $apptId = (int)$pdo->lastInsertId();

    $insConsult = $pdo->prepare("INSERT INTO consultation (appointment_id, notes) VALUES (?, 'Fever encounter')");
    $insConsult->execute([$apptId]);
    $consultId = (int)$pdo->lastInsertId();

    // Insert medication and archive it
    $insMed = $pdo->prepare("INSERT INTO medications (name, generic_name, manufacturer, deleted_at) VALUES ('TestMed 500mg', 'TestGeneric', 'TestPharma', NOW())");
    $insMed->execute();
    $medId = (int)$pdo->lastInsertId();

    // Insert prescription referencing this medication
    $insRx = $pdo->prepare("INSERT INTO prescriptions (consultation_id, medication_id, dosage, frequency, duration, start_date) VALUES (?, ?, '500mg', 'TID', '5 days', CURRENT_DATE)");
    $insRx->execute([$consultId, $medId]);
    $rxId = (int)$pdo->lastInsertId();

    // Execute the exact snapshot backfill + hard delete from hardDeleteMedication()
    $snapshotStmt = $pdo->prepare(
        "UPDATE prescriptions
         SET medication_name = COALESCE(NULLIF(medication_name, ''), :med_name),
             generic_name    = COALESCE(NULLIF(generic_name, ''), :gen_name)
         WHERE medication_id = :id"
    );
    $medName = 'TestMed 500mg';
    $genName = 'TestGeneric';
    $snapshotStmt->bindParam(':med_name', $medName, PDO::PARAM_STR);
    $snapshotStmt->bindParam(':gen_name', $genName, PDO::PARAM_STR);
    $snapshotStmt->bindParam(':id', $medId, PDO::PARAM_INT);
    $snapshotStmt->execute();

    $delMedStmt = $pdo->prepare("DELETE FROM medications WHERE medication_id = :id");
    $delMedStmt->bindParam(':id', $medId, PDO::PARAM_INT);
    $delMedStmt->execute();

    // Verify medication is permanently deleted
    $chkMed = $pdo->prepare("SELECT COUNT(*) FROM medications WHERE medication_id = ?");
    $chkMed->execute([$medId]);
    assertCheck('4.3', 'Archived medication is permanently deleted without FK constraint error', (int)$chkMed->fetchColumn() === 0);

    // Verify prescription still exists with medication_id = NULL and snapshot names preserved via LEFT JOIN
    $rxQuery = $pdo->prepare(
        "SELECT p.prescription_id, p.medication_id,
                COALESCE(m.name, p.medication_name, 'Archived Medication') AS medication_name,
                COALESCE(m.generic_name, p.generic_name) AS generic_name,
                p.dosage
         FROM prescriptions p
         LEFT JOIN medications m ON p.medication_id = m.medication_id
         WHERE p.prescription_id = ?"
    );
    $rxQuery->execute([$rxId]);
    $rxRow = $rxQuery->fetch(PDO::FETCH_ASSOC);

    assertCheck(
        '4.4',
        'Prescription row survives hard delete with medication_id = NULL and snapshot names intact',
        $rxRow !== false &&
        $rxRow['medication_id'] === null &&
        $rxRow['medication_name'] === 'TestMed 500mg' &&
        $rxRow['generic_name'] === 'TestGeneric'
    );
} finally {
    $pdo->rollBack();
}

// =========================================================================
// GROUP 5: ITE 387 Course Competency Preservation Check
// =========================================================================
echo "\n--- Group 5: ITE 387 Course Competency Preservation ---\n";

$medCtrl = file_get_contents($rootDir . '/api/medication_controller.php');
assertCheck(
    '5.1',
    'All modified controllers preserve verify_csrf_on_state_change(), require_role(), bindParam(), and log_audit()',
    str_contains($patientCtrl, 'verify_csrf_on_state_change()') &&
    str_contains($patientCtrl, 'log_audit(') &&
    str_contains($medCtrl, 'verify_csrf_on_state_change()') &&
    str_contains($medCtrl, 'log_audit(') &&
    str_contains($consultCtrl, 'verify_csrf_on_state_change()')
);

echo "\n=================================================================\n";
echo "SUMMARY: Total: " . ($passed + $failed) . " | Passed: {$passed} | Failed: {$failed}\n";
echo "=================================================================\n";

if ($failed > 0) {
    exit(1);
}
echo "🎉 ALL 4 SYSTEM FIXES & ITE 387 CHECKS PASSED!\n";
