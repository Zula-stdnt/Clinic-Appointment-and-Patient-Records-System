<?php
// api/medication_controller.php
// Master CRUD for Medications (Read-only for Doctor Dashboard)
// ITE 387 Lesson applied: 03 APIs and Database Operations/mysql_retrieve_records (PDO prepared SELECT with FETCH_ASSOC for dropdown lookup catalog)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Administrator', 'Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            getMedicationById($pdo, (int)$_GET['id']);
        } else {
            listMedications($pdo);
        }
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in medication_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', ['details' => $e->getMessage()], 500);
} catch (Exception $e) {
    error_log("General Error in medication_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function listMedications(PDO $pdo) {
    // Only return active medications
    $sql = "SELECT medication_id, name, generic_name, manufacturer 
            FROM medications 
            WHERE deleted_at IS NULL 
            ORDER BY name ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Medications retrieved', ['items' => $results]);
}

function getMedicationById(PDO $pdo, int $id) {
    $sql = "SELECT medication_id, name, generic_name, manufacturer 
            FROM medications 
            WHERE medication_id = ? AND deleted_at IS NULL";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $med = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$med) {
        send_error('Medication not found.', [], 404);
    }

    send_success('Medication retrieved', ['item' => $med]);
}
