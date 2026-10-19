<?php
require_once __DIR__ . '/../../config/db_connect.php';
// Make sure we are in test DB
if ($pdo->query("SELECT DATABASE()")->fetchColumn() !== 'hospital_db_test') {
    die("Not in test DB!");
}

// Clean up
$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
$pdo->exec("TRUNCATE TABLE diagnosis");
$pdo->exec("TRUNCATE TABLE prescriptions");
$pdo->exec("TRUNCATE TABLE lab_requests");
$pdo->exec("TRUNCATE TABLE consultation");
$pdo->exec("TRUNCATE TABLE vital_signs");
$pdo->exec("TRUNCATE TABLE appointments");
$pdo->exec("TRUNCATE TABLE record_access_requests");
$pdo->exec("TRUNCATE TABLE doctor_schedules");
$pdo->exec("TRUNCATE TABLE patient_allergies");
$pdo->exec("TRUNCATE TABLE patients");
$pdo->exec("TRUNCATE TABLE doctors");
$pdo->exec("TRUNCATE TABLE users");
$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

// Insert Admin
$adminPass = password_hash('Pass123!', PASSWORD_DEFAULT);
$pdo->exec("INSERT INTO users (user_id, username, password_hash, first_name, last_name, role_id) VALUES (3, 'admin', '$adminPass', 'Admin', 'User', 1)");

// Insert Receptionist
$recPass = password_hash('Pass123!', PASSWORD_DEFAULT);
$pdo->exec("INSERT INTO users (user_id, username, password_hash, first_name, last_name, role_id) VALUES (1, 'rec', '$recPass', 'Rec', 'Test', 2)");

// Insert Doctor
$docPass = password_hash('Pass123!', PASSWORD_DEFAULT);
$pdo->exec("INSERT INTO users (user_id, username, password_hash, first_name, last_name, role_id) VALUES (2, 'doc', '$docPass', 'Doc', 'Test', 3)");
$pdo->exec("INSERT INTO doctors (doctor_id, user_id, contact_no) VALUES (1, 2, '09123456789')");
// Seed Mon-Sat schedule for test doctor 1
for ($d = 1; $d <= 6; $d++) {
    $pdo->exec("INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active) VALUES (1, $d, '08:00:00', '17:00:00', 1)");
}

// Insert Patient
$pdo->exec("INSERT INTO patients (patient_id, first_name, last_name, gender, date_of_birth, contact_no) VALUES (1, 'John', 'Doe', 'Male', '1990-01-01', '09171234567')");

// Insert Appointments for Doctor 1 for TODAY
// 1 Scheduled today
$pdo->exec("INSERT INTO appointments (appointment_id, patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (1, 1, 1, 1, CURDATE(), '10:00:00', 'scheduled')");
// 1 Confirmed today
$pdo->exec("INSERT INTO appointments (appointment_id, patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (2, 1, 1, 1, CURDATE(), '11:00:00', 'confirmed')");
// 1 Completed today (terminal state)
$pdo->exec("INSERT INTO appointments (appointment_id, patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status) VALUES (3, 1, 1, 1, CURDATE(), '12:00:00', 'General fatigue and headache', 'completed')");
// 1 Scheduled tomorrow
$pdo->exec("INSERT INTO appointments (appointment_id, patient_id, doctor_id, created_by, appointment_date, appointment_time, status) VALUES (4, 1, 1, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00', 'scheduled')");

// Seed Vitals, Consultation, and Diagnosis for completed Appointment 3
$pdo->exec("INSERT INTO vital_signs (appointment_id, blood_pressure, temperature, oxygen_saturation) VALUES (3, '120/80', 36.6, 99)");
$pdo->exec("INSERT INTO consultation (consultation_id, appointment_id, notes, consultation_date) VALUES (1, 3, 'Routine checkup. Patient reported minor fatigue.', NOW())");
$pdo->exec("INSERT INTO diagnosis (consultation_id, icd10_code, diagnosis_name, notes) VALUES (1, 'R53.83', 'Fatigue', 'Advised adequate hydration and rest.')");

echo "Seeded.";

