-- Migration 013: Doctor Schedules and Hybrid Break-Glass Access Control
-- Configures CPRMS weekly doctor availability and two-tier access requests

CREATE TABLE IF NOT EXISTS `doctor_schedules` (
  `schedule_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `doctor_id` int(10) unsigned NOT NULL,
  `day_of_week` tinyint(3) unsigned NOT NULL COMMENT '1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday',
  `start_time` time NOT NULL DEFAULT '08:00:00',
  `end_time` time NOT NULL DEFAULT '17:00:00',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`schedule_id`),
  UNIQUE KEY `uq_doctor_day` (`doctor_id`, `day_of_week`),
  KEY `idx_schedule_day` (`day_of_week`, `is_active`),
  CONSTRAINT `fk_schedule_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `record_access_requests` (
  `request_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `doctor_id` int(10) unsigned NOT NULL,
  `patient_id` int(10) unsigned NOT NULL,
  `mode` enum('standard','urgent') NOT NULL DEFAULT 'standard',
  `status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
  `reason` text NOT NULL,
  `is_audit_flagged` tinyint(1) NOT NULL DEFAULT 0,
  `audit_reviewed` tinyint(1) NOT NULL DEFAULT 0,
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_by` int(10) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `idx_access_lookup` (`doctor_id`, `patient_id`, `status`, `expires_at`),
  KEY `idx_access_audit` (`is_audit_flagged`, `audit_reviewed`),
  CONSTRAINT `fk_access_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_access_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_access_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure Cardiology (1) is active
UPDATE specialties SET deleted_at = NULL WHERE specialty_id = 1;

-- Configure initial 3 clinic doctors with multiple specialties (where doctors exist)
-- Doctor 1 (House): Internal Medicine (7) + Cardiology (1)
INSERT IGNORE INTO doctor_specialty (doctor_id, specialty_id)
SELECT 1, 7 FROM doctors WHERE doctor_id = 1
UNION ALL
SELECT 1, 1 FROM doctors WHERE doctor_id = 1;

-- Doctor 3 (Grey): General Surgery (3) + Pediatrics (2)
INSERT IGNORE INTO doctor_specialty (doctor_id, specialty_id)
SELECT 3, 3 FROM doctors WHERE doctor_id = 3
UNION ALL
SELECT 3, 2 FROM doctors WHERE doctor_id = 3;

-- Doctor 4 (Strange): Neurology (6) + Dermatology (4)
INSERT IGNORE INTO doctor_specialty (doctor_id, specialty_id)
SELECT 4, 6 FROM doctors WHERE doctor_id = 4
UNION ALL
SELECT 4, 4 FROM doctors WHERE doctor_id = 4;

-- Configure Fixed Weekly Availability Schedules:
-- Doctor 1 (Dr. Gregory House): Monday (1) & Tuesday (2), 08:00 - 17:00
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
SELECT 1, 1, '08:00:00', '17:00:00', 1 FROM doctors WHERE doctor_id = 1
UNION ALL
SELECT 1, 2, '08:00:00', '17:00:00', 1 FROM doctors WHERE doctor_id = 1
ON DUPLICATE KEY UPDATE start_time=VALUES(start_time), end_time=VALUES(end_time), is_active=VALUES(is_active);

-- Doctor 3 (Dr. Meredith Grey): Wednesday (3) & Thursday (4), 08:00 - 17:00
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
SELECT 3, 3, '08:00:00', '17:00:00', 1 FROM doctors WHERE doctor_id = 3
UNION ALL
SELECT 3, 4, '08:00:00', '17:00:00', 1 FROM doctors WHERE doctor_id = 3
ON DUPLICATE KEY UPDATE start_time=VALUES(start_time), end_time=VALUES(end_time), is_active=VALUES(is_active);

-- Doctor 4 (Dr. Stephen Strange): Friday (5) & Saturday (6), 08:00 - 17:00
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
SELECT 4, 5, '08:00:00', '17:00:00', 1 FROM doctors WHERE doctor_id = 4
UNION ALL
SELECT 4, 6, '08:00:00', '17:00:00', 1 FROM doctors WHERE doctor_id = 4
ON DUPLICATE KEY UPDATE start_time=VALUES(start_time), end_time=VALUES(end_time), is_active=VALUES(is_active);

