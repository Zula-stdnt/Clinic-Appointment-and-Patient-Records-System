<?php
// api/user_controller.php
// Master-file CRUD for Users (strictly restricted to Doctor and Receptionist)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

// Section 6: Enforce authentication and Administrator role at top
require_login();
require_role('Administrator');
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        if (isset($_GET['meta'])) {
            if ($_GET['meta'] === 'roles') {
                $stmt = $pdo->query("SELECT role_id, role_name FROM roles WHERE role_name IN ('Doctor', 'Receptionist') ORDER BY role_name ASC");
                send_success('Roles retrieved successfully.', ['roles' => $stmt->fetchAll()]);
            } elseif ($_GET['meta'] === 'specialties') {
                $stmt = $pdo->query("SELECT specialty_id, specialty_name FROM specialties WHERE deleted_at IS NULL ORDER BY specialty_name ASC");
                send_success('Specialties retrieved successfully.', ['specialties' => $stmt->fetchAll()]);
            }
        } elseif (isset($_GET['id'])) {
            getUserById($pdo, (int)$_GET['id']);
        } else {
            listUsers($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'soft_delete') {
            softDeleteUser($pdo);
        } elseif ($action === 'restore') {
            restoreUser($pdo);
        } elseif ($action === 'hard_delete') {
            hardDeleteUser($pdo);
        } else {
            createUser($pdo);
        }
    } elseif ($method === 'PUT') {
        if ($action === 'soft_delete') {
            softDeleteUser($pdo);
        } elseif ($action === 'restore') {
            restoreUser($pdo);
        } else {
            updateUser($pdo);
        }
    } elseif ($method === 'DELETE') {
        hardDeleteUser($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log('User controller DB error: ' . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete user: related transaction records exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
}

function listUsers(PDO $pdo): void {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
    $offset = ($page - 1) * $pageSize;

    $search = trim($_GET['search'] ?? '');
    $status = $_GET['status'] ?? 'active'; // 'active', 'deleted', 'all'
    $roleFilter = trim($_GET['role'] ?? '');

    $where = ["r.role_name IN ('Doctor', 'Receptionist')"];
    $params = [];

    // Status filter
    if ($status === 'active') {
        $where[] = "u.deleted_at IS NULL";
    } elseif ($status === 'deleted') {
        $where[] = "u.deleted_at IS NOT NULL";
    }

    // Role filter
    if ($roleFilter !== '' && in_array($roleFilter, ['Doctor', 'Receptionist'], true)) {
        $where[] = "r.role_name = :role_filter";
        $params[':role_filter'] = $roleFilter;
    }

    // Search filter
    if ($search !== '') {
        $where[] = "(u.username LIKE :search1 OR u.first_name LIKE :search2 OR u.last_name LIKE :search3)";
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    // Sorting whitelist
    $allowedSort = ['user_id', 'username', 'first_name', 'last_name', 'role_name', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'u.user_id';
    if ($sortBy === 'role_name') {
        $sortBy = 'r.role_name';
    } elseif ($sortBy !== 'u.user_id') {
        $sortBy = 'u.' . $sortBy;
    }

    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    // Count query
    $countSql = "SELECT COUNT(*) FROM users u INNER JOIN roles r ON u.role_id = r.role_id WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Data query with strict integer binding for LIMIT and OFFSET
    $dataSql = "SELECT u.user_id, u.role_id, 
                       CONCAT(u.last_name, ', ', u.first_name, IF(u.middle_initial IS NOT NULL AND u.middle_initial != '', CONCAT(' ', u.middle_initial, '.'), '')) AS full_name,
                       u.first_name, u.last_name, u.middle_initial, u.gender,
                       u.username, u.created_at, u.updated_at, u.deleted_at, r.role_name
                FROM users u
                INNER JOIN roles r ON u.role_id = r.role_id
                WHERE {$whereSql}
                ORDER BY {$sortBy} {$sortOrder}
                LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($dataSql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $items = $stmt->fetchAll();

    send_success('Users retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getUserById(PDO $pdo, int $userId): void {
    $stmt = $pdo->prepare(
        "SELECT u.user_id, u.role_id, 
                CONCAT(u.last_name, ', ', u.first_name, IF(u.middle_initial IS NOT NULL AND u.middle_initial != '', CONCAT(' ', u.middle_initial, '.'), '')) AS full_name,
                u.first_name, u.last_name, u.middle_initial, u.gender,
                u.username, u.created_at, u.updated_at, u.deleted_at, r.role_name,
                d.contact_no,
                GROUP_CONCAT(DISTINCT ds.specialty_id SEPARATOR ',') AS specialty_ids
         FROM users u
         INNER JOIN roles r ON u.role_id = r.role_id
         LEFT JOIN doctors d ON u.user_id = d.user_id
         LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
         WHERE u.user_id = ? AND r.role_name IN ('Doctor', 'Receptionist')
         GROUP BY u.user_id, u.role_id, u.first_name, u.last_name, u.middle_initial, u.gender, u.username, u.created_at, u.updated_at, u.deleted_at, r.role_name, d.contact_no
         LIMIT 1"
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        send_error('User not found or access denied.', [], 404);
    }

    send_success('User retrieved successfully.', ['user' => $user]);
}

function createUser(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $firstName = trim($input['first_name'] ?? '');
    $lastName = trim($input['last_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
    $gender = $input['gender'] ?? 'Other';
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $roleId   = (int)($input['role_id'] ?? 0);
    $specialtyIds = normalize_specialty_ids($input);
    $contactNo = trim($input['contact_no'] ?? '');

    $errors = [];
    if ($firstName === '') {
        $errors['first_name'] = 'First name is required.';
    }
    if ($lastName === '') {
        $errors['last_name'] = 'Last name is required.';
    }
    if (!in_array($gender, ['Male', 'Female', 'Other'])) {
        $errors['gender'] = 'Please select a valid gender.';
    }
    if ($username === '') {
        $errors['username'] = 'Username is required.';
    }
    if ($password === '' || strlen($password) < 6) {
        $errors['password'] = 'Password is required and must be at least 6 characters.';
    }

    $stmt = $pdo->prepare("SELECT role_id, role_name FROM roles WHERE role_id = ? AND role_name IN ('Doctor', 'Receptionist')");
    $stmt->execute([$roleId]);
    $role = $stmt->fetch();
    if (!$role) {
        $errors['role_id'] = 'Only Doctor or Receptionist roles can be assigned here.';
    }
    
    if ($role && $role['role_name'] === 'Doctor') {
        if (empty($specialtyIds)) {
            $errors['specialty_id'] = 'Please select at least one specialty for the Doctor.';
        } elseif (!active_specialty_ids_exist($pdo, $specialtyIds)) {
            $errors['specialty_id'] = 'One or more selected specialties are inactive or do not exist.';
        }
    }

    // Username uniqueness check
    if ($username !== '') {
        $uStmt = $pdo->prepare("SELECT 1 FROM users WHERE username = ?");
        $uStmt->execute([$username]);
        if ($uStmt->fetch()) {
            $errors['username'] = 'This username is already in use.';
        }
    }

    if (!empty($errors)) {
        send_error('Validation failed. Please correct the errors.', $errors, 422);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    try {
        $pdo->beginTransaction();

        $ins = $pdo->prepare(
            "INSERT INTO users (role_id, first_name, last_name, middle_initial, gender, username, password_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $ins->execute([$roleId, $firstName, $lastName, $middleInitial, $gender, $username, $passwordHash]);
        $newUserId = (int)$pdo->lastInsertId();

        if ($role['role_name'] === 'Doctor') {
            // Names/gender live on the users row; doctors stores only profile data.
            $docIns = $pdo->prepare(
                "INSERT INTO doctors (user_id, contact_no) VALUES (?, ?)"
            );
            $docIns->execute([$newUserId, $contactNo]);
            $newDocId = (int)$pdo->lastInsertId();

            $specIns = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (?, ?)");
            foreach ($specialtyIds as $specialtyId) {
                $specIns->execute([$newDocId, $specialtyId]);
            }
        }

        $pdo->commit();
        send_success('User created successfully.', ['user_id' => $newUserId], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function updateUser(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $userId   = (int)($_GET['id'] ?? ($input['user_id'] ?? 0));
    $firstName = trim($input['first_name'] ?? '');
    $lastName = trim($input['last_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
    $gender = $input['gender'] ?? 'Other';
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $roleId   = (int)($input['role_id'] ?? 0);
    $specialtyIds = normalize_specialty_ids($input);
    $contactNo = trim($input['contact_no'] ?? '');

    // Verify user exists
    $chk = $pdo->prepare(
        "SELECT u.user_id, r.role_name, d.doctor_id FROM users u
         INNER JOIN roles r ON u.role_id = r.role_id
         LEFT JOIN doctors d ON u.user_id = d.user_id
         WHERE u.user_id = ? AND r.role_name IN ('Doctor', 'Receptionist')"
    );
    $chk->execute([$userId]);
    $existingUser = $chk->fetch();
    if (!$existingUser) {
        send_error('User not found or access denied.', [], 404);
    }
    
    // Check new role
    $stmt = $pdo->prepare("SELECT role_id, role_name FROM roles WHERE role_id = ? AND role_name IN ('Doctor', 'Receptionist')");
    $stmt->execute([$roleId]);
    $newRole = $stmt->fetch();
    if (!$newRole) {
        send_error('Validation failed.', ['role_id' => 'Only Doctor or Receptionist roles can be assigned here.'], 422);
    }

    $errors = [];
    if ($firstName === '') {
        $errors['first_name'] = 'First name is required.';
    }
    if ($lastName === '') {
        $errors['last_name'] = 'Last name is required.';
    }
    if (!in_array($gender, ['Male', 'Female', 'Other'])) {
        $errors['gender'] = 'Please select a valid gender.';
    }
    if ($username === '') {
        $errors['username'] = 'Username is required.';
    }
    if ($newRole['role_name'] === 'Doctor') {
        if (empty($specialtyIds)) {
            $errors['specialty_id'] = 'Please select at least one specialty for the Doctor.';
        } elseif (!active_specialty_ids_exist($pdo, $specialtyIds)) {
            $errors['specialty_id'] = 'One or more selected specialties are inactive or do not exist.';
        }
    }

    // Check unique username for another user
    if ($username !== '') {
        $uStmt = $pdo->prepare("SELECT 1 FROM users WHERE username = ? AND user_id != ?");
        $uStmt->execute([$username, $userId]);
        if ($uStmt->fetch()) {
            $errors['username'] = 'This username is already taken by another account.';
        }
    }

    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    try {
        $pdo->beginTransaction();

        // Update user
        if ($password !== '') {
            if (strlen($password) < 6) {
                $pdo->rollBack();
                send_error('Validation failed.', ['password' => 'Password must be at least 6 characters.'], 422);
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $upd = $pdo->prepare(
                "UPDATE users SET role_id = ?, first_name = ?, last_name = ?, middle_initial = ?, gender = ?, username = ?, password_hash = ? WHERE user_id = ?"
            );
            $upd->execute([$roleId, $firstName, $lastName, $middleInitial, $gender, $username, $hash, $userId]);
        } else {
            $upd = $pdo->prepare(
                "UPDATE users SET role_id = ?, first_name = ?, last_name = ?, middle_initial = ?, gender = ?, username = ? WHERE user_id = ?"
            );
            $upd->execute([$roleId, $firstName, $lastName, $middleInitial, $gender, $username, $userId]);
        }

        // Manage Doctor profile
        if ($newRole['role_name'] === 'Doctor') {
            if ($existingUser['doctor_id']) {
                // Update existing doctor profile (identity fields come from users)
                $updDoc = $pdo->prepare(
                    "UPDATE doctors SET contact_no = ?, deleted_at = NULL WHERE doctor_id = ?"
                );
                $updDoc->execute([$contactNo, $existingUser['doctor_id']]);

                // Update specialties
                $pdo->prepare("DELETE FROM doctor_specialty WHERE doctor_id = ?")->execute([$existingUser['doctor_id']]);
                $specIns = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (?, ?)");
                foreach ($specialtyIds as $specialtyId) {
                    $specIns->execute([$existingUser['doctor_id'], $specialtyId]);
                }
            } else {
                // Insert new doctor profile if they changed from Receptionist to Doctor
                $docIns = $pdo->prepare(
                    "INSERT INTO doctors (user_id, contact_no) VALUES (?, ?)"
                );
                $docIns->execute([$userId, $contactNo]);
                $newDocId = (int)$pdo->lastInsertId();

                $specIns = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (?, ?)");
                foreach ($specialtyIds as $specialtyId) {
                    $specIns->execute([$newDocId, $specialtyId]);
                }
            }
        } else {
            // Changed from Doctor to Receptionist. Soft-delete the doctor profile to prevent orphaned clinical data access.
            if ($existingUser['doctor_id']) {
                $pdo->prepare("UPDATE doctors SET deleted_at = NOW() WHERE doctor_id = ?")->execute([$existingUser['doctor_id']]);
            }
        }

        $pdo->commit();
        send_success('User updated successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function softDeleteUser(PDO $pdo): void {
    $input = get_json_input();
    $userId = (int)($_GET['id'] ?? ($input['user_id'] ?? 0));

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            "UPDATE users u
             INNER JOIN roles r ON u.role_id = r.role_id
             SET u.deleted_at = NOW()
             WHERE u.user_id = ? AND r.role_name IN ('Doctor', 'Receptionist') AND u.deleted_at IS NULL"
        );
        $stmt->execute([$userId]);

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('User not found or already deactivated.', [], 404);
        }
        
        $pdo->prepare("UPDATE doctors SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL")->execute([$userId]);

        $pdo->commit();
        send_success('User deactivated (soft-deleted) successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function restoreUser(PDO $pdo): void {
    $input = get_json_input();
    $userId = (int)($_GET['id'] ?? ($input['user_id'] ?? 0));

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            "UPDATE users u
             INNER JOIN roles r ON u.role_id = r.role_id
             SET u.deleted_at = NULL
             WHERE u.user_id = ? AND r.role_name IN ('Doctor', 'Receptionist') AND u.deleted_at IS NOT NULL"
        );
        $stmt->execute([$userId]);

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('User not found or already active.', [], 404);
        }

        $pdo->prepare("UPDATE doctors SET deleted_at = NULL WHERE user_id = ? AND deleted_at IS NOT NULL")->execute([$userId]);

        $pdo->commit();
        send_success('User restored successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function hardDeleteUser(PDO $pdo): void {
    $input = get_json_input();
    $userId = (int)($_GET['id'] ?? ($input['user_id'] ?? 0));

    try {
        $pdo->beginTransaction();

        $chk = $pdo->prepare(
            "SELECT u.user_id FROM users u
             INNER JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = ? AND r.role_name IN ('Doctor', 'Receptionist')"
        );
        $chk->execute([$userId]);
        if (!$chk->fetch()) {
            $pdo->rollBack();
            send_error('User not found.', [], 404);
        }

        $pdo->prepare("DELETE FROM doctors WHERE user_id = ?")->execute([$userId]);
        $pdo->prepare("DELETE FROM users WHERE user_id = ?")->execute([$userId]);

        $pdo->commit();
        send_success('User permanently deleted.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// Normalizes specialty_ids (multiple) with legacy single specialty_id support
function normalize_specialty_ids(array $input): array {
    $raw = $input['specialty_ids'] ?? $input['specialty_id'] ?? [];
    if (!is_array($raw)) {
        $raw = [$raw];
    }

    $ids = [];
    foreach ($raw as $value) {
        $id = (int)$value;
        if ($id > 0) {
            $ids[$id] = $id;
        }
    }

    return array_values($ids);
}

// Returns true when every given specialty exists and is active
function active_specialty_ids_exist(PDO $pdo, array $specialtyIds): bool {
    $placeholders = implode(',', array_fill(0, count($specialtyIds), '?'));
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM specialties WHERE specialty_id IN ({$placeholders}) AND deleted_at IS NULL");
    $stmt->execute($specialtyIds);

    return (int)$stmt->fetchColumn() === count($specialtyIds);
}
