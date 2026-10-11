-- migrations/012_clinical_safety_and_constraints.sql
-- Adds allergies notes to patients and cancellation request tracking to appointments

ALTER TABLE `patients` 
  ADD COLUMN IF NOT EXISTS `allergies_alerts` text DEFAULT NULL AFTER `address`,
  ADD COLUMN IF NOT EXISTS `allergies_confirmed_by_doctor` tinyint(1) NOT NULL DEFAULT 0 AFTER `allergies_alerts`;

ALTER TABLE `appointments`
  ADD COLUMN IF NOT EXISTS `cancel_requested` tinyint(1) NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN IF NOT EXISTS `cancel_request_reason` text DEFAULT NULL AFTER `cancel_requested`,
  ADD COLUMN IF NOT EXISTS `cancel_requested_at` datetime DEFAULT NULL AFTER `cancel_request_reason`,
  ADD COLUMN IF NOT EXISTS `cancel_requested_by` int(10) unsigned DEFAULT NULL AFTER `cancel_requested_at`,
  ADD CONSTRAINT `fk_appointments_cancel_requested_by` FOREIGN KEY (`cancel_requested_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE;

