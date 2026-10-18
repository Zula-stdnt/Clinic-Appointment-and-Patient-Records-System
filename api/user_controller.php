<?php
// api/user_controller.php
// Master-file CRUD for Users (strictly restricted to Doctor and Receptionist)
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_insert_records, mysql_update_records & header_detail_forms (Prepared CRUD with bindParam, switch($operation), and PDO transaction across users, doctors, and doctor_specialty)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

// Section 6: Enforce authentication and Administrator role at top
require_login();
require_role('Administrator');
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_REQUEST['operation'] ?? $_GET['action'] ?? null;

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    send_error('Method not allowed.', [], 405);
}

if ($method === 'GET') {
    if (isset($_GET['meta'])) {
        $operation = 'meta_' . $_GET['meta'];
    } elseif ($action) {
        $operation = $action;
    } else {
        $operation = isset($_GET['id']) ? 'getUser' : 'getAllUsers';
    }
} elseif ($method === 'POST') {
    $operation = $action ?: 'createUser';
} elseif ($method === 'PUT') {
    $operation = $action ?: 'updateUser';
} else {
    $operation = 'hardDeleteUser';
}

try {
    switch ($operation) {
        case 'meta_roles':
            $stmt = $pdo->query("SELECT role_id, role_name FROM roles WHERE role_name IN ('Doctor', 'Receptionist') ORDER BY role_name ASC");
            send_success('Roles retrieved successfully.', ['roles' => $stmt->fetchAll()]);
            break;
        case 'meta_specialties':
            $stmt = $pdo->query("SELECT specialty_id, specialty_name FROM specialties WHERE deleted_at IS NULL ORDER BY specialty_name ASC");
            send_success('Specialties retrieved successfully.', ['specialties' => $stmt->fetchAll()]);
            break;
        case 'getAllUsers':
        case 'list':
            listUsers($pdo);
            break;
        case 'getUser':
        case 'get':
            getUserById($pdo, (int)($_GET['id'] ?? 0));
            break;
        case 'createUser':
        case 'create':
            createUser($pdo);
            break;
        case 'updateUser':
        case 'update':
            updateUser($pdo);
            break;
        case 'soft_delete':
        case 'softDeleteUser':
        case 'archiveUser':
            softDeleteUser($pdo);
            break;
        case 'restore':
        case 'restoreUser':
            restoreUser($pdo);
            break;
        case 'hard_delete':
        case 'hardDeleteUser':
        case 'deleteUser':
            hardDeleteUser($pdo);
            break;
        default:
            send_error('Invalid operation.', [], 400);
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

    // Gender filter
    $gender = strtolower(trim($_GET['gender'] ?? ''));
    if ($gender === 'male' || $gender === 'female' || $gender === 'unknown') {
        $where[] = 'LOWER(TRIM(u.gender)) = :gender';
        $params[':gender'] = $gender;
    } elseif ($gender === 'other') {
        $where[] = "(LOWER(TRIM(COALESCE(u.gender, ''))) NOT IN ('male', 'female', 'unknown') AND LOWER(TRIM(COALESCE(u.gender, ''))) != '')";
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
    $allowedSort = ['user_id', 'username', 'first_name', 'last_name', 'full_name', 'role_name', 'created_at', 'deleted_at'];
    $rawSort = $_GET['sort_by'] ?? '';
    if ($rawSort === 'full_name' || $rawSort === 'last_name') {
        $sortBy = 'u.last_name';
    } elseif ($rawSort === 'role_name') {
        $sortBy = 'r.role_name';
    } elseif (in_array($rawSort, $allowedSort, true)) {
        $sortBy = 'u.' . $rawSort;
    } else {
        $sortBy = 'u.user_id';
    }

    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    // Count query
    $countSql = "SELECT COUNT(*) FROM users u INNER JOIN roles r ON u.role_id = r.role_id WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => &$v) {
        $countStmt->bindParam($k, $v);
    }
    unset($v);
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
    foreach ($params as $k => &$v) {
        $stmt->bindParam($k, $v);
    }
    unset($v);
    $stmt->bindParam(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
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
         WHERE u.user_id = :userId AND r.role_name IN ('Doctor', 'Receptionist')
         GROUP BY u.user_id, u.role_id, u.first_name, u.last_name, u.middle_initial, u.gender, u.username, u.created_at, u.updated_at, u.deleted_at, r.role_name, d.contact_no
         LIMIT 1"
    );
    $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
    $stmt->execute();
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
    $rawMiddleInitial = trim($input['middle_initial'] ?? '');
    if ($rawMiddleInitial !== '') {
        if (!preg_match('/^[A-Za-z]$/', $rawMiddleInitial)) {
            $errors['middle_initial'] = 'Middle initial must be a single letter (A-Z).';
        }
    }
    $middleInitial = $rawMiddleInitial ?: null;
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
    if ($rawMiddleInitial !== '' && !preg_match('/^[A-Za-z]$/', $rawMiddleInitial)) {
        $errors['middle_initial'] = 'Middle initial must be a single letter (A-Z).';
    }
    if ($gender === '') {
        $errors['gender'] = 'Please select a valid gender.';
    }
    if ($username === '') {
        $errors['username'] = 'Username is required.';
    }

    $rawContact = preg_replace('/\s+/', '', $contactNo);
    if ($rawContact !== '' && (strlen($rawContact) !== 11 || strpos($rawContact, '09') !== 0 || !ctype_digit($rawContact))) {
        $errors['contact_no'] = 'Contact number must be exactly 11 digits and start with 09.';
    }

    $passwordRegex = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{6,}$/';
    if ($password === '') {
        $errors['password'] = 'Password is required.';
    } elseif (!preg_match($passwordRegex, $password)) {
        $errors['password'] = 'Password must be at least 6 characters, including uppercase, lowercase, number, and special character.';
    }

    $stmt = $pdo->prepare("SELECT role_id, role_name FROM roles WHERE role_id = :roleId AND role_name IN ('Doctor', 'Receptionist')");
    $stmt->bindParam(':roleId', $roleId, PDO::PARAM_INT);
    $stmt->execute();
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
        $uStmt = $pdo->prepare("SELECT 1 FROM users WHERE username = :username");
        $uStmt->bindParam(':username', $username);
        $uStmt->execute();
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
             VALUES (:roleId, :firstName, :lastName, :middleInitial, :gender, :username, :passwordHash)"
        );
        $ins->bindParam(':roleId', $roleId, PDO::PARAM_INT);
        $ins->bindParam(':firstName', $firstName);
        $ins->bindParam(':lastName', $lastName);
        $ins->bindParam(':middleInitial', $middleInitial);
        $ins->bindParam(':gender', $gender);
        $ins->bindParam(':username', $username);
        $ins->bindParam(':passwordHash', $passwordHash);
        $ins->execute();
        $newUserId = (int)$pdo->lastInsertId();

        if ($role['role_name'] === 'Doctor') {
            // Names/gender live on the users row; doctors stores only profile data.
            $docIns = $pdo->prepare(
                "INSERT INTO doctors (user_id, contact_no) VALUES (:userId, :contactNo)"
            );
            $docIns->bindParam(':userId', $newUserId, PDO::PARAM_INT);
            $docIns->bindParam(':contactNo', $contactNo);
            $docIns->execute();
            $newDocId = (int)$pdo->lastInsertId();

            $specIdVar = 0;
            $specIns = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (:docId, :specId)");
            $specIns->bindParam(':docId', $newDocId, PDO::PARAM_INT);
            $specIns->bindParam(':specId', $specIdVar, PDO::PARAM_INT);
            foreach ($specialtyIds as $specialtyId) {
                $specIdVar = (int)$specialtyId;
                $specIns->execute();
            }
        }

        $pdo->commit();
        log_audit($pdo, (int)$_SESSION['user_id'], 'CREATE_USER', 'user', $newUserId, null, ['username' => $username, 'role_name' => $role['role_name']]);
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
    $rawMiddleInitial = trim($input['middle_initial'] ?? '');
    $middleInitial = $rawMiddleInitial ?: null;
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
         WHERE u.user_id = :userId AND r.role_name IN ('Doctor', 'Receptionist')"
    );
    $chk->bindParam(':userId', $userId, PDO::PARAM_INT);
    $chk->execute();
    $existingUser = $chk->fetch();
    if (!$existingUser) {
        send_error('User not found or access denied.', [], 404);
    }
    
    // Check new role
    $stmt = $pdo->prepare("SELECT role_id, role_name FROM roles WHERE role_id = :roleId AND role_name IN ('Doctor', 'Receptionist')");
    $stmt->bindParam(':roleId', $roleId, PDO::PARAM_INT);
    $stmt->execute();
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
    if ($rawMiddleInitial !== '' && !preg_match('/^[A-Za-z]$/', $rawMiddleInitial)) {
        $errors['middle_initial'] = 'Middle initial must be a single letter (A-Z).';
    }
    if ($gender === '') {
        $errors['gender'] = 'Please select a valid gender.';
    }
    if ($username === '') {
        $errors['username'] = 'Username is required.';
    }

    $rawContact = preg_replace('/\s+/', '', $contactNo);
    if ($rawContact !== '' && (strlen($rawContact) !== 11 || strpos($rawContact, '09') !== 0 || !ctype_digit($rawContact))) {
        $errors['contact_no'] = 'Contact number must be exactly 11 digits and start with 09.';
    }

    $passwordRegex = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{6,}$/';
    if ($password !== '' && !preg_match($passwordRegex, $password)) {
        $errors['password'] = 'Password must be at least 6 characters, including uppercase, lowercase, number, and special character.';
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
        $uStmt = $pdo->prepare("SELECT 1 FROM users WHERE username = :username AND user_id != :userId");
        $uStmt->bindParam(':username', $username);
        $uStmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $uStmt->execute();
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
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $upd = $pdo->prepare(
                "UPDATE users SET role_id = :roleId, first_name = :firstName, last_name = :lastName, middle_initial = :middleInitial, gender = :gender, username = :username, password_hash = :hash WHERE user_id = :userId"
            );
            $upd->bindParam(':roleId', $roleId, PDO::PARAM_INT);
            $upd->bindParam(':firstName', $firstName);
            $upd->bindParam(':lastName', $lastName);
            $upd->bindParam(':middleInitial', $middleInitial);
            $upd->bindParam(':gender', $gender);
            $upd->bindParam(':username', $username);
            $upd->bindParam(':hash', $hash);
            $upd->bindParam(':userId', $userId, PDO::PARAM_INT);
            $upd->execute();
        } else {
            $upd = $pdo->prepare(
                "UPDATE users SET role_id = :roleId, first_name = :firstName, last_name = :lastName, middle_initial = :middleInitial, gender = :gender, username = :username WHERE user_id = :userId"
            );
            $upd->bindParam(':roleId', $roleId, PDO::PARAM_INT);
            $upd->bindParam(':firstName', $firstName);
            $upd->bindParam(':lastName', $lastName);
            $upd->bindParam(':middleInitial', $middleInitial);
            $upd->bindParam(':gender', $gender);
            $upd->bindParam(':username', $username);
            $upd->bindParam(':userId', $userId, PDO::PARAM_INT);
            $upd->execute();
        }

        // Manage Doctor profile
        if ($newRole['role_name'] === 'Doctor') {
            if ($existingUser['doctor_id']) {
                $existingDocId = (int)$existingUser['doctor_id'];
                // Update existing doctor profile (identity fields come from users)
                $updDoc = $pdo->prepare(
                    "UPDATE doctors SET contact_no = :contactNo, deleted_at = NULL WHERE doctor_id = :docId"
                );
                $updDoc->bindParam(':contactNo', $contactNo);
                $updDoc->bindParam(':docId', $existingDocId, PDO::PARAM_INT);
                $updDoc->execute();

                // Update specialties
                $delSpec = $pdo->prepare("DELETE FROM doctor_specialty WHERE doctor_id = :docId");
                $delSpec->bindParam(':docId', $existingDocId, PDO::PARAM_INT);
                $delSpec->execute();

                $specIdVar = 0;
                $specIns = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (:docId, :specId)");
                $specIns->bindParam(':docId', $existingDocId, PDO::PARAM_INT);
                $specIns->bindParam(':specId', $specIdVar, PDO::PARAM_INT);
                foreach ($specialtyIds as $specialtyId) {
                    $specIdVar = (int)$specialtyId;
                    $specIns->execute();
                }
            } else {
                // Insert new doctor profile if they changed from Receptionist to Doctor
                $docIns = $pdo->prepare(
                    "INSERT INTO doctors (user_id, contact_no) VALUES (:userId, :contactNo)"
                );
                $docIns->bindParam(':userId', $userId, PDO::PARAM_INT);
                $docIns->bindParam(':contactNo', $contactNo);
                $docIns->execute();
                $newDocId = (int)$pdo->lastInsertId();

                $specIdVar = 0;
                $specIns = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (:docId, :specId)");
                $specIns->bindParam(':docId', $newDocId, PDO::PARAM_INT);
                $specIns->bindParam(':specId', $specIdVar, PDO::PARAM_INT);
                foreach ($specialtyIds as $specialtyId) {
                    $specIdVar = (int)$specialtyId;
                    $specIns->execute();
                }
            }
        } else {
            // Changed from Doctor to Receptionist. Soft-delete the doctor profile to prevent orphaned clinical data access.
            if ($existingUser['doctor_id']) {
                $existingDocId = (int)$existingUser['doctor_id'];
                $delDoc = $pdo->prepare("UPDATE doctors SET deleted_at = NOW() WHERE doctor_id = :docId");
                $delDoc->bindParam(':docId', $existingDocId, PDO::PARAM_INT);
                $delDoc->execute();
            }
        }

        $pdo->commit();
        log_audit($pdo, (int)$_SESSION['user_id'], 'UPDATE_USER', 'user', $userId, null, ['username' => $username, 'role_name' => $newRole['role_name']]);
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
             WHERE u.user_id = :userId AND r.role_name IN ('Doctor', 'Receptionist') AND u.deleted_at IS NULL"
        );
        $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('User not found or already deactivated.', [], 404);
        }
        
        $docStmt = $pdo->prepare("UPDATE doctors SET deleted_at = NOW() WHERE user_id = :userId AND deleted_at IS NULL");
        $docStmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $docStmt->execute();

        $pdo->commit();
        log_audit($pdo, (int)$_SESSION['user_id'], 'ARCHIVE_USER', 'user', $userId);
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
             WHERE u.user_id = :userId AND r.role_name IN ('Doctor', 'Receptionist') AND u.deleted_at IS NOT NULL"
        );
        $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('User not found or already active.', [], 404);
        }

        $docStmt = $pdo->prepare("UPDATE doctors SET deleted_at = NULL WHERE user_id = :userId AND deleted_at IS NOT NULL");
        $docStmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $docStmt->execute();

        $pdo->commit();
        log_audit($pdo, (int)$_SESSION['user_id'], 'RESTORE_USER', 'user', $userId);
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
             WHERE u.user_id = :userId AND r.role_name IN ('Doctor', 'Receptionist')"
        );
        $chk->bindParam(':userId', $userId, PDO::PARAM_INT);
        $chk->execute();
        if (!$chk->fetch()) {
            $pdo->rollBack();
            send_error('User not found.', [], 404);
        }

        // If user is a doctor, clean up doctor relationships first
        $docStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = :userId");
        $docStmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $docStmt->execute();
        $docId = $docStmt->fetchColumn();
        if ($docId) {
            $pdo->prepare("DELETE FROM appointments WHERE doctor_id = ?")->execute([$docId]);
            $pdo->prepare("DELETE FROM consultation_addenda WHERE doctor_id = ?")->execute([$docId]);
            $pdo->prepare("DELETE FROM doctor_schedules WHERE doctor_id = ?")->execute([$docId]);
            $pdo->prepare("DELETE FROM doctor_specialty WHERE doctor_id = ?")->execute([$docId]);
            $pdo->prepare("DELETE FROM record_access_requests WHERE doctor_id = ?")->execute([$docId]);
            $pdo->prepare("DELETE FROM doctors WHERE doctor_id = ?")->execute([$docId]);
        }

        // Clear appointment creator/cancellation references
        $updAppt = $pdo->prepare("UPDATE appointments SET created_by = NULL WHERE created_by = :userId");
        $updAppt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $updAppt->execute();

        $updCancel = $pdo->prepare("UPDATE appointments SET cancel_requested_by = NULL WHERE cancel_requested_by = :userId");
        $updCancel->bindParam(':userId', $userId, PDO::PARAM_INT);
        $updCancel->execute();

        $delUser = $pdo->prepare("DELETE FROM users WHERE user_id = :userId");
        $delUser->bindParam(':userId', $userId, PDO::PARAM_INT);
        $delUser->execute();

        $pdo->commit();
        log_audit($pdo, (int)$_SESSION['user_id'], 'PURGE_USER', 'user', $userId);
        send_success('User permanently deleted.');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        send_error('Failed to permanently delete user: ' . $e->getMessage(), [], 500);
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
