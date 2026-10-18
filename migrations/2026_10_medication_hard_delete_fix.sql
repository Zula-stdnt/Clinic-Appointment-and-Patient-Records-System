-- Migration: Safe Hard Delete for Archived Medications
-- Adds medication_name and generic_name snapshots to prescriptions and changes FK to ON DELETE SET NULL
-- so historical clinical records remain 100% intact when an archived medication is permanently purged.

ALTER TABLE `prescriptions`
  ADD COLUMN IF NOT EXISTS `medication_name` VARCHAR(150) DEFAULT NULL AFTER `medication_id`,
  ADD COLUMN IF NOT EXISTS `generic_name` VARCHAR(150) DEFAULT NULL AFTER `medication_name`;

UPDATE `prescriptions` p
INNER JOIN `medications` m ON p.`medication_id` = m.`medication_id`
SET p.`medication_name` = COALESCE(p.`medication_name`, m.`name`),
    p.`generic_name` = COALESCE(p.`generic_name`, m.`generic_name`)
WHERE p.`medication_name` IS NULL;

ALTER TABLE `prescriptions`
  DROP FOREIGN KEY `fk_prescriptions_medication`;

ALTER TABLE `prescriptions`
  MODIFY COLUMN `medication_id` INT(10) UNSIGNED DEFAULT NULL;

ALTER TABLE `prescriptions`
  ADD CONSTRAINT `fk_prescriptions_medication`
  FOREIGN KEY (`medication_id`) REFERENCES `medications` (`medication_id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

