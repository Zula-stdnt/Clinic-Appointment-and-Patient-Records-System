-- migrations/014_structured_prescriptions.sql
-- Adds strength, route, duration, and instructions to prescriptions for structured medication orders.
-- Idempotent and safe for repeat executions.

USE hospital_db;

-- 1. Add strength column
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'strength');
SET @sql := IF(@has_col = 0, 'ALTER TABLE `prescriptions` ADD COLUMN `strength` varchar(100) DEFAULT NULL AFTER `medication_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add route column
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'route');
SET @sql := IF(@has_col = 0, 'ALTER TABLE `prescriptions` ADD COLUMN `route` varchar(50) DEFAULT NULL AFTER `dosage`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add duration column
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'duration');
SET @sql := IF(@has_col = 0, 'ALTER TABLE `prescriptions` ADD COLUMN `duration` varchar(50) DEFAULT NULL AFTER `frequency`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Add instructions column
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'instructions');
SET @sql := IF(@has_col = 0, 'ALTER TABLE `prescriptions` ADD COLUMN `instructions` text DEFAULT NULL AFTER `duration`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

