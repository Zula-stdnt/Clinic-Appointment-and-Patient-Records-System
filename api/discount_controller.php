<?php
// api/discount_controller.php
// Master-file CRUD for Discounts

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
            getDiscountById($pdo, (int)$_GET['id']);
        } else {
            listDiscounts($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'soft_delete') {
            softDeleteDiscount($pdo);
        } elseif ($action === 'restore') {
            restoreDiscount($pdo);
        } elseif ($action === 'hard_delete') {
            hardDeleteDiscount($pdo);
        } else {
            createDiscount($pdo);
        }
    } elseif ($method === 'PUT') {
        if ($action === 'soft_delete') {
            softDeleteDiscount($pdo);
        } elseif ($action === 'restore') {
            restoreDiscount($pdo);
        } else {
            updateDiscount($pdo);
        }
    } elseif ($method === 'DELETE') {
        hardDeleteDiscount($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log('Discount controller DB error: ' . $e->getMessage());
    if ($e->getCode() == 23000 || (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1451)) {
        send_error('Cannot delete discount: related billing records exist. Use Soft Delete instead.', [], 409);
    }
    send_error('A database error occurred. Please try again.', [], 500);
}

function listDiscounts(PDO $pdo): void {
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
        $where[] = 'discount_name LIKE :search';
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    $allowedSort = ['discount_id', 'discount_name', 'percentage', 'created_at', 'deleted_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort, true) ? $_GET['sort_by'] : 'discount_id';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    $countSql = "SELECT COUNT(*) FROM discounts WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $k => $v) {
        $countStmt->bindValue($k, $v);
    }
    $countStmt->execute();
    $total = (int)$countStmt->fetchColumn();

    $dataSql = "SELECT discount_id, discount_name, percentage, created_at, updated_at, deleted_at
                FROM discounts
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

    send_success('Discounts retrieved successfully.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function getDiscountById(PDO $pdo, int $id): void {
    $stmt = $pdo->prepare("SELECT * FROM discounts WHERE discount_id = ? LIMIT 1");
    $stmt->execute([$id]);
    $discount = $stmt->fetch();

    if (!$discount) {
        send_error('Discount not found.', [], 404);
    }

    send_success('Discount retrieved successfully.', ['discount' => $discount]);
}

function validateDiscountInput(PDO $pdo, array $input, ?int $ignoreId = null): array {
    $errors = [];
    $name = trim($input['discount_name'] ?? '');
    $percentage = $input['percentage'] ?? null;

    if ($name === '') {
        $errors['discount_name'] = 'Discount name is required.';
    } elseif (strlen($name) > 100) {
        $errors['discount_name'] = 'Discount name cannot exceed 100 characters.';
    } else {
        $sql = "SELECT 1 FROM discounts WHERE discount_name = ?";
        $params = [$name];
        if ($ignoreId !== null) {
            $sql .= " AND discount_id != ?";
            $params[] = $ignoreId;
        }
        $chk = $pdo->prepare($sql);
        $chk->execute($params);
        if ($chk->fetch()) {
            $errors['discount_name'] = 'A discount with this name already exists.';
        }
    }

    if ($percentage === null || $percentage === '' || !is_numeric($percentage)) {
        $errors['percentage'] = 'Percentage must be a valid number.';
    } else {
        $pct = (float)$percentage;
        // Strict enforcement: between 0 and 100 inclusive
        if ($pct < 0 || $pct > 100) {
            $errors['percentage'] = 'Percentage must be between 0 and 100 inclusive.';
        }
    }

    return $errors;
}

function createDiscount(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $errors = validateDiscountInput($pdo, $input);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("INSERT INTO discounts (discount_name, percentage) VALUES (?, ?)");
    $stmt->execute([
        trim($input['discount_name']),
        (float)$input['percentage']
    ]);

    $newId = (int)$pdo->lastInsertId();
    send_success('Discount created successfully.', ['discount_id' => $newId], 201);
}

function updateDiscount(PDO $pdo): void {
    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $id = (int)($_GET['id'] ?? ($input['discount_id'] ?? 0));
    $chk = $pdo->prepare("SELECT discount_id FROM discounts WHERE discount_id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        send_error('Discount not found.', [], 404);
    }

    $errors = validateDiscountInput($pdo, $input, $id);
    if (!empty($errors)) {
        send_error('Validation failed.', $errors, 422);
    }

    $stmt = $pdo->prepare("UPDATE discounts SET discount_name = ?, percentage = ? WHERE discount_id = ?");
    $stmt->execute([
        trim($input['discount_name']),
        (float)$input['percentage'],
        $id
    ]);

    send_success('Discount updated successfully.');
}

function softDeleteDiscount(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['discount_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE discounts SET deleted_at = NOW() WHERE discount_id = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Discount not found or already deactivated.', [], 404);
    }

    send_success('Discount deactivated (soft-deleted) successfully.');
}

function restoreDiscount(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['discount_id'] ?? 0));

    $stmt = $pdo->prepare("UPDATE discounts SET deleted_at = NULL WHERE discount_id = ? AND deleted_at IS NOT NULL");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Discount not found or already active.', [], 404);
    }

    send_success('Discount restored successfully.');
}

function hardDeleteDiscount(PDO $pdo): void {
    $input = get_json_input();
    $id = (int)($_GET['id'] ?? ($input['discount_id'] ?? 0));

    $stmt = $pdo->prepare("DELETE FROM discounts WHERE discount_id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        send_error('Discount not found.', [], 404);
    }

    send_success('Discount permanently deleted.');
}

