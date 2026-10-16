-- Deterministic schema generated from reviewed migrations
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

CREATE TABLE `appointments` (
  `appointment_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` int(10) unsigned NOT NULL,
  `doctor_id` int(10) unsigned NOT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `appointment_date` date NOT NULL,
  `appointment_time` time NOT NULL,
  `chief_complaint` text DEFAULT NULL,
  `status` enum('scheduled','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  `cancel_requested` tinyint(1) NOT NULL DEFAULT 0,
  `cancel_request_reason` text DEFAULT NULL,
  `cancel_requested_at` datetime DEFAULT NULL,
  `cancel_requested_by` int(10) unsigned DEFAULT NULL,
  `active_slot` varchar(50) GENERATED ALWAYS AS (if(`status` in ('cancelled','no_show'),NULL,concat(`appointment_date`,' ',`appointment_time`))) STORED,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`appointment_id`),
  KEY `fk_appointments_patient` (`patient_id`),
  KEY `fk_appointments_creator` (`created_by`),
  KEY `idx_appointment_schedule` (`doctor_id`,`appointment_date`,`appointment_time`),
  UNIQUE KEY `uq_doctor_active_slot` (`doctor_id`,`active_slot`),
  CONSTRAINT `fk_appointments_cancel_req_by` FOREIGN KEY (`cancel_requested_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_appointments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_appointments_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_appointments_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `consultation` (
  `consultation_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `appointment_id` int(10) unsigned NOT NULL,
  `consultation_date` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`consultation_id`),
  UNIQUE KEY `appointment_id` (`appointment_id`),
  CONSTRAINT `fk_consultation_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`appointment_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `diagnosis` (
  `diagnosis_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `consultation_id` int(10) unsigned NOT NULL,
  `icd10_code` varchar(20) DEFAULT NULL,
  `diagnosis_name` varchar(200) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`diagnosis_id`),
  KEY `fk_diagnosis_consultation` (`consultation_id`),
  CONSTRAINT `fk_diagnosis_consultation` FOREIGN KEY (`consultation_id`) REFERENCES `consultation` (`consultation_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctor_specialty` (
  `doctor_id` int(10) unsigned NOT NULL,
  `specialty_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`doctor_id`,`specialty_id`),
  KEY `fk_ds_specialty` (`specialty_id`),
  CONSTRAINT `fk_ds_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ds_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`specialty_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctors` (
  `doctor_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `contact_no` varchar(30) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`doctor_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_doctor_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lab_requests` (
  `lab_request_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `consultation_id` int(10) unsigned NOT NULL,
  `test_name` varchar(150) NOT NULL,
  `status` enum('requested','in_progress','completed','cancelled') NOT NULL DEFAULT 'requested',
  `request_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`lab_request_id`),
  KEY `fk_lab_consultation` (`consultation_id`),
  CONSTRAINT `fk_lab_consultation` FOREIGN KEY (`consultation_id`) REFERENCES `consultation` (`consultation_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `medications` (
  `medication_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `generic_name` varchar(150) DEFAULT NULL,
  `manufacturer` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`medication_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patients` (
  `patient_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `middle_initial` varchar(10) DEFAULT NULL,
  `gender` varchar(50) NOT NULL DEFAULT 'unknown',
  `date_of_birth` date NOT NULL,
  `contact_no` varchar(30) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `allergies_alerts` text DEFAULT NULL,
  `allergies_confirmed_by_doctor` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`patient_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prescriptions` (
  `prescription_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `consultation_id` int(10) unsigned NOT NULL,
  `medication_id` int(10) unsigned NOT NULL,
  `strength` varchar(100) DEFAULT NULL,
  `dosage` varchar(100) NOT NULL,
  `route` varchar(50) DEFAULT NULL,
  `frequency` varchar(100) NOT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `time_to_take` varchar(100) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`prescription_id`),
  KEY `fk_prescriptions_consultation` (`consultation_id`),
  KEY `fk_prescriptions_medication` (`medication_id`),
  CONSTRAINT `fk_prescriptions_consultation` FOREIGN KEY (`consultation_id`) REFERENCES `consultation` (`consultation_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_prescriptions_medication` FOREIGN KEY (`medication_id`) REFERENCES `medications` (`medication_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `role_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `services` (
  `service_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `service_name` varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`service_id`),
  UNIQUE KEY `service_name` (`service_name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `specialties` (
  `specialty_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `specialty_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`specialty_id`),
  UNIQUE KEY `specialty_name` (`specialty_name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `user_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` int(10) unsigned NOT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `middle_initial` varchar(10) DEFAULT NULL,
  `gender` varchar(50) NOT NULL DEFAULT 'unknown',
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON UPDATE CASCADE
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vital_signs` (
  `vital_sign_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `appointment_id` int(10) unsigned NOT NULL,
  `blood_pressure` varchar(20) DEFAULT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `oxygen_saturation` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`vital_sign_id`),
  UNIQUE KEY `unique_appointment_vitals` (`appointment_id`),
  CONSTRAINT `fk_vitals_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`appointment_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `consultation_addenda` (
  `addendum_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `consultation_id` int(10) unsigned NOT NULL,
  `doctor_id` int(10) unsigned NOT NULL,
  `notes` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`addendum_id`),
  KEY `idx_addenda_consultation` (`consultation_id`),
  KEY `idx_addenda_doctor` (`doctor_id`),
  CONSTRAINT `fk_addenda_consultation` FOREIGN KEY (`consultation_id`) REFERENCES `consultation` (`consultation_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_addenda_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `action` varchar(50) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int(10) unsigned DEFAULT NULL,
  `old_values` longtext DEFAULT NULL,
  `new_values` longtext DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created_at` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctor_schedules` (
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

CREATE TABLE `record_access_requests` (
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

/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
