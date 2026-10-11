<?php
// api/audit_log_controller.php
// Administrative compliance audit log endpoint
// Provides read-only access to immutable system audit logs for Administrator oversight

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/response.php';

header('Content-Type: application/json; charset=utf-8');

// Strict Access Control: only Administrator can view system audit trails
require_role('Administrator');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method !== 'GET') {
    send_error('Method not allowed. Audit logs are immutable and append-only.', [], 405);
}

try {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 10)));
    $offset = ($page - 1) * $limit;

    $where = ['1=1'];
    $params = [];

    $actionParam = trim((string)($_GET['action'] ?? ($_GET['action_filter'] ?? '')));
    if ($actionParam !== '') {
        $where[] = 'al.action = ?';
        $params[] = $actionParam;
    }

    if (!empty($_GET['entity_type'])) {
        $where[] = 'al.entity_type = ?';
        $params[] = trim($_GET['entity_type']);
    }

    if (!empty($_GET['user_id'])) {
        $where[] = 'al.user_id = ?';
        $params[] = (int)$_GET['user_id'];
    }

    $dateFilter = trim($_GET['date_filter'] ?? 'all');
    if ($dateFilter === 'today') {
        $where[] = 'al.created_at >= CURDATE()';
    } elseif ($dateFilter === 'last_7_days') {
        $where[] = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } elseif ($dateFilter === 'last_30_days') {
        $where[] = 'al.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    if (!empty($_GET['search'])) {
        $searchTerm = '%' . trim($_GET['search']) . '%';
        $where[] = '(u.username LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR al.action LIKE ? OR al.reason LIKE ?)';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $whereSql = implode(' AND ', $where);

    // Dynamic sorting whitelist
    $allowedSort = [
        'created_at'  => 'al.created_at',
        'log_id'      => 'al.log_id',
        'action'      => 'al.action',
        'entity_type' => 'al.entity_type',
        'username'    => 'u.username',
        'full_name'   => 'u.first_name'
    ];
    $sortByParam = $_GET['sort_by'] ?? 'created_at';
    $sortCol = $allowedSort[$sortByParam] ?? 'al.created_at';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    $countSql = "SELECT COUNT(*) FROM audit_logs al JOIN users u ON al.user_id = u.user_id WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Fetch paginated rows
    $sql = "SELECT al.log_id, al.user_id, al.action, al.entity_type, al.entity_id, 
                   al.old_values, al.new_values, al.reason, al.ip_address, al.created_at,
                   u.username, CONCAT(u.first_name, ' ', u.last_name) AS full_name, r.role_name
            FROM audit_logs al
            JOIN users u ON al.user_id = u.user_id
            JOIN roles r ON u.role_id = r.role_id
            WHERE {$whereSql}
            ORDER BY {$sortCol} {$sortOrder}, al.log_id DESC
            LIMIT ? OFFSET ?";

    $stmt = $pdo->prepare($sql);
    $execParams = array_merge($params, [$limit, $offset]);
    $stmt->execute($execParams);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Decode JSON strings in old_values and new_values if valid JSON
    foreach ($logs as &$log) {
        if (!empty($log['old_values'])) {
            $decoded = json_decode($log['old_values'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $log['old_values_parsed'] = $decoded;
            }
        }
        if (!empty($log['new_values'])) {
            $decoded = json_decode($log['new_values'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $log['new_values_parsed'] = $decoded;
            }
        }
    }
    unset($log);

    $totalPages = (int)ceil($total / $limit);

    send_success('Audit logs retrieved successfully.', [
        'items' => $logs,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total_items' => $total,
            'total_pages' => $totalPages
        ]
    ]);
} catch (PDOException $e) {
    error_log("Database Error in audit_log_controller.php: " . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Throwable $e) {
    error_log("General Error in audit_log_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

