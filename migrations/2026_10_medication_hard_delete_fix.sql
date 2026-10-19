-- Migration: Safe Hard Delete for Archived Medications
-- Adds medication_name and generic_name snapshots to prescriptions and changes FK to ON DELETE SET NULL
-- so historical clinical records remain 100% intact when an archived medication is permanently purged.

-- MySQL 8.x does not support ADD COLUMN IF NOT EXISTS; guard each column instead.
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'medication_name'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE `prescriptions` ADD COLUMN `medication_name` VARCHAR(150) DEFAULT NULL AFTER `medication_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'generic_name'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE `prescriptions` ADD COLUMN `generic_name` VARCHAR(150) DEFAULT NULL AFTER `medication_name`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

