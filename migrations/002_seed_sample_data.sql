-- Migration 002: Seed Initial & Sample Data

-- Ensure roles table has all standard roles
INSERT IGNORE INTO roles (role_id, role_name) VALUES
(1, 'Administrator'),
(2, 'Receptionist'),
(3, 'Doctor');

-- Seed standard Admin user (admin / AdminPass123!)
INSERT INTO users (role_id, full_name, username, password_hash)
VALUES (1, 'System Administrator', 'admin', '$2y$10$gB0//FTP9jXR5ueeeaGlX.rgf9KqFMkxaMfH3tnZUSbfXX1SmoNn6')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash);

-- Seed sample Doctor user (dr.smith / DoctorPass123!)
INSERT INTO users (role_id, full_name, username, password_hash)
VALUES (3, 'Dr. Gregory House', 'dr.smith', '$2y$10$Z7VmXRKKKFK.wqCj/9cUGeQ91BOn9up/LnWqkYYSJILfKIVanIpne')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash);

-- Seed sample Receptionist user (recep.jane / RecepPass123!)
INSERT INTO users (role_id, full_name, username, password_hash)
VALUES (2, 'Jane Doe', 'recep.jane', '$2y$10$KbtbTTvMurQl1Itl1yPy1uDZsocnvB0RDv/Z34/6flK6utWnduaIy')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash);

-- Seed Specialties
INSERT INTO specialties (specialty_name) VALUES
('Cardiology'),
('Pediatrics'),
('General Surgery'),
('Dermatology'),
('Orthopedics'),
('Neurology'),
('Internal Medicine')
ON DUPLICATE KEY UPDATE specialty_name = VALUES(specialty_name);

-- Seed Doctors
INSERT INTO doctors (doctor_id, first_name, last_name, contact_no) VALUES
(1, 'Gregory', 'House', '09171234567'),
(2, 'John', 'Watson', '09181234568'),
(3, 'Meredith', 'Grey', '09191234569'),
(4, 'Stephen', 'Strange', '09201234570'),
(5, 'Doogie', 'Howser', '09211234571')
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), contact_no = VALUES(contact_no);

-- Seed Doctor Specialties
INSERT IGNORE INTO doctor_specialty (doctor_id, specialty_id) VALUES
(1, 7), -- House -> Internal Medicine
(2, 7), -- Watson -> Internal Medicine
(3, 3), -- Grey -> General Surgery
(4, 6), -- Strange -> Neurology
(5, 2); -- Howser -> Pediatrics

-- Seed Services
INSERT INTO services (service_name, price) VALUES
('General Consultation', 500.00),
('Complete Blood Count (CBC)', 350.00),
('Chest X-Ray', 750.00),
('Electrocardiogram (ECG)', 600.00),
('Urinalysis', 200.00),
('Abdominal Ultrasound', 1500.00),
('Lipid Profile', 800.00)
ON DUPLICATE KEY UPDATE price = VALUES(price);

-- Seed Discounts
INSERT INTO discounts (discount_name, percentage) VALUES
('Senior Citizen Discount', 20.00),
('PWD Discount', 20.00),
('Hospital Employee Discount', 15.00),
('PhilHealth Member', 10.00),
('Indigent Patient Assistance', 50.00)
ON DUPLICATE KEY UPDATE percentage = VALUES(percentage);

-- Seed Patients
INSERT INTO patients (patient_id, first_name, last_name, gender, date_of_birth, contact_no, address) VALUES
(1, 'Juan', 'Dela Cruz', 'male', '1985-04-12', '09171112233', '123 Rizal St, Sampaloc, Manila'),
(2, 'Maria', 'Santos', 'female', '1992-08-23', '09182223344', '456 Quezon Ave, Quezon City'),
(3, 'Jose', 'Rizal', 'male', '1970-06-19', '09193334455', '789 Luna St, Pasig City'),
(4, 'Ana', 'Garcia', 'female', '2001-11-05', '09204445566', '321 Mabini Rd, Makati City'),
(5, 'Carlos', 'Perez', 'male', '1963-02-17', '09215556677', '654 Bonifacio Blvd, Taguig City')
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), gender = VALUES(gender);

-- Seed Appointment for Doctor 1 (Dr. Gregory House) to establish FK link for testing delete constraints
INSERT INTO appointments (appointment_id, patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status)
SELECT 1, 1, 1, user_id, '2026-09-25', '10:00:00', 'Persistent cough and fever', 'scheduled'
FROM users WHERE role_id = 1 LIMIT 1
ON DUPLICATE KEY UPDATE status = VALUES(status);

