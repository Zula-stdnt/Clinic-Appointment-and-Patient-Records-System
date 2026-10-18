-- Migration: 2026_10_unrestricted_hard_delete_cascade.sql
-- Enables unrestricted hard deletion for academic demonstration project
-- Configures CASCADE / SET NULL rules across foreign keys referencing patients, doctors, and user creators
-- Ensures administrators can permanently purge archived records without being blocked by FK constraints.

-- 1. Appointments referencing patients, doctors, and creator users
ALTER TABLE `appointments` DROP FOREIGN KEY `fk_appointments_patient`;
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appointments_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `appointments` DROP FOREIGN KEY `fk_appointments_doctor`;
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appointments_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `appointments` MODIFY COLUMN `created_by` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `appointments` DROP FOREIGN KEY `fk_appointments_creator`;
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appointments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Consultation addenda referencing doctors
ALTER TABLE `consultation_addenda` DROP FOREIGN KEY `fk_addenda_doctor`;
ALTER TABLE `consultation_addenda` ADD CONSTRAINT `fk_addenda_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

