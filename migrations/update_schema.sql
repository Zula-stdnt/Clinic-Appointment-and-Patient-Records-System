USE hospital_db;

-- 1. Alter billing to enforce 1:1 relationship with consultation
ALTER TABLE billing DROP FOREIGN KEY fk_billing_consultation;
ALTER TABLE billing DROP INDEX fk_billing_consultation;
ALTER TABLE billing ADD UNIQUE KEY fk_billing_consultation (consultation_id);
ALTER TABLE billing ADD CONSTRAINT fk_billing_consultation FOREIGN KEY (consultation_id) REFERENCES consultation (consultation_id) ON UPDATE CASCADE;

-- 2. Alter medications to support soft delete
ALTER TABLE medications ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

-- 3. Alter patients to include middle_initial
ALTER TABLE patients ADD COLUMN middle_initial VARCHAR(10) DEFAULT NULL AFTER last_name;

-- 4. Standardize gender ENUM in users and doctors
-- Temporarily allow both cases
ALTER TABLE users MODIFY COLUMN gender ENUM('Male', 'Female', 'Other', 'male', 'female', 'other', 'unknown') NOT NULL DEFAULT 'unknown';
ALTER TABLE doctors MODIFY COLUMN gender ENUM('Male', 'Female', 'Other', 'male', 'female', 'other', 'unknown') NOT NULL DEFAULT 'unknown';

-- Convert to lowercase
UPDATE users SET gender = LOWER(gender);
UPDATE doctors SET gender = LOWER(gender);

-- Restrict ENUM to standard values
ALTER TABLE users MODIFY COLUMN gender ENUM('male', 'female', 'other', 'unknown') NOT NULL DEFAULT 'unknown';
ALTER TABLE doctors MODIFY COLUMN gender ENUM('male', 'female', 'other', 'unknown') NOT NULL DEFAULT 'unknown';
