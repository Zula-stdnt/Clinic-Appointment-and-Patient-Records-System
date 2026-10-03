<?php
// api/service_controller.php
// Master-file CRUD for services
// ITE 387 Lessons applied: 04 Database Design/database_normalization & 03 APIs and Database Operations/mysql_retrieve_records (Normalized service lookup entity with prepared PDO CRUD)

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
            getServiceById($pdo, (int)$_GET['id']);
        } else {
            listServices($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'soft_delete') {
            softDeleteService($pdo);
        } elseif ($action === 'restore') {
            restoreService($pdo);
        } elseif ($action === 'hard_delete') {
            hardDeleteService($pdo);
        } else {
            createService($pdo);
        }
    } elseif ($method === 'PUT') {
        if ($action === 'soft_delete') {
            softDeleteService($pdo);
        } elseif ($action === 'restore') {
            restoreService($pdo);
        } else {
            updateService($pdo);
        }
    } elseif ($method === 'DELETE') {
        hardDeleteService($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log('service controller DB error: ' . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete service: related records exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
}

function listServices(PDO $pdo): void {
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
        $where[] = 'service_name LIKE :search';
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['service_id', 'service_name', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'service_id';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    $countSql = "SELECT COUNT(*) FROM services WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    $dataSql = "SELECT service_id, service_name, created_at, updated_at, deleted_at
                FROM services
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

    send_success('services retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getServiceById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare("SELECT service_id, service_name, created_at, updated_at, deleted_at FROM services WHERE service_id = ? LIMIT 1");
    $stmt->execute([$id]);
    $service = $stmt->fetch();

    if (!$service) {
        send_error('service not found.', [], 404);
    }

    send_success('service retrieved successfully.', ['service' => $service]);
}

function validateserviceInput(PDO $pdo, array $input, ?int $ignoreId = null): array {
    $errors = [];
    $name = trim($input['service_name'] ?? '');

    if ($name === '') {
        $errors['service_name'] = 'service name is required.';
    } elseif (strlen($name) > 100) {
        $errors['service_name'] = 'service name cannot exceed 100 characters.';
    } else {
        $sql = "SELECT 1 FROM services WHERE service_name = ?";
        $params = [$name];
        if ($ignoreId !== null) {
            $sql .= " AND service_id != ?";
            $params[] = $ignoreId;
        }
        $chk = $pdo->prepare($sql);
        $chk->execute($params);
        if ($chk->fetch()) {
            $errors['service_name'] = 'A service with this name already exists.';
        }
    }

    return $errors;
}

function createService(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = validateserviceInput($pdo, $input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("INSERT INTO services (service_name) VALUES (?)");
    $stmt->execute([trim($input['service_name'])]);

    $newId = (int)$pdo->lastInsertId();
    send_success('service created successfully.', ['service_id' => $newId], 201);
}

function updateService(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));
    $chk = $pdo->prepare("SELECT service_id FROM services WHERE service_id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        send_error('service not found.', [], 404);
    }

    $errors = validateserviceInput($pdo, $input, $id);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("UPDATE services SET service_name = ? WHERE service_id = ?");
    $stmt->execute([
        trim($input['service_name']),
        $id
    ]);

    send_success('service updated successfully.');
}

function softDeleteService(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE services SET deleted_at = NOW() WHERE service_id = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('service not found or already deactivated.', [], 404);
    }

    send_success('service deactivated (soft-deleted) successfully.');
}

function restoreService(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE services SET deleted_at = NULL WHERE service_id = ? AND deleted_at IS NOT NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('service not found or already active.', [], 404);
    }

    send_success('service restored successfully.');
}

function hardDeleteService(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM services WHERE service_id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('service not found.', [], 404);
    }

    send_success('service permanently deleted.');
}

