<?php
// api/specialty_controller.php
// Master-file CRUD for Specialties
// ITE 387 Lessons applied: 04 Database Design/database_normalization & 03 APIs and Database Operations/mysql_retrieve_records (Normalized specialty lookup entity with prepared PDO CRUD)

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
        if (isset($_GET['id'])) {
            getSpecialtyById($pdo, (int)$_GET['id']);
        } else {
            listSpecialties($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'soft_delete') {
            softDeleteSpecialty($pdo);
        } elseif ($action === 'restore') {
            restoreSpecialty($pdo);
        } elseif ($action === 'hard_delete') {
            hardDeleteSpecialty($pdo);
        } else {
            createSpecialty($pdo);
        }
    } elseif ($method === 'PUT') {
        if ($action === 'soft_delete') {
            softDeleteSpecialty($pdo);
        } elseif ($action === 'restore') {
            restoreSpecialty($pdo);
        } else {
            updateSpecialty($pdo);
        }
    } elseif ($method === 'DELETE') {
        hardDeleteSpecialty($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log('Specialty controller DB error: ' . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete specialty: related doctor assignments exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
}

function listSpecialties(PDO $pdo): void {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
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
        $where[] = 'specialty_name LIKE :search';
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['specialty_id', 'specialty_name', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'specialty_id';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    $countSql = "SELECT COUNT(*) FROM specialties WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    $dataSql = "SELECT specialty_id, specialty_name, created_at, updated_at, deleted_at
                FROM specialties
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

    send_success('Specialties retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getSpecialtyById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare("SELECT * FROM specialties WHERE specialty_id = ? LIMIT 1");
    $stmt->execute([$id]);
    $specialty = $stmt->fetch();

    if (!$specialty) {
        send_error('Specialty not found.', [], 404);
    }

    send_success('Specialty retrieved successfully.', ['specialty' => $specialty]);
}

function validateSpecialtyInput(PDO $pdo, array $input, ?int $ignoreId = null): array {
    $errors = [];
    $name = trim($input['specialty_name'] ?? '');

    if ($name === '') {
        $errors['specialty_name'] = 'Specialty name is required.';
    } elseif (strlen($name) > 100) {
        $errors['specialty_name'] = 'Specialty name cannot exceed 100 characters.';
    } else {
        $sql = "SELECT 1 FROM specialties WHERE specialty_name = ?";
        $params = [$name];
        if ($ignoreId !== null) {
            $sql .= " AND specialty_id != ?";
            $params[] = $ignoreId;
        }
        $chk = $pdo->prepare($sql);
        $chk->execute($params);
        if ($chk->fetch()) {
            $errors['specialty_name'] = 'A specialty with this name already exists.';
        }
    }

    return $errors;
}

function createSpecialty(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = validateSpecialtyInput($pdo, $input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("INSERT INTO specialties (specialty_name) VALUES (?)");
    $stmt->execute([trim($input['specialty_name'])]);

    $newId = (int)$pdo->lastInsertId();
    send_success('Specialty created successfully.', ['specialty_id' => $newId], 201);
}

function updateSpecialty(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['specialty_id'] ?? 0));
    $chk = $pdo->prepare("SELECT specialty_id FROM specialties WHERE specialty_id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        send_error('Specialty not found.', [], 404);
    }

    $errors = validateSpecialtyInput($pdo, $input, $id);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("UPDATE specialties SET specialty_name = ? WHERE specialty_id = ?");
    $stmt->execute([
        trim($input['specialty_name']),
        $id
    ]);

    send_success('Specialty updated successfully.');
}

function softDeleteSpecialty(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['specialty_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE specialties SET deleted_at = NOW() WHERE specialty_id = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Specialty not found or already deactivated.', [], 404);
    }

    send_success('Specialty deactivated (soft-deleted) successfully.');
}

function restoreSpecialty(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['specialty_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE specialties SET deleted_at = NULL WHERE specialty_id = ? AND deleted_at IS NOT NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Specialty not found or already active.', [], 404);
    }

    send_success('Specialty restored successfully.');
}

function hardDeleteSpecialty(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['specialty_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM specialties WHERE specialty_id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Specialty not found.', [], 404);
    }

    send_success('Specialty permanently deleted.');
}

