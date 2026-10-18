<?php
// api/patient_controller.php
// Master-file CRUD for Patients with strict role separation and audit logging
// - Receptionists manage patient registration and demographic identity updates
// - Administrators have zero edit access (read-only demographic directory + status/archive actions)
// - Old-to-new demographic diffs are indelibly recorded in the audit log
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records, mysql_retrieve_specific_record, mysql_insert_records & mysql_update_records (Parameterized PDO CRUD with bindParam and switch($operation))

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';
require_once __DIR__ . '/../includes/patient_validation.php';

require_login();
verify_csrf_on_state_change();

$authRole = get_current_user_role();
if (!in_array($authRole, ['Administrator', 'Receptionist', 'Doctor'], true)) {
    send_error('Access forbidden: insufficient role permissions.', [], 403);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_REQUEST['operation'] ?? $_GET['action'] ?? null;

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    send_error('Method not allowed.', [], 405);
}

if ($method === 'GET') {
    $operation = $action ?: (isset($_GET['id']) ? 'getPatient' : 'getAllPatients');
} elseif ($method === 'POST') {
    $operation = $action ?: 'createPatient';
} elseif ($method === 'PUT') {
    $operation = $action ?: 'updatePatient';
} else {
    $operation = 'hardDeletePatient';
}

try {
    switch ($operation) {
        case 'getAllPatients':
        case 'list':
            listPatients($pdo);
            break;
        case 'getPatient':
        case 'get':
            getPatientById($pdo, (int)($_GET['id'] ?? 0));
            break;
        case 'createPatient':
        case 'create':
            // Patient registration: Front-desk Receptionists only
            if ($authRole === 'Administrator') {
                send_error('Administrators cannot register patients. Patient registration is managed by Receptionists.', [], 403);
            }
            require_role('Receptionist');
            createPatient($pdo);
            break;
        case 'updatePatient':
        case 'update':
            // Demographic editing: Front-desk Receptionists only
            if ($authRole === 'Administrator') {
                send_error('Administrators cannot modify patient demographics. Front-desk Receptionists manage patient identity corrections.', [], 403);
            }
            require_role('Receptionist');
            updatePatient($pdo);
            break;
        case 'soft_delete':
        case 'softDeletePatient':
        case 'archivePatient':
            require_role('Administrator');
            softDeletePatient($pdo);
            break;
        case 'restore':
        case 'restorePatient':
            require_role('Administrator');
            restorePatient($pdo);
            break;
        case 'hard_delete':
        case 'hardDeletePatient':
        case 'deletePatient':
            require_role('Administrator');
            hardDeletePatient($pdo);
            break;
        default:
            send_error('Invalid operation.', [], 400);
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

    $genderLower = strtolower($gender);
    if ($genderLower === 'male' || $genderLower === 'female' || $genderLower === 'unknown') {
        $where[] = 'LOWER(TRIM(gender)) = :gender';
        $params[':gender'] = $genderLower;
    } elseif ($genderLower === 'other') {
        $where[] = "(LOWER(TRIM(COALESCE(gender, ''))) NOT IN ('male', 'female', 'unknown') AND LOWER(TRIM(COALESCE(gender, ''))) != '')";
    }

    if ($search !== '') {
        $where[] = '(first_name LIKE :search1 OR last_name LIKE :search2 OR contact_no LIKE :search3 OR address LIKE :search4)';
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
        $params[':search4'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['patient_id', 'first_name', 'last_name', 'gender', 'date_of_birth', 'contact_no', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'patient_id';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    // Total count
    $countSql = "SELECT COUNT(*) FROM patients WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => &$v) {
        $countStmt->bindParam($k, $v);
    }
    unset($v);
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    // Data query: returns demographics and allergy alerts only
    $dataSql = "SELECT patient_id, first_name, middle_initial, last_name, gender, date_of_birth,
                       contact_no, address, allergies_alerts, allergies_confirmed_by_doctor,
                       created_at, updated_at, deleted_at
                FROM patients
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
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Patients retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getPatientById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare(
        "SELECT patient_id, first_name, middle_initial, last_name, gender, date_of_birth,
                contact_no, address, allergies_alerts, allergies_confirmed_by_doctor,
                created_at, updated_at, deleted_at
         FROM patients WHERE patient_id = :id LIMIT 1"
    );
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        send_error('Patient not found.', [], 404);
    }

    $patient['allergies_list'] = getPatientAllergies($pdo, $id);

    send_success('Patient details retrieved.', array_merge($patient, ['patient' => $patient]));
}

function createPatient(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    // Whitelist allowed fields
    $firstName     = trim($input['first_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
    $lastName      = trim($input['last_name'] ?? '');
    $gender        = trim($input['gender'] ?? 'unknown');
    $dob           = trim($input['date_of_birth'] ?? '');
    $contactNo     = trim($input['contact_no'] ?? '') ?: null;
    $address       = trim($input['address'] ?? '') ?: null;
    $allergies     = trim($input['allergies_alerts'] ?? '') ?: null;

    $cleanInput = [
        'first_name'     => $firstName,
        'middle_initial' => $middleInitial,
        'last_name'      => $lastName,
        'gender'         => $gender,
        'date_of_birth'  => $dob,
        'contact_no'     => $contactNo,
        'address'        => $address,
        'allergies_alerts' => $allergies
    ];

    $errors = validatePatientInput($cleanInput);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    // Duplicate Check: Check if active patient with same name + DOB or phone number exists
    $dupSql = "SELECT patient_id, first_name, last_name, date_of_birth, contact_no
               FROM patients
               WHERE deleted_at IS NULL
                 AND ((first_name = :firstName AND last_name = :lastName AND date_of_birth = :dob)
                      OR (contact_no = :contactNo AND contact_no IS NOT NULL AND contact_no != ''))
               LIMIT 1";
    $dupStmt = $pdo->prepare($dupSql);
    $dupStmt->bindParam(':firstName', $firstName);
    $dupStmt->bindParam(':lastName', $lastName);
    $dupStmt->bindParam(':dob', $dob);
    $dupStmt->bindParam(':contactNo', $contactNo);
    $dupStmt->execute();
    $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        $patCode = 'PAT-' . str_pad((string)$existing['patient_id'], 4, '0', STR_PAD_LEFT);
        send_error(
            "A patient record for '{$existing['first_name']} {$existing['last_name']}' already exists ({$patCode}). Please verify existing charts before creating a duplicate.",
            ['duplicate' => $existing],
            409
        );
    }

    $stmt = $pdo->prepare(
        "INSERT INTO patients (first_name, middle_initial, last_name, gender, date_of_birth, contact_no, address, allergies_alerts)
         VALUES (:firstName, :middleInitial, :lastName, :gender, :dob, :contactNo, :address, :allergies)"
    );
    $stmt->bindParam(':firstName', $firstName);
    $stmt->bindParam(':middleInitial', $middleInitial);
    $stmt->bindParam(':lastName', $lastName);
    $stmt->bindParam(':gender', $gender);
    $stmt->bindParam(':dob', $dob);
    $stmt->bindParam(':contactNo', $contactNo);
    $stmt->bindParam(':address', $address);
    $stmt->bindParam(':allergies', $allergies);
    $stmt->execute();

    $newId = (int)$pdo->lastInsertId();
    syncPatientAllergies($pdo, $newId, $allergies);
    log_audit($pdo, (int)$_SESSION['user_id'], 'REGISTER_PATIENT', 'patient', $newId, null, $cleanInput);

    send_success('Patient record created successfully.', ['patient_id' => $newId], 201);
}

function updatePatient(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));
    $chk = $pdo->prepare("SELECT * FROM patients WHERE patient_id = :id");
    $chk->bindParam(':id', $id, PDO::PARAM_INT);
    $chk->execute();
    $oldPatient = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$oldPatient) {
        send_error('Patient not found.', [], 404);
    }

    // Whitelist input fields
    $firstName     = trim($input['first_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '') ?: null;
    $lastName      = trim($input['last_name'] ?? '');
    $gender        = trim($input['gender'] ?? 'unknown');
    $dob           = trim($input['date_of_birth'] ?? '');
    $contactNo     = trim($input['contact_no'] ?? '') ?: null;
    $address       = trim($input['address'] ?? '') ?: null;
    $allergies     = isset($input['allergies_alerts']) ? (trim((string)$input['allergies_alerts']) ?: null) : $oldPatient['allergies_alerts'];

    $cleanInput = [
        'first_name'     => $firstName,
        'middle_initial' => $middleInitial,
        'last_name'      => $lastName,
        'gender'         => $gender,
        'date_of_birth'  => $dob,
        'contact_no'     => $contactNo,
        'address'        => $address,
        'allergies_alerts' => $allergies
    ];

    $errors = validatePatientInput($cleanInput);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    // Priority 4: Prevent duplicate registration by matching name+DOB or phone against other active patients
    $contactNoCheck = $contactNo ?? '';
    $dupStmt = $pdo->prepare(
        "SELECT patient_id, first_name, last_name, date_of_birth, contact_no
         FROM patients
         WHERE ((LOWER(TRIM(first_name)) = LOWER(:firstName) AND LOWER(TRIM(last_name)) = LOWER(:lastName) AND date_of_birth = :dob)
            OR (:contactCheck1 != '' AND contact_no = :contactCheck2))
           AND patient_id != :id
           AND deleted_at IS NULL
         LIMIT 1"
    );
    $dupStmt->bindParam(':firstName', $firstName);
    $dupStmt->bindParam(':lastName', $lastName);
    $dupStmt->bindParam(':dob', $dob);
    $dupStmt->bindParam(':contactCheck1', $contactNoCheck);
    $dupStmt->bindParam(':contactCheck2', $contactNoCheck);
    $dupStmt->bindParam(':id', $id, PDO::PARAM_INT);
    $dupStmt->execute();
    $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        $formattedId = 'PAT-' . str_pad((string)$existing['patient_id'], 4, '0', STR_PAD_LEFT);
        send_error(
            "Another patient record for '{$existing['first_name']} {$existing['last_name']}' already exists ({$formattedId}). Please verify existing charts before creating a duplicate.",
            ['duplicate' => $existing],
            409
        );
    }

    // Determine field diffs for old -> new audit log
    $trackedKeys = ['first_name', 'middle_initial', 'last_name', 'gender', 'date_of_birth', 'contact_no', 'address', 'allergies_alerts'];
    $oldDiff = [];
    $newDiff = [];

    foreach ($trackedKeys as $k) {
        $oldVal = $oldPatient[$k] ?? null;
        $newVal = $cleanInput[$k] ?? null;
        if ((string)$oldVal !== (string)$newVal) {
            $oldDiff[$k] = $oldVal;
            $newDiff[$k] = $newVal;
        }
    }

    $stmt = $pdo->prepare(
        "UPDATE patients
         SET first_name = :firstName, middle_initial = :middleInitial, last_name = :lastName, gender = :gender, date_of_birth = :dob, contact_no = :contactNo, address = :address, allergies_alerts = :allergies
         WHERE patient_id = :id"
    );
    $stmt->bindParam(':firstName', $firstName);
    $stmt->bindParam(':middleInitial', $middleInitial);
    $stmt->bindParam(':lastName', $lastName);
    $stmt->bindParam(':gender', $gender);
    $stmt->bindParam(':dob', $dob);
    $stmt->bindParam(':contactNo', $contactNo);
    $stmt->bindParam(':address', $address);
    $stmt->bindParam(':allergies', $allergies);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    syncPatientAllergies($pdo, $id, $allergies);

    if (!empty($newDiff)) {
        $reason = trim($input['reason'] ?? '') ?: 'Demographic identity update by front desk';
        log_audit($pdo, (int)$_SESSION['user_id'], 'EDIT_DEMOGRAPHICS', 'patient', $id, $oldDiff, $newDiff, $reason);
    }

    send_success('Patient record updated successfully.');
}

function softDeletePatient(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));

    // Priority 5: Archival business rule guards
    // 1. Check upcoming active appointments
    $upStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM appointments 
         WHERE patient_id = :id AND status IN ('scheduled', 'confirmed') AND appointment_date >= CURRENT_DATE"
    );
    $upStmt->bindParam(':id', $id, PDO::PARAM_INT);
    $upStmt->execute();
    if ((int)$upStmt->fetchColumn() > 0) {
        send_error('Cannot archive patient: active upcoming appointments are scheduled. Cancel or complete them first.', [], 409);
    }

    // 2. Check completed medical encounters
    $compStmt = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE patient_id = :id AND status = 'completed'");
    $compStmt->bindParam(':id', $id, PDO::PARAM_INT);
    $compStmt->execute();
    if ((int)$compStmt->fetchColumn() > 0) {
        send_error('Cannot archive patient: completed medical consultations exist. Inactive status should be used instead of archiving clinical history.', [], 409);
    }

    $stmt = $pdo->prepare("UPDATE patients SET deleted_at = NOW() WHERE patient_id = :id AND deleted_at IS NULL");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        send_error('Patient not found or already deactivated.', [], 404);
    }

    log_audit($pdo, (int)$_SESSION['user_id'], 'ARCHIVE', 'patient', $id);
    send_success('Patient deactivated (soft-deleted) successfully.');
}

function restorePatient(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE patients SET deleted_at = NULL WHERE patient_id = :id AND deleted_at IS NOT NULL");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        send_error('Patient not found or already active.', [], 404);
    }

    log_audit($pdo, (int)$_SESSION['user_id'], 'RESTORE', 'patient', $id);
    send_success('Patient restored successfully.');
}

function hardDeletePatient(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['patient_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM patients WHERE patient_id = :id");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        send_error('Patient not found.', [], 404);
    }

    log_audit($pdo, (int)$_SESSION['user_id'], 'PURGE', 'patient', $id);
    send_success('Patient permanently deleted.');
}

