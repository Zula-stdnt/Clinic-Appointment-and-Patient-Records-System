-- Migration 016: Reset demo data to 1 Administrator + 3 Doctors
--
-- WARNING: DESTRUCTIVE. This clears all clinical/account data (patients,
-- appointments, consultations, prescriptions, labs, vitals, audit logs,
-- schedules, access requests, doctors and users) and recreates only the
-- accounts below. Master catalogs (roles, specialties, services, medications,
-- ICD-10 codes) are preserved.
--
-- Back up the database first:
--   mysqldump --host=127.0.0.1 --user=root --single-transaction --databases hospital_db > hospital_db_backup.sql
--
-- Apply:
--   mysql --host=127.0.0.1 --user=root --database=hospital_db < migrations/016_reset_admin_and_three_doctors.sql
--
-- Seeded accounts (bcrypt via PHP password_hash / password_verify):
--   Administrator : admin      / AdminPass123!
--   Doctor        : dr.smith   / DoctorPass123!   (Gregory House)
--   Doctor        : dr.watson  / DoctorPass123!   (John Watson)
--   Doctor        : dr.grey    / DoctorPass123!   (Meredith Grey)
--
-- Safe to re-run: all data tables are truncated before the fixed accounts
-- are inserted again.

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `audit_logs`;
TRUNCATE TABLE `record_access_requests`;
TRUNCATE TABLE `doctor_schedules`;
TRUNCATE TABLE `consultation_addenda`;
TRUNCATE TABLE `diagnosis`;
TRUNCATE TABLE `prescriptions`;
TRUNCATE TABLE `lab_requests`;
TRUNCATE TABLE `vital_signs`;
TRUNCATE TABLE `consultation`;
TRUNCATE TABLE `appointments`;
TRUNCATE TABLE `patient_allergies`;
TRUNCATE TABLE `patients`;
TRUNCATE TABLE `doctor_specialty`;
TRUNCATE TABLE `doctors`;
TRUNCATE TABLE `users`;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- Ensure the required roles exist (existing role IDs are reused).
INSERT INTO `roles` (`role_name`) VALUES
('Administrator'),
('Receptionist'),
('Doctor')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

SET @admin_role_id = (SELECT `role_id` FROM `roles` WHERE `role_name` = 'Administrator' LIMIT 1);
SET @doctor_role_id = (SELECT `role_id` FROM `roles` WHERE `role_name` = 'Doctor' LIMIT 1);

-- Accounts: admin / AdminPass123!
--           dr.smith, dr.watson, dr.grey / DoctorPass123!
INSERT INTO `users`
(`user_id`, `role_id`, `first_name`, `last_name`, `middle_initial`, `gender`, `username`, `password_hash`)
VALUES
(1, @admin_role_id, 'System', 'Administrator', NULL, 'Other', 'admin', '$2y$10$gB0//FTP9jXR5ueeeaGlX.rgf9KqFMkxaMfH3tnZUSbfXX1SmoNn6'),
(2, @doctor_role_id, 'Gregory', 'House', NULL, 'Male', 'dr.smith', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne'),
(3, @doctor_role_id, 'John', 'Watson', NULL, 'Male', 'dr.watson', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne'),
(4, @doctor_role_id, 'Meredith', 'Grey', NULL, 'Female', 'dr.grey', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne');

INSERT INTO `doctors` (`doctor_id`, `user_id`, `contact_no`) VALUES
(1, 2, '09171234567'),
(2, 3, '09181234568'),
(3, 4, '09191234569');

-- Recreate specialty links used by the three doctor profiles.
INSERT INTO `specialties` (`specialty_name`) VALUES
('Internal Medicine'),
('General Surgery')
ON DUPLICATE KEY UPDATE `deleted_at` = NULL;

INSERT INTO `doctor_specialty` (`doctor_id`, `specialty_id`)
SELECT 1, `specialty_id` FROM `specialties` WHERE `specialty_name` = 'Internal Medicine' LIMIT 1;

INSERT INTO `doctor_specialty` (`doctor_id`, `specialty_id`)
SELECT 2, `specialty_id` FROM `specialties` WHERE `specialty_name` = 'Internal Medicine' LIMIT 1;

INSERT INTO `doctor_specialty` (`doctor_id`, `specialty_id`)
SELECT 3, `specialty_id` FROM `specialties` WHERE `specialty_name` = 'General Surgery' LIMIT 1;
