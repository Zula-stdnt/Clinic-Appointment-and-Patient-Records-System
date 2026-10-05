<?php
// api/patient_controller.php
// Master-file CRUD for Patients
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records, mysql_retrieve_specific_record, mysql_insert_records & mysql_update_records (Parameterized PDO CRUD with bindValue)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
verify_csrf_on_state_change();

// Receptionists may search and register patients at the front desk.
// Update, archive, restore, and purge actions remain Administrator-only.
$authRole = get_current_user_role();
if (!in_array($authRole, ['Administrator', 'Receptionist'], true)) {
    send_error('Access forbidden: insufficient role permissions.', [], 403);
}

function require_patient_admin(): void {
    if (get_current_user_role() !== 'Administrator') {
        send_error('Access forbidden: only Administrators may modify or archive patient records.', [], 403);
    }
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            getPatientById($pdo, (int)$_GET['id']);
        } else {
            listPatients($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'soft_delete') {
            require_patient_admin();
            softDeletePatient($pdo);
        } elseif ($action === 'restore') {
            require_patient_admin();
            restorePatient($pdo);
        } elseif ($action === 'hard_delete') {
            require_patient_admin();
            hardDeletePatient($pdo);
        } else {
            createPatient($pdo);
        }
    } elseif ($method === 'PUT') {
        require_patient_admin();
        if ($action === 'soft_delete') {
            softDeletePatient($pdo);
        } elseif ($action === 'restore') {
            restorePatient($pdo);
        } else {
            updatePatient($pdo);
        }
    } elseif ($method === 'DELETE') {
        require_patient_admin();
        hardDeletePatient($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log('Patient controller DB error: ' . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete patient: related appointments or consultations exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
}

function listPatients(PDO $pdo): void {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
    $offset = ($page - 1) * $pageSize;

    $search = trim($_GET['search'] ?? '');
    $status = $_GET['status'] ?? 'active';
    $gender = trim($_GET['gender'] ?? '');

    $where = ['1=1'];
    $params = [];

    if ($status === 'active') {
        $where[] = 'deleted_at IS NULL';
    } elseif ($status === 'deleted') {
        $where[] = 'deleted_at IS NOT NULL';
    }

    if ($gender !== '' && in_array($gender, ['male', 'female', 'other', 'unknown'], true)) {
        $where[] = 'gender = :gender';
        $params[':gender'] = $gender;
    }

    if ($search !== '') {
        $where[] = '(first_name LIKE :search1 OR last_name LIKE :search2 OR contact_no LIKE :search3 OR address LIKE :search4)';
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
        $params[':search4'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['patient_id', 'first_name', 'last_name', 'gender', 'date_of_birth', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'patient_id';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    // Total count
    $countSql = "SELECT COUNT(*) FROM patients WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Data query
    $dataSql = "SELECT patient_id, first_name, middle_initial, last_name, gender, date_of_birth, contact_no, address, created_at, updated_at, deleted_at
                FROM patients
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

    send_success('Patients retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getPatientById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare("SELECT * FROM patients WHERE patient_id = ? LIMIT 1");
    $stmt->execute([$id]);
    $patient = $stmt->fetch();

    if (!$patient) {
        send_error('Patient not found.', [], 404);
    }

    send_success('Patient details retrieved.', ['patient' => $patient]);
}

function validatePatientInput(array $input): array {
    $errors = [];
    $firstName = trim($input['first_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '');
    $lastName  = trim($input['last_name'] ?? '');
    $gender    = trim($input['gender'] ?? 'unknown');
    $dob       = trim($input['date_of_birth'] ?? '');

    if ($firstName === '') {
        $errors['first_name'] = 'First name is required.';
    } elseif (strlen($firstName) > 80) {
        $errors['first_name'] = 'First name cannot exceed 80 characters.';
    }

    if (strlen($middleInitial) > 10) {
        $errors['middle_initial'] = 'Middle initial cannot exceed 10 characters.';
    }

    if ($lastName === '') {
        $errors['last_name'] = 'Last name is required.';
    } elseif (strlen($lastName) > 80) {
        $errors['last_name'] = 'Last name cannot exceed 80 characters.';
    }

    if ($gender === '') {
        $errors['gender'] = 'Gender is required.';
    } elseif (strlen($gender) > 50) {
        $errors['gender'] = 'Gender cannot exceed 50 characters.';
    }

    if ($dob === '') {
        $errors['date_of_birth'] = 'Date of birth is required.';
    } else {
        $d = DateTime::createFromFormat('Y-m-d', $dob);
        if (!$d || $d->format('Y-m-d') !== $dob) {
            $errors['date_of_birth'] = 'Date of birth must be a valid date in YYYY-MM-DD format.';
        } elseif ($d > new DateTime()) {
            $errors['date_of_birth'] = 'Date of birth cannot be in the future.';
        }
    }

    $contactNo = trim($input['contact_no'] ?? '');
    if ($contactNo !== '') {
        if (!ctype_digit($contactNo) || strlen($contactNo) !== 11 || !str_starts_with($contactNo, '09')) {
            $errors['contact_no'] = 'Contact number must be exactly 11 digits and start with 09.';
        }
    }

    return $errors;
}

function createPatient(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = validatePatientInput($input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare(
        "INSERT INTO patients (first_name, middle_initial, last_name, gender, date_of_birth, contact_no, address)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        trim($input['first_name']),
        trim($input['middle_initial'] ?? '') ?: null,
        trim($input['last_name']),
        $input['gender'],
        $input['date_of_birth'],
        trim($input['contact_no'] ?? '') ?: null,
        trim($input['address'] ?? '') ?: null
    ]);

    $newId = (int)$pdo->lastInsertId();
    send_success('Patient record created successfully.', ['patient_id' => $newId], 201);
}

function updatePatient(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));
    $chk = $pdo->prepare("SELECT patient_id FROM patients WHERE patient_id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        send_error('Patient not found.', [], 404);
    }

    $errors = validatePatientInput($input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare(
        "UPDATE patients
         SET first_name = ?, middle_initial = ?, last_name = ?, gender = ?, date_of_birth = ?, contact_no = ?, address = ?
         WHERE patient_id = ?"
    );
    $stmt->execute([
        trim($input['first_name']),
        trim($input['middle_initial'] ?? '') ?: null,
        trim($input['last_name']),
        $input['gender'],
        $input['date_of_birth'],
        trim($input['contact_no'] ?? '') ?: null,
        trim($input['address'] ?? '') ?: null,
        $id
    ]);

    send_success('Patient record updated successfully.');
}

function softDeletePatient(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE patients SET deleted_at = NOW() WHERE patient_id = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Patient not found or already deactivated.', [], 404);
    }

    send_success('Patient deactivated (soft-deleted) successfully.');
}

function restorePatient(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE patients SET deleted_at = NULL WHERE patient_id = ? AND deleted_at IS NOT NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Patient not found or already active.', [], 404);
    }

    send_success('Patient restored successfully.');
}

function hardDeletePatient(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM patients WHERE patient_id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Patient not found.', [], 404);
    }

    send_success('Patient permanently deleted.');
}
