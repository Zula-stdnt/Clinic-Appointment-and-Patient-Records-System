<?php
// api/medication_controller.php
// Master CRUD for Medications.
// Read (GET) is available to Administrators and Doctors (prescription picker);
// create/update/archive/restore/hard-delete are Administrator-only.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records,
// mysql_insert_records & mysql_update_records (Prepared PDO CRUD for medication master records)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        require_role(['Administrator', 'Doctor']);
        if (isset($_GET['id'])) {
            getMedicationById($pdo, (int)$_GET['id']);
        } else {
            listMedications($pdo);
        }
    } elseif ($method === 'POST') {
        require_role('Administrator');
        if ($action === 'soft_delete') {
            softDeleteMedication($pdo);
        } elseif ($action === 'restore') {
            restoreMedication($pdo);
        } elseif ($action === 'hard_delete') {
            hardDeleteMedication($pdo);
        } else {
            createMedication($pdo);
        }
    } elseif ($method === 'PUT') {
        require_role('Administrator');
        if ($action === 'soft_delete') {
            softDeleteMedication($pdo);
        } elseif ($action === 'restore') {
            restoreMedication($pdo);
        } else {
            updateMedication($pdo);
        }
    } elseif ($method === 'DELETE') {
        require_role('Administrator');
        hardDeleteMedication($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in medication_controller.php: " . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete medication: related prescription records exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in medication_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function listMedications(PDO $pdo): void {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 50)));
    $offset = ($page - 1) * $pageSize;

    $search = trim($_GET['search'] ?? '');
    $status = $_GET['status'] ?? 'active';

    $where = ['1=1'];
    $params = [];

    if ($status === 'active') {
        $where[] = 'deleted_at IS NULL';
    } elseif ($status === 'deleted') {
        $where[] = 'deleted_at IS NOT NULL';
    }

    if ($search !== '') {
        $where[] = '(name LIKE :s1 OR generic_name LIKE :s2 OR manufacturer LIKE :s3)';
        $params[':s1'] = '%' . $search . '%';
        $params[':s2'] = '%' . $search . '%';
        $params[':s3'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['medication_id', 'name', 'generic_name', 'manufacturer', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'name';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM medications WHERE {$whereSql}");
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    $sql = "SELECT medication_id, name, generic_name, manufacturer, created_at, updated_at, deleted_at
            FROM medications
            WHERE {$whereSql}
            ORDER BY {$sortBy} {$sortOrder}
            LIMIT :limit OFFSET :offset";
    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Medications retrieved', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getMedicationById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare("SELECT medication_id, name, generic_name, manufacturer, created_at, updated_at, deleted_at
                           FROM medications WHERE medication_id = ? AND deleted_at IS NULL LIMIT 1");
    $stmt->execute([$id]);
    $med = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$med) {
        send_error('Medication not found.', [], 404);
    }

    send_success('Medication retrieved', ['medication' => $med]);
}

function validateMedicationInput(PDO $pdo, array $input, ?int $ignoreId = null): array {
    $errors = [];
    $name = trim($input['name'] ?? '');
    $generic = trim($input['generic_name'] ?? '');
    $manufacturer = trim($input['manufacturer'] ?? '');

    if ($name === '') {
        $errors['name'] = 'Medication name is required.';
    } elseif (strlen($name) > 150) {
        $errors['name'] = 'Medication name cannot exceed 150 characters.';
    } else {
        $sql = "SELECT 1 FROM medications WHERE name = ?";
        $params = [$name];
        if ($ignoreId !== null) {
            $sql .= " AND medication_id != ?";
            $params[] = $ignoreId;
        }
        $chk = $pdo->prepare($sql);
        $chk->execute($params);
        if ($chk->fetch()) {
            $errors['name'] = 'A medication with this name already exists.';
        }
    }

    if (strlen($generic) > 150) {
        $errors['generic_name'] = 'Generic name cannot exceed 150 characters.';
    }
    if (strlen($manufacturer) > 150) {
        $errors['manufacturer'] = 'Manufacturer cannot exceed 150 characters.';
    }

    return $errors;
}

function createMedication(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = validateMedicationInput($pdo, $input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("INSERT INTO medications (name, generic_name, manufacturer) VALUES (?, ?, ?)");
    $stmt->execute([
        trim($input['name']),
        trim($input['generic_name'] ?? '') ?: null,
        trim($input['manufacturer'] ?? '') ?: null
    ]);

    send_success('Medication created successfully.', ['medication_id' => (int)$pdo->lastInsertId()], 201);
}

function updateMedication(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['medication_id'] ?? 0));
    $chk = $pdo->prepare("SELECT medication_id FROM medications WHERE medication_id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        send_error('Medication not found.', [], 404);
    }

    $errors = validateMedicationInput($pdo, $input, $id);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("UPDATE medications SET name = ?, generic_name = ?, manufacturer = ? WHERE medication_id = ?");
    $stmt->execute([
        trim($input['name']),
        trim($input['generic_name'] ?? '') ?: null,
        trim($input['manufacturer'] ?? '') ?: null,
        $id
    ]);

    send_success('Medication updated successfully.');
}

function softDeleteMedication(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['medication_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE medications SET deleted_at = NOW() WHERE medication_id = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Medication not found or already archived.', [], 404);
    }

    send_success('Medication archived (soft-deleted) successfully.');
}

function restoreMedication(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['medication_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE medications SET deleted_at = NULL WHERE medication_id = ? AND deleted_at IS NOT NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Medication not found or already active.', [], 404);
    }

    send_success('Medication restored successfully.');
}

function hardDeleteMedication(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['medication_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM medications WHERE medication_id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Medication not found.', [], 404);
    }

    send_success('Medication permanently deleted.');
}
