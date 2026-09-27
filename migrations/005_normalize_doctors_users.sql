-- Migration 005: Normalize doctors <-> users (remove duplicated personal data)
--
-- Problem: first_name, last_name, middle_initial, and gender were stored in BOTH
-- users and doctors, so account creation had to write the same values twice and
-- the two tables could drift apart.
--
-- Better design: personal identity data lives ONLY in users. The doctors table
-- keeps only doctor-specific data: doctor_id, user_id (unique, links to the
-- login account), contact_no, timestamps, and deleted_at.
-- All doctor listings read names via JOIN users u ON d.user_id = u.user_id.

-- 1. Safety sync: if a doctor profile was ever edited directly, keep the values
--    that were saved on the profile.
UPDATE users u
INNER JOIN doctors d ON d.user_id = u.user_id
SET u.first_name     = d.first_name,
    u.last_name      = d.last_name,
    u.middle_initial = d.middle_initial,
    u.gender         = d.gender
WHERE u.first_name <> d.first_name
   OR u.last_name <> d.last_name
   OR IFNULL(u.middle_initial, '') <> IFNULL(d.middle_initial, '')
   OR u.gender <> d.gender;

-- 2. Drop the redundant columns from doctors.
ALTER TABLE doctors
    DROP COLUMN first_name,
    DROP COLUMN last_name,
    DROP COLUMN middle_initial,
    DROP COLUMN gender;
