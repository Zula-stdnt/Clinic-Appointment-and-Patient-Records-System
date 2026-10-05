-- 009_prescriptions_time_to_take.sql
-- Adds the time-of-day instructions to prescriptions so the printed Rx slip
-- can tell the patient when to take each medication. Absent-safe: skipped when
-- the column already exists (databases that ran the earlier experimental
-- 010_prescriptions_time_to_take.sql).
USE hospital_db;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'time_to_take');
SET @sql := IF(@has_col = 0, 'ALTER TABLE `prescriptions` ADD COLUMN `time_to_take` varchar(100) DEFAULT NULL AFTER `frequency`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
