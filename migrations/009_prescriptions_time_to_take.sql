-- 009_prescriptions_time_to_take.sql
-- Adds the time-of-day instructions to prescriptions so the printed Rx slip
-- can tell the patient when to take each medication.

ALTER TABLE `prescriptions`
  ADD COLUMN `time_to_take` varchar(100) DEFAULT NULL AFTER `frequency`;
