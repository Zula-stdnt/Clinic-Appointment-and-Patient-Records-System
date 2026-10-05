<?php
// api/icd10_controller.php
// Read-only ICD-10 diagnosis catalog lookup for the Doctor consultation
// diagnosis picker (SearchSelect) and other clinical screens.
// ITE 387 Lesson applied: 03 APIs and Database Operations/mysql_retrieve_records
// (PDO prepared SELECT with FETCH_ASSOC for dropdown lookup catalog)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Administrator', 'Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    if ($method !== 'GET') {
        send_error('Method not allowed.', [], 405);
    }

    if (isset($_GET['code'])) {
        getIcd10ByCode($pdo, trim($_GET['code']));
    } else {
        listIcd10Codes($pdo);
    }
} catch (PDOException $e) {
    error_log("Database Error in icd10_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', [], 500);
}

function listIcd10Codes(PDO $pdo): void {
    $search = trim($_GET['search'] ?? '');
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));

    $sql = "SELECT code, description FROM icd10_codes";
    $params = [];

    if ($search !== '') {
        $sql .= " WHERE code LIKE :s1 OR description LIKE :s2";
        $params[':s1'] = $search . '%';
        $params[':s2'] = '%' . $search . '%';
    }

    $sql .= " ORDER BY code ASC LIMIT :limit";
    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    send_success('ICD-10 codes retrieved', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function getIcd10ByCode(PDO $pdo, string $code): void {
    $stmt = $pdo->prepare("SELECT code, description FROM icd10_codes WHERE code = ? LIMIT 1");
    $stmt->execute([$code]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$item) {
        send_error('ICD-10 code not found.', [], 404);
    }

    send_success('ICD-10 code retrieved', ['item' => $item]);
}
