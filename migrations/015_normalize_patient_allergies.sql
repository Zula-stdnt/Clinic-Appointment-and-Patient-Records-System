-- migrations/015_normalize_patient_allergies.sql
-- ITE 387 Lesson applied: 04 Database Design/database_normalization (1NF atomic patient_allergies table & 3NF diagnosis -> icd10_codes foreign key)
-- Idempotent and safe for repeat executions across hospital_db and hospital_db_test.

-- 1. Create 1NF atomic patient_allergies table
CREATE TABLE IF NOT EXISTS `patient_allergies` (
  `allergy_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` int(10) unsigned NOT NULL,
  `allergen_name` varchar(150) NOT NULL,
  `severity` enum('mild','moderate','severe','unknown') NOT NULL DEFAULT 'unknown',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`allergy_id`),
  KEY `idx_patient_allergy` (`patient_id`),
  CONSTRAINT `fk_patient_allergies_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Ensure icd10_codes lookup table exists and code column width matches diagnosis.icd10_code (varchar(20))
CREATE TABLE IF NOT EXISTS `icd10_codes` (
  `code` varchar(20) NOT NULL,
  `description` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `icd10_codes` MODIFY COLUMN `code` varchar(20) NOT NULL;

-- 3. Sanitize any empty or non-catalog icd10_code values in diagnosis before adding FK constraint
UPDATE `diagnosis`
SET `icd10_code` = NULL
WHERE `icd10_code` = ''
   OR (`icd10_code` IS NOT NULL AND `icd10_code` NOT IN (SELECT `code` FROM `icd10_codes`));

-- 4. Add 3NF foreign key constraint fk_diagnosis_icd10 if not already present
SET @has_fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'diagnosis' AND CONSTRAINT_NAME = 'fk_diagnosis_icd10');
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE `diagnosis` ADD KEY `fk_diagnosis_icd10` (`icd10_code`), ADD CONSTRAINT `fk_diagnosis_icd10` FOREIGN KEY (`icd10_code`) REFERENCES `icd10_codes` (`code`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

