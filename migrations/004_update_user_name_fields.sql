-- Migration 004: Update User Name Fields

-- 1. Add new columns to users table
ALTER TABLE users 
ADD COLUMN first_name VARCHAR(80) NOT NULL AFTER role_id,
ADD COLUMN last_name VARCHAR(80) NOT NULL AFTER first_name,
ADD COLUMN middle_initial VARCHAR(10) NULL AFTER last_name,
ADD COLUMN gender ENUM('Male', 'Female', 'Other') NOT NULL DEFAULT 'Other' AFTER middle_initial;

-- 2. Migrate existing data based on full_name
UPDATE users SET 
    first_name = 'Jamaica', 
    last_name = 'Mcren', 
    gender = 'Female' 
WHERE username = 'Mcren';

UPDATE users SET 
    first_name = 'Gregory', 
    last_name = 'House', 
    gender = 'Male' 
WHERE username = 'dr.smith';

UPDATE users SET 
    first_name = 'Jane', 
    last_name = 'Doe', 
    gender = 'Female' 
WHERE username = 'recep.jane';

UPDATE users SET 
    first_name = 'John', 
    last_name = 'Watson', 
    gender = 'Male' 
WHERE username = 'dr.watson';

UPDATE users SET 
    first_name = 'Meredith', 
    last_name = 'Grey', 
    gender = 'Female' 
WHERE username = 'dr.grey';

UPDATE users SET 
    first_name = 'Stephen', 
    last_name = 'Strange', 
    gender = 'Male' 
WHERE username = 'dr.strange';

UPDATE users SET 
    first_name = 'Doogie', 
    last_name = 'Howser', 
    gender = 'Male' 
WHERE username = 'dr.howser';

UPDATE users SET 
    first_name = 'Test', 
    last_name = 'Admin', 
    gender = 'Other' 
WHERE username = 'testadmin';

-- For any other users created during testing:
UPDATE users SET 
    first_name = SUBSTRING_INDEX(full_name, ' ', 1),
    last_name = TRIM(SUBSTR(full_name, LOCATE(' ', full_name)))
WHERE first_name = '';

-- 3. Drop full_name column
ALTER TABLE users DROP COLUMN full_name;

-- 4. Update doctors table to include middle_initial and gender to stay in sync if needed.
-- Wait, the prompt says "Use the name format Last Name, First Name Middle Initial for all displayed user names throughout the system."
-- Let's add middle_initial and gender to doctors table too so clinical profiles have it.
ALTER TABLE doctors
ADD COLUMN middle_initial VARCHAR(10) NULL AFTER last_name,
ADD COLUMN gender ENUM('Male', 'Female', 'Other') NOT NULL DEFAULT 'Other' AFTER middle_initial;

-- Sync gender/MI from users to doctors
UPDATE doctors d
JOIN users u ON d.user_id = u.user_id
SET d.gender = u.gender, d.middle_initial = u.middle_initial;

