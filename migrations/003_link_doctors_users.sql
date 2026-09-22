-- Migration 003: Link Users and Doctors

-- 1. Add user_id column to doctors table
ALTER TABLE doctors 
ADD COLUMN user_id INT UNSIGNED UNIQUE NULL AFTER doctor_id;

-- 2. Add foreign key constraint
ALTER TABLE doctors 
ADD CONSTRAINT fk_doctor_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Link Dr. Gregory House (doctor_id = 1) to dr.smith (user_id = 4 or we lookup)
UPDATE doctors d
JOIN users u ON u.username = 'dr.smith'
SET d.user_id = u.user_id
WHERE d.doctor_id = 1;

-- 4. Create missing user accounts for the other seeded doctors
-- Note: password_hash for 'DoctorPass123!' is $2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne
-- Get Doctor role ID
SET @doctor_role_id = (SELECT role_id FROM roles WHERE role_name = 'Doctor' LIMIT 1);

-- Insert Dr. John Watson (doctor_id = 2)
INSERT INTO users (role_id, full_name, username, password_hash)
SELECT @doctor_role_id, 'Dr. John Watson', 'dr.watson', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'dr.watson');

UPDATE doctors SET user_id = (SELECT user_id FROM users WHERE username = 'dr.watson') WHERE doctor_id = 2;

-- Insert Dr. Meredith Grey (doctor_id = 3)
INSERT INTO users (role_id, full_name, username, password_hash)
SELECT @doctor_role_id, 'Dr. Meredith Grey', 'dr.grey', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'dr.grey');

UPDATE doctors SET user_id = (SELECT user_id FROM users WHERE username = 'dr.grey') WHERE doctor_id = 3;

-- Insert Dr. Stephen Strange (doctor_id = 4)
INSERT INTO users (role_id, full_name, username, password_hash)
SELECT @doctor_role_id, 'Dr. Stephen Strange', 'dr.strange', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'dr.strange');

UPDATE doctors SET user_id = (SELECT user_id FROM users WHERE username = 'dr.strange') WHERE doctor_id = 4;

-- Insert Dr. Doogie Howser (doctor_id = 5)
INSERT INTO users (role_id, full_name, username, password_hash)
SELECT @doctor_role_id, 'Dr. Doogie Howser', 'dr.howser', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'dr.howser');

UPDATE doctors SET user_id = (SELECT user_id FROM users WHERE username = 'dr.howser') WHERE doctor_id = 5;

