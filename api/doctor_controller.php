<?php
// api/doctor_controller.php
// Master-file CRUD for Doctors and doctor_specialty junction

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role('Administrator');
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        if (isset($_GET['meta']) && $_GET['meta'] === 'specialties') {
            // Dropdown must list ONLY active specialties (deleted_at IS NULL)
            $stmt = $pdo->query("SELECT specialty_id, specialty_name FROM specialties WHERE deleted_at IS NULL ORDER BY specialty_name ASC");
            send_success('Active specialties retrieved.', ['specialties' => $stmt->fetchAll()]);
        } elseif (isset($_GET['id'])) {
            getDoctorById($pdo, (int)$_GET['id']);
        } else {
            listDoctors($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'soft_delete') {
            softDeleteDoctor($pdo);
        } elseif ($action === 'restore') {
            restoreDoctor($pdo);
        } elseif ($action === 'hard_delete') {
            hardDeleteDoctor($pdo);
        } else {
            createDoctor($pdo);
        }
    } elseif ($method === 'PUT') {
        if ($action === 'soft_delete') {
            softDeleteDoctor($pdo);
        } elseif ($action === 'restore') {
            restoreDoctor($pdo);
        } else {
            updateDoctor($pdo);
        }
    } elseif ($method === 'DELETE') {
        hardDeleteDoctor($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log('Doctor controller DB error: ' . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete doctor: related appointments exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
}

function listDoctors(PDO $pdo): void {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
    $offset = ($page - 1) * $pageSize;

    $search = trim($_GET['search'] ?? '');
    $status = $_GET['status'] ?? 'active';
    $specialtyId = (int)($_GET['specialty_id'] ?? 0);

    $where = ['1=1'];
    $params = [];

    if ($status === 'active') {
        $where[] = 'd.deleted_at IS NULL';
    } elseif ($status === 'deleted') {
        $where[] = 'd.deleted_at IS NOT NULL';
    }

    if ($specialtyId > 0) {
        $where[] = 'ds.specialty_id = :specialty_id';
        $params[':specialty_id'] = $specialtyId;
    }

    if ($search !== '') {
        $where[] = '(u.first_name LIKE :search1 OR u.last_name LIKE :search2 OR d.contact_no LIKE :search3 OR s.specialty_name LIKE :search4)';
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
        $params[':search4'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['doctor_id', 'first_name', 'last_name', 'specialty_name', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'doctor_id';
    if ($sortBy === 'specialty_name') {
        $sortBy = 's.specialty_name';
    } elseif ($sortBy === 'first_name') {
        $sortBy = 'u.first_name';
    } elseif ($sortBy === 'last_name') {
        $sortBy = 'u.last_name';
    } else {
        $sortBy = 'd.' . $sortBy;
    }
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    // Count query
    $countSql = "SELECT COUNT(DISTINCT d.doctor_id)
                 FROM doctors d
                 LEFT JOIN users u ON d.user_id = u.user_id
                 LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
                 LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
                 WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Data query with GROUP_CONCAT for specialties if doctor has multiple.
    // Personal identity fields live on users; doctors only stores profile data.
    $dataSql = "SELECT d.doctor_id, u.first_name, u.last_name, u.middle_initial, u.gender, d.contact_no, d.created_at, d.updated_at, d.deleted_at,
                       u.username, u.user_id,
                       GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS specialty_names,
                       GROUP_CONCAT(DISTINCT s.specialty_id SEPARATOR ',') AS specialty_ids
                FROM doctors d
                LEFT JOIN users u ON d.user_id = u.user_id
                LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
                LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
                WHERE {$whereSql}
                GROUP BY d.doctor_id, u.first_name, u.last_name, u.middle_initial, u.gender, u.username, u.user_id
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

    send_success('Doctors retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getDoctorById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare(
        "SELECT d.doctor_id, u.first_name, u.last_name, u.middle_initial, u.gender, d.contact_no, d.created_at, d.updated_at, d.deleted_at,
                u.username, u.user_id,
                GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS specialty_names,
                GROUP_CONCAT(DISTINCT s.specialty_id SEPARATOR ',') AS specialty_ids
         FROM doctors d
         LEFT JOIN users u ON d.user_id = u.user_id
         LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
         LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
         WHERE d.doctor_id = ?
         GROUP BY d.doctor_id, u.first_name, u.last_name, u.middle_initial, u.gender, u.username, u.user_id
         LIMIT 1"
    );
    $stmt->execute([$id]);
    $doctor = $stmt->fetch();

    if (!$doctor) {
        send_error('Doctor not found.', [], 404);
    }

    send_success('Doctor details retrieved.', ['doctor' => $doctor]);
}

function validateDoctorInput(PDO $pdo, array $input): array {
    $errors = [];
    $firstName   = trim($input['first_name'] ?? '');
    $lastName    = trim($input['last_name'] ?? '');
    $specialtyIds = normalize_specialty_ids($input);

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

    if (empty($specialtyIds)) {
        $errors['specialty_id'] = 'Please select at least one valid specialty.';
    } elseif (!active_specialty_ids_exist($pdo, $specialtyIds)) {
        $errors['specialty_id'] = 'One or more selected specialties are inactive or do not exist.';
    }

    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $userId = (int)($input['user_id'] ?? 0); // Used for updates

    if ($username === '') {
        $errors['username'] = 'Username is required.';
    } else {
        $uStmt = $pdo->prepare("SELECT 1 FROM users WHERE username = ? AND user_id != ?");
        $uStmt->execute([$username, $userId]);
        if ($uStmt->fetch()) {
            $errors['username'] = 'This username is already taken by another account.';
        }
    }

    $gender = trim($input['gender'] ?? '');
    if ($gender === '') {
        $errors['gender'] = 'Gender is required.';
    } elseif (strlen($gender) > 50) {
        $errors['gender'] = 'Gender cannot exceed 50 characters.';
    }

    $contactNo = trim($input['contact_no'] ?? '');
    if ($contactNo !== '') {
        if (!ctype_digit($contactNo) || strlen($contactNo) !== 11 || !str_starts_with($contactNo, '09')) {
            $errors['contact_no'] = 'Contact number must be exactly 11 digits and start with 09.';
        }
    }

    $passwordRegex = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/';
    if ($userId === 0 && $password === '') {
        $errors['password'] = 'Password is required.';
    } elseif ($password !== '' && !preg_match($passwordRegex, $password)) {
        $errors['password'] = 'Password must be at least 6 characters, and include uppercase, lowercase, number, and special character.';
    }

    return $errors;
}

function createDoctor(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = validateDoctorInput($pdo, $input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $pdo->beginTransaction();
    try {
        // 1. Create User account first
        $roleStmt = $pdo->query("SELECT role_id FROM roles WHERE role_name = 'Doctor' LIMIT 1");
        $roleId = (int)$roleStmt->fetchColumn();

        $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
        $gender = $input['gender'] ?? 'Other';
        $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
        
        $uStmt = $pdo->prepare("INSERT INTO users (role_id, first_name, last_name, middle_initial, gender, username, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $uStmt->execute([$roleId, trim($input['first_name']), trim($input['last_name']), $middleInitial, $gender, trim($input['username']), $passwordHash]);
        $newUserId = (int)$pdo->lastInsertId();

        // 2. Create Doctor profile linked to the User.
        //    Names/gender already live on the users row; only profile data goes here.
        $stmt = $pdo->prepare("INSERT INTO doctors (user_id, contact_no) VALUES (?, ?)");
        $stmt->execute([
            $newUserId,
            trim($input['contact_no'] ?? '') ?: null
        ]);
        $newDoctorId = (int)$pdo->lastInsertId();

        // 3. Link specialties
        $dsStmt = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (?, ?)");
        foreach (normalize_specialty_ids($input) as $specialtyId) {
            $dsStmt->execute([$newDoctorId, $specialtyId]);
        }

        $pdo->commit();
        send_success('Doctor record created successfully.', ['doctor_id' => $newDoctorId], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function updateDoctor(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['doctor_id'] ?? 0));
    $chk = $pdo->prepare("SELECT doctor_id, user_id FROM doctors WHERE doctor_id = ?");
    $chk->execute([$id]);
    $doc = $chk->fetch();
    if (!$doc) {
        send_error('Doctor not found.', [], 404);
    }
    
    // Inject user_id for validation
    $input['user_id'] = $doc['user_id'];

    $errors = validateDoctorInput($pdo, $input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $pdo->beginTransaction();
    try {
        $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
        $gender = $input['gender'] ?? 'Other';

        // Only doctor-specific profile data lives on the doctors row.
        $stmt = $pdo->prepare("UPDATE doctors SET contact_no = ? WHERE doctor_id = ?");
        $stmt->execute([
            trim($input['contact_no'] ?? '') ?: null,
            $id
        ]);

        // Personal identity fields live on the linked user account.
        if (!empty($input['password'])) {
            $hash = password_hash($input['password'], PASSWORD_DEFAULT);
            $uUpd = $pdo->prepare("UPDATE users SET first_name = ?, last_name = ?, middle_initial = ?, gender = ?, username = ?, password_hash = ? WHERE user_id = ?");
            $uUpd->execute([trim($input['first_name']), trim($input['last_name']), $middleInitial, $gender, trim($input['username']), $hash, $doc['user_id']]);
        } else {
            $uUpd = $pdo->prepare("UPDATE users SET first_name = ?, last_name = ?, middle_initial = ?, gender = ?, username = ? WHERE user_id = ?");
            $uUpd->execute([trim($input['first_name']), trim($input['last_name']), $middleInitial, $gender, trim($input['username']), $doc['user_id']]);
        }

        // Update junction table
        $delDs = $pdo->prepare("DELETE FROM doctor_specialty WHERE doctor_id = ?");
        $delDs->execute([$id]);

        $insDs = $pdo->prepare("INSERT INTO doctor_specialty (doctor_id, specialty_id) VALUES (?, ?)");
        foreach (normalize_specialty_ids($input) as $specialtyId) {
            $insDs->execute([$id, $specialtyId]);
        }

        $pdo->commit();
        send_success('Doctor record updated successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function softDeleteDoctor(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['doctor_id'] ?? 0));

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE doctors SET deleted_at = NOW() WHERE doctor_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('Doctor not found or already deactivated.', [], 404);
        }

        $stmt2 = $pdo->prepare("UPDATE users SET deleted_at = NOW() WHERE user_id = (SELECT user_id FROM doctors WHERE doctor_id = ?) AND deleted_at IS NULL");
        $stmt2->execute([$id]);

        $pdo->commit();
        send_success('Doctor and user account deactivated (soft-deleted) successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function restoreDoctor(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['doctor_id'] ?? 0));

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE doctors SET deleted_at = NULL WHERE doctor_id = ? AND deleted_at IS NOT NULL");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('Doctor not found or already active.', [], 404);
        }

        $stmt2 = $pdo->prepare("UPDATE users SET deleted_at = NULL WHERE user_id = (SELECT user_id FROM doctors WHERE doctor_id = ?) AND deleted_at IS NOT NULL");
        $stmt2->execute([$id]);

        $pdo->commit();
        send_success('Doctor and user account restored successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function hardDeleteDoctor(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['doctor_id'] ?? 0));

    $chk = $pdo->prepare("SELECT user_id FROM doctors WHERE doctor_id = ?");
    $chk->execute([$id]);
    $userId = $chk->fetchColumn();

    $pdo->beginTransaction();
    try {
        // Hard delete doctor
        $stmt = $pdo->prepare("DELETE FROM doctors WHERE doctor_id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            send_error('Doctor not found.', [], 404);
        }

        if ($userId) {
            $stmt2 = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
            $stmt2->execute([$userId]);
        }

        $pdo->commit();
        send_success('Doctor and user account permanently deleted.');
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
