<?php
// api/doctor_profile_controller.php
// Manages the authenticated doctor's profile data (read/update)
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_update_records & 04 Database Design/database_normalization (Parameterized UPDATE with transactional sync across users and doctors tables)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    if ($method === 'GET') {
        getProfile($pdo);
    } elseif ($method === 'PUT' || $method === 'POST') {
        updateProfile($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in doctor_profile_controller.php: " . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in doctor_profile_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getProfile(PDO $pdo): void {
    $userId = $_SESSION['user_id'];
    
    // Fetch user and doctor profile
    $sql = "SELECT d.doctor_id, d.user_id, u.first_name, u.last_name, u.middle_initial, u.gender, d.contact_no, u.username, r.role_name, d.created_at, d.updated_at,
                   GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS specialty_names,
                   GROUP_CONCAT(DISTINCT s.specialty_id SEPARATOR ',') AS specialty_ids
            FROM doctors d
            INNER JOIN users u ON d.user_id = u.user_id
            INNER JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
            WHERE u.user_id = ? AND u.deleted_at IS NULL
            GROUP BY d.doctor_id, u.first_name, u.last_name, u.middle_initial, u.gender, d.contact_no, u.username, r.role_name, d.created_at, d.updated_at
            LIMIT 1";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        send_error('Profile not found.', [], 404);
    }

    send_success('Profile retrieved successfully.', ['profile' => $profile]);
}

function updateProfile(PDO $pdo): void {
    $userId = $_SESSION['user_id'];
    
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = [];
    $firstName = trim($input['first_name'] ?? '');
    $lastName = trim($input['last_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
    $gender = trim($input['gender'] ?? 'Unknown');
    $contactNo = trim($input['contact_no'] ?? '');
    $username = trim($input['username'] ?? '');

    // Validation
    if ($firstName === '') {
        $errors['first_name'] = 'First name is required.';
    } elseif (strlen($firstName) > 80) {
        $errors['first_name'] = 'First name cannot exceed 80 characters.';
    }

    if ($lastName === '') {
        $errors['last_name'] = 'Last name is required.';
    } elseif (strlen($lastName) > 80) {
        $errors['last_name'] = 'Last name cannot exceed 80 characters.';
    }

    if (strlen($middleInitial ?? '') > 10) {
        $errors['middle_initial'] = 'Middle initial cannot exceed 10 characters.';
    }

    if ($gender === '') {
        $errors['gender'] = 'Gender is required.';
    } elseif (strlen($gender) > 50) {
        $errors['gender'] = 'Gender cannot exceed 50 characters.';
    }

    // Contact number validation (allow empty, or require 11 digits starting with 09)
    if ($contactNo !== '') {
        $contactNoStripped = str_replace(' ', '', $contactNo);
        if (!ctype_digit($contactNoStripped) || strlen($contactNoStripped) !== 11 || !str_starts_with($contactNoStripped, '09')) {
            $errors['contact_no'] = 'Contact number must be exactly 11 digits and start with 09.';
        } else {
            $contactNo = $contactNoStripped; // Store stripped version
        }
    } else {
        $contactNo = null;
    }

    if ($username === '') {
        $errors['username'] = 'Username is required.';
    } else {
        $uStmt = $pdo->prepare("SELECT 1 FROM users WHERE username = ? AND user_id != ? AND deleted_at IS NULL");
        $uStmt->execute([$username, $userId]);
        if ($uStmt->fetch()) {
            $errors['username'] = 'This username is already taken by another account.';
        }
    }

    // Password validation
    $currentPassword = $input['current_password'] ?? '';
    $newPassword = $input['new_password'] ?? '';
    $confirmPassword = $input['confirm_password'] ?? '';
    $hash = null;

    if ($newPassword !== '') {
        if ($currentPassword === '') {
            $errors['current_password'] = 'Current password is required to change password.';
        } else {
            // Verify current password
            $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE user_id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
                $errors['current_password'] = 'Incorrect current password.';
            } else {
                if ($newPassword !== $confirmPassword) {
                    $errors['confirm_password'] = 'New passwords do not match.';
                } else {
                    $passwordRegex = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/';
                    if (!preg_match($passwordRegex, $newPassword)) {
                        $errors['new_password'] = 'Password must be at least 6 characters, and include uppercase, lowercase, number, and special character.';
                    } else {
                        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
                    }
                }
            }
        }
    }

    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    // Get doctor_id
    $dStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ?");
    $dStmt->execute([$userId]);
    $doc = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }
    $doctorId = $doc['doctor_id'];

    $pdo->beginTransaction();
    try {
        // Update users table
        if ($hash) {
            $uUpd = $pdo->prepare("UPDATE users SET first_name = ?, last_name = ?, middle_initial = ?, gender = ?, username = ?, password_hash = ? WHERE user_id = ?");
            $uUpd->execute([$firstName, $lastName, $middleInitial, $gender, $username, $hash, $userId]);
        } else {
            $uUpd = $pdo->prepare("UPDATE users SET first_name = ?, last_name = ?, middle_initial = ?, gender = ?, username = ? WHERE user_id = ?");
            $uUpd->execute([$firstName, $lastName, $middleInitial, $gender, $username, $userId]);
        }

        // Update doctors table to keep in sync
        $dUpd = $pdo->prepare("UPDATE doctors SET contact_no = ? WHERE doctor_id = ?");
        $dUpd->execute([$contactNo, $doctorId]);

        // Update session
        $fullName = $lastName . ', ' . $firstName . ($middleInitial ? ' ' . $middleInitial . '.' : '');
        $_SESSION['full_name'] = $fullName;
        $_SESSION['username'] = $username;

        $pdo->commit();
        send_success('Profile updated successfully.', ['full_name' => $fullName, 'username' => $username]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
