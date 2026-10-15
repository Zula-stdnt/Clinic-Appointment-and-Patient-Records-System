<?php
// api/access_request_controller.php
// Hybrid Break-Glass & Administrative Record Access Approval Controller
// Supports Standard Mode (Admin Approval Flow) and Urgent Mode (Immediate Overrides Flagged for Audit)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

require_login();
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;
$authUser = get_auth_user();
$role = $authUser['role_name'] ?? '';

try {
    if ($method === 'GET') {
        if ($role === 'Administrator') {
            listAdminRequests($pdo);
        } elseif ($role === 'Doctor') {
            listDoctorRequests($pdo, (int)$authUser['user_id']);
        } else {
            send_error('Unauthorized access.', [], 403);
        }
    } elseif ($method === 'POST') {
        require_role(['Doctor']);
        createAccessRequest($pdo, (int)$authUser['user_id']);
    } elseif ($method === 'PUT') {
        require_role(['Administrator']);
        reviewAccessRequest($pdo, (int)$authUser['user_id'], $action);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in access_request_controller.php: " . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in access_request_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function listAdminRequests(PDO $pdo): void {
    $filter = $_GET['filter'] ?? 'all'; // 'pending' | 'flagged' | 'all'
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 15)));
    $offset = ($page - 1) * $pageSize;

    $where = ['1=1'];
    $params = [];

    if ($filter === 'pending') {
        $where[] = "rar.status = 'pending'";
    } elseif ($filter === 'flagged') {
        $where[] = "rar.is_audit_flagged = 1";
    }

    $whereSql = implode(' AND ', $where);

    $countSql = "SELECT COUNT(*) FROM record_access_requests rar WHERE {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataSql = "
        SELECT rar.request_id, rar.doctor_id, rar.patient_id, rar.mode, rar.status,
               rar.reason, rar.is_audit_flagged, rar.audit_reviewed, rar.requested_at,
               rar.reviewed_by, rar.reviewed_at, rar.review_notes, rar.expires_at,
               u_doc.first_name AS doctor_first, u_doc.last_name AS doctor_last,
               p.first_name AS patient_first, p.last_name AS patient_last,
               u_rev.username AS reviewer_username
        FROM record_access_requests rar
        INNER JOIN doctors d ON rar.doctor_id = d.doctor_id
        INNER JOIN users u_doc ON d.user_id = u_doc.user_id
        INNER JOIN patients p ON rar.patient_id = p.patient_id
        LEFT JOIN users u_rev ON rar.reviewed_by = u_rev.user_id
        WHERE {$whereSql}
        ORDER BY 
            CASE WHEN rar.status = 'pending' THEN 0 WHEN rar.is_audit_flagged = 1 AND rar.audit_reviewed = 0 THEN 1 ELSE 2 END,
            rar.requested_at DESC
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $pdo->prepare($dataSql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Access requests retrieved.', [
        'items'     => $items,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'pages'     => (int)ceil($total / $pageSize)
    ]);
}

function listDoctorRequests(PDO $pdo, int $userId): void {
    $docStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
    $docStmt->execute([$userId]);
    $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }
    $doctorId = (int)$doc['doctor_id'];

    $patientId = isset($_GET['patient_id']) ? (int)$_GET['patient_id'] : 0;
    $where = ['rar.doctor_id = ?'];
    $params = [$doctorId];

    if ($patientId > 0) {
        $where[] = 'rar.patient_id = ?';
        $params[] = $patientId;
    }

    $whereSql = implode(' AND ', $where);

    $sql = "
        SELECT rar.request_id, rar.doctor_id, rar.patient_id, rar.mode, rar.status,
               rar.reason, rar.requested_at, rar.reviewed_at, rar.review_notes, rar.expires_at,
               (rar.expires_at IS NOT NULL AND rar.expires_at > NOW()) AS is_active_grant,
               p.first_name AS patient_first, p.last_name AS patient_last
        FROM record_access_requests rar
        INNER JOIN patients p ON rar.patient_id = p.patient_id
        WHERE {$whereSql}
        ORDER BY rar.requested_at DESC
        LIMIT 20
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Your access requests retrieved.', ['items' => $items]);
}

function createAccessRequest(PDO $pdo, int $userId): void {
    $docStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
    $docStmt->execute([$userId]);
    $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }
    $doctorId = (int)$doc['doctor_id'];

    $input = get_json_input();
    $patientId = (int)($input['patient_id'] ?? 0);
    $reason = trim($input['reason'] ?? '');
    $mode = strtolower(trim($input['mode'] ?? 'standard'));

    if ($patientId <= 0) {
        send_error('patient_id is required.', [], 422);
    }

    if (mb_strlen($reason) < 10) {
        send_error('Clinical justification must be at least 10 characters long.', ['reason' => 'Justification is too short.'], 422);
    }

    // Verify patient exists
    $patStmt = $pdo->prepare("SELECT patient_id, first_name, last_name FROM patients WHERE patient_id = ? AND deleted_at IS NULL LIMIT 1");
    $patStmt->execute([$patientId]);
    $patient = $patStmt->fetch(PDO::FETCH_ASSOC);
    if (!$patient) {
        send_error('Patient record not found or archived.', [], 404);
    }

    $pdo->beginTransaction();
    try {
        if ($mode === 'urgent') {
            // Urgent Mode: Immediate grant with mandatory audit flag
            $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
            $ins = $pdo->prepare("
                INSERT INTO record_access_requests (doctor_id, patient_id, mode, status, reason, is_audit_flagged, audit_reviewed, expires_at)
                VALUES (?, ?, 'urgent', 'approved', ?, 1, 0, ?)
            ");
            $ins->execute([$doctorId, $patientId, $reason, $expiresAt]);
            $requestId = (int)$pdo->lastInsertId();

            log_audit($pdo, $userId, 'BREAK_GLASS_ACCESS', 'patient', $patientId, null, [
                'request_id'   => $requestId,
                'mode'         => 'urgent',
                'auto_flagged' => true
            ], $reason);

            $pdo->commit();

            send_success('Urgent emergency access granted. This session has been flagged for mandatory compliance audit.', [
                'request_id'     => $requestId,
                'mode'           => 'urgent',
                'status'         => 'approved',
                'is_break_glass' => true,
                'expires_at'     => $expiresAt
            ], 201);
        } else {
            // Standard Mode: Routine administrative approval flow
            // Check if there is already a pending request for this patient
            $chk = $pdo->prepare("SELECT request_id FROM record_access_requests WHERE doctor_id = ? AND patient_id = ? AND status = 'pending' LIMIT 1");
            $chk->execute([$doctorId, $patientId]);
            if ($chk->fetch()) {
                $pdo->rollBack();
                send_error('A standard access request for this patient is already pending review.', [], 409);
            }

            $ins = $pdo->prepare("
                INSERT INTO record_access_requests (doctor_id, patient_id, mode, status, reason, is_audit_flagged, audit_reviewed)
                VALUES (?, ?, 'standard', 'pending', ?, 0, 0)
            ");
            $ins->execute([$doctorId, $patientId, $reason]);
            $requestId = (int)$pdo->lastInsertId();

            log_audit($pdo, $userId, 'REQUEST_STANDARD_ACCESS', 'patient', $patientId, null, [
                'request_id' => $requestId,
                'mode'       => 'standard'
            ], $reason);

            $pdo->commit();

            send_success('Access request submitted for administrative review.', [
                'request_id' => $requestId,
                'mode'       => 'standard',
                'status'     => 'pending'
            ], 201);
        }
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function reviewAccessRequest(PDO $pdo, int $adminUserId, ?string $action): void {
    $input = get_json_input();
    $requestId = (int)($input['request_id'] ?? ($_GET['id'] ?? 0));
    $notes = trim($input['notes'] ?? '');

    if ($requestId <= 0) {
        send_error('request_id is required.', [], 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM record_access_requests WHERE request_id = ? LIMIT 1");
    $stmt->execute([$requestId]);
    $req = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$req) {
        send_error('Access request not found.', [], 404);
    }

    if ($action === 'approve') {
        if ($req['status'] !== 'pending') {
            send_error('Only pending requests can be approved.', [], 409);
        }

        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        $upd = $pdo->prepare("
            UPDATE record_access_requests 
            SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, expires_at = ?
            WHERE request_id = ?
        ");
        $upd->execute([$adminUserId, $notes ?: 'Approved by clinic administrator', $expiresAt, $requestId]);

        log_audit($pdo, $adminUserId, 'APPROVE_ACCESS_REQUEST', 'record_access_request', $requestId, [
            'status' => 'pending'
        ], [
            'status'     => 'approved',
            'expires_at' => $expiresAt
        ], $notes ?: 'Standard emergency access approved (24 hours)');

        send_success('Access request approved for 24 hours.', [
            'request_id' => $requestId,
            'status'     => 'approved',
            'expires_at' => $expiresAt
        ]);
    } elseif ($action === 'reject') {
        if ($req['status'] !== 'pending') {
            send_error('Only pending requests can be rejected.', [], 409);
        }

        $upd = $pdo->prepare("
            UPDATE record_access_requests 
            SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
            WHERE request_id = ?
        ");
        $upd->execute([$adminUserId, $notes ?: 'Rejected by clinic administrator', $requestId]);

        log_audit($pdo, $adminUserId, 'REJECT_ACCESS_REQUEST', 'record_access_request', $requestId, [
            'status' => 'pending'
        ], [
            'status' => 'rejected'
        ], $notes ?: 'Access request rejected');

        send_success('Access request rejected.', [
            'request_id' => $requestId,
            'status'     => 'rejected'
        ]);
    } elseif ($action === 'acknowledge_audit') {
        if (!$req['is_audit_flagged']) {
            send_error('This request is not flagged for mandatory audit.', [], 400);
        }

        $upd = $pdo->prepare("
            UPDATE record_access_requests 
            SET audit_reviewed = 1, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
            WHERE request_id = ?
        ");
        $upd->execute([$adminUserId, $notes ?: 'Compliance audit acknowledged and signed off', $requestId]);

        log_audit($pdo, $adminUserId, 'ACKNOWLEDGE_AUDIT_FLAG', 'record_access_request', $requestId, null, [
            'audit_reviewed' => 1
        ], $notes ?: 'Mandatory audit review acknowledged');

        send_success('Urgent break-glass audit review acknowledged and logged.');
    } else {
        send_error('Unknown review action. Supported: approve, reject, acknowledge_audit.', [], 400);
    }
}

