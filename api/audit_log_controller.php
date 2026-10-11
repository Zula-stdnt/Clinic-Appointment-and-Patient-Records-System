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

    // Enrich logs with related entity names for human-readable audit trail reporting
    $patientIds = [];
    $doctorIds = [];
    $userIds = [];
    $appointmentIds = [];

    foreach ($logs as $log) {
        $eType = strtolower($log['entity_type'] ?? '');
        $eId = (int)($log['entity_id'] ?? 0);
        if ($eId > 0) {
            if ($eType === 'patient') $patientIds[] = $eId;
            elseif ($eType === 'doctor') $doctorIds[] = $eId;
            elseif ($eType === 'user') $userIds[] = $eId;
            elseif ($eType === 'appointment') $appointmentIds[] = $eId;
        }

        if (!empty($log['new_values_parsed']['patient_id'])) {
            $patientIds[] = (int)$log['new_values_parsed']['patient_id'];
        }
        if (!empty($log['new_values_parsed']['doctor_id'])) {
            $doctorIds[] = (int)$log['new_values_parsed']['doctor_id'];
        }
        if (!empty($log['new_values_parsed']['appointment_id'])) {
            $appointmentIds[] = (int)$log['new_values_parsed']['appointment_id'];
        }
    }

    $patientNames = [];
    if (!empty($patientIds)) {
        $patientIds = array_values(array_unique($patientIds));
        $inPat = implode(',', array_fill(0, count($patientIds), '?'));
        $pStmt = $pdo->prepare("SELECT patient_id, CONCAT(first_name, ' ', last_name) AS full_name FROM patients WHERE patient_id IN ($inPat)");
        $pStmt->execute($patientIds);
        while ($row = $pStmt->fetch(PDO::FETCH_ASSOC)) {
            $patientNames[$row['patient_id']] = trim($row['full_name']);
        }
    }

    $doctorNames = [];
    if (!empty($doctorIds)) {
        $doctorIds = array_values(array_unique($doctorIds));
        $inDoc = implode(',', array_fill(0, count($doctorIds), '?'));
        $dStmt = $pdo->prepare("SELECT doctor_id, CONCAT(first_name, ' ', last_name) AS full_name FROM doctors WHERE doctor_id IN ($inDoc)");
        $dStmt->execute($doctorIds);
        while ($row = $dStmt->fetch(PDO::FETCH_ASSOC)) {
            $doctorNames[$row['doctor_id']] = trim($row['full_name']);
        }
    }

    $userNames = [];
    if (!empty($userIds)) {
        $userIds = array_values(array_unique($userIds));
        $inUsr = implode(',', array_fill(0, count($userIds), '?'));
        $uStmt = $pdo->prepare("SELECT user_id, CONCAT(first_name, ' ', last_name) AS full_name, username FROM users WHERE user_id IN ($inUsr)");
        $uStmt->execute($userIds);
        while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
            $userNames[$row['user_id']] = trim($row['full_name']) ?: $row['username'];
        }
    }

    $appointmentMap = [];
    if (!empty($appointmentIds)) {
        $appointmentIds = array_values(array_unique($appointmentIds));
        $inAppt = implode(',', array_fill(0, count($appointmentIds), '?'));
        $aStmt = $pdo->prepare("
            SELECT a.appointment_id, a.patient_id, a.doctor_id,
                   CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                   CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.patient_id
            LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.appointment_id IN ($inAppt)
        ");
        $aStmt->execute($appointmentIds);
        while ($row = $aStmt->fetch(PDO::FETCH_ASSOC)) {
            $appointmentMap[$row['appointment_id']] = $row;
        }
    }

    foreach ($logs as &$log) {
        $eType = strtolower($log['entity_type'] ?? '');
        $eId = (int)($log['entity_id'] ?? 0);
        $apptId = (int)($log['new_values_parsed']['appointment_id'] ?? ($eType === 'appointment' ? $eId : 0));

        $patName = null;
        $docName = null;
        $targetName = null;

        if ($apptId && isset($appointmentMap[$apptId])) {
            $patName = trim($appointmentMap[$apptId]['patient_name'] ?? '');
            $docName = trim($appointmentMap[$apptId]['doctor_name'] ?? '');
        }

        if (!empty($log['new_values_parsed']['patient_id'])) {
            $pId = (int)$log['new_values_parsed']['patient_id'];
            if (!empty($patientNames[$pId])) {
                $patName = $patientNames[$pId];
            }
        }

        if (!empty($log['new_values_parsed']['doctor_id'])) {
            $dId = (int)$log['new_values_parsed']['doctor_id'];
            if (!empty($doctorNames[$dId])) {
                $docName = $doctorNames[$dId];
            }
        }

        if ($eType === 'patient') {
            $targetName = $patientNames[$eId] ?? null;
            if (!$patName && $targetName) $patName = $targetName;
        } elseif ($eType === 'doctor') {
            $targetName = $doctorNames[$eId] ?? null;
            if (!$docName && $targetName) $docName = $targetName;
        } elseif ($eType === 'user') {
            $targetName = $userNames[$eId] ?? null;
        } elseif ($eType === 'appointment' && $patName) {
            $targetName = $patName;
        }

        $log['target_name'] = $targetName;
        $log['target_patient_name'] = $patName;
        $log['target_doctor_name'] = $docName;
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

