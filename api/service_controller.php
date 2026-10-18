<?php
// api/service_controller.php
// Master-file CRUD for services
// ITE 387 Lessons applied: 04 Database Design/database_normalization & 03 APIs and Database Operations/mysql_retrieve_records (Normalized service lookup entity with prepared PDO bindParam CRUD and switch($operation))

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role('Administrator');
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_REQUEST['operation'] ?? $_GET['action'] ?? null;

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    send_error('Method not allowed.', [], 405);
}

if ($method === 'GET') {
    $operation = $action ?: (isset($_GET['id']) ? 'getService' : 'getAllServices');
} elseif ($method === 'POST') {
    $operation = $action ?: 'createService';
} elseif ($method === 'PUT') {
    $operation = $action ?: 'updateService';
} else {
    $operation = 'hardDeleteService';
}

try {
    switch ($operation) {
        case 'getAllServices':
        case 'list':
            listServices($pdo);
            break;
        case 'getService':
        case 'get':
            getServiceById($pdo, (int)($_GET['id'] ?? 0));
            break;
        case 'createService':
        case 'create':
            createService($pdo);
            break;
        case 'updateService':
        case 'update':
            updateService($pdo);
            break;
        case 'soft_delete':
        case 'softDeleteService':
        case 'archiveService':
            softDeleteService($pdo);
            break;
        case 'restore':
        case 'restoreService':
            restoreService($pdo);
            break;
        case 'hard_delete':
        case 'hardDeleteService':
        case 'deleteService':
            hardDeleteService($pdo);
            break;
        default:
            send_error('Invalid operation.', [], 400);
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
    foreach ($params as $k => &$v) {
        $countStmt->bindParam($k, $v);
    }
    unset($v);
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    $dataSql = "SELECT service_id, service_name, created_at, updated_at, deleted_at
                FROM services
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

    send_success('services retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getServiceById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare("SELECT service_id, service_name, created_at, updated_at, deleted_at FROM services WHERE service_id = :id LIMIT 1");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
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
        $sql = "SELECT 1 FROM services WHERE service_name = :name";
        if ($ignoreId !== null) {
            $sql .= " AND service_id != :ignoreId";
        }
        $chk = $pdo->prepare($sql);
        $chk->bindParam(':name', $name);
        if ($ignoreId !== null) {
            $chk->bindParam(':ignoreId', $ignoreId, PDO::PARAM_INT);
        }
        $chk->execute();
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

    $serviceName = trim($input['service_name']);
    $stmt = $pdo->prepare("INSERT INTO services (service_name) VALUES (:serviceName)");
    $stmt->bindParam(':serviceName', $serviceName);
    $stmt->execute();

    $newId = (int)$pdo->lastInsertId();
    send_success('service created successfully.', ['service_id' => $newId], 201);
}

function updateService(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));
    $chk = $pdo->prepare("SELECT service_id FROM services WHERE service_id = :id");
    $chk->bindParam(':id', $id, PDO::PARAM_INT);
    $chk->execute();
    if (!$chk->fetch()) {
        send_error('service not found.', [], 404);
    }

    $errors = validateserviceInput($pdo, $input, $id);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $serviceName = trim($input['service_name']);
    $stmt = $pdo->prepare("UPDATE services SET service_name = :serviceName WHERE service_id = :id");
    $stmt->bindParam(':serviceName', $serviceName);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    send_success('service updated successfully.');
}

function softDeleteService(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE services SET deleted_at = NOW() WHERE service_id = :id AND deleted_at IS NULL");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        send_error('service not found or already deactivated.', [], 404);
    }

    send_success('service deactivated (soft-deleted) successfully.');
}

function restoreService(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE services SET deleted_at = NULL WHERE service_id = :id AND deleted_at IS NOT NULL");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        send_error('service not found or already active.', [], 404);
    }

    send_success('service restored successfully.');
}

function hardDeleteService(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['service_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM services WHERE service_id = :id");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        send_error('service not found.', [], 404);
    }

    send_success('service permanently deleted.');
}

