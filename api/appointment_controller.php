<?php
// api/appointment_controller.php
// Master CRUD for Appointments
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records & mysql_retrieve_specific_record (INNER JOIN relational retrieval and parameterized primary-key lookup)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
require_role(['Administrator', 'Receptionist', 'Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            getAppointmentById($pdo, (int)$_GET['id']);
        } else {
            listAppointments($pdo);
        }
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in appointment_controller.php: " . $e->getMessage());
    send_error('A database error occurred.', ['details' => $e->getMessage()], 500);
} catch (Exception $e) {
    error_log("General Error in appointment_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function listAppointments(PDO $pdo) {
    $authUser = get_auth_user();
    
    // Base query
    $sql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                   a.chief_complaint, a.status, 
                   p.patient_id, p.first_name as patient_first, p.last_name as patient_last,
                   u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, d.doctor_id
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.patient_id
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u_doc ON d.user_id = u_doc.user_id
            WHERE 1=1";
    
    $params = [];
    
    // If doctor, restrict to their appointments
    if ($authUser['role_name'] === 'Doctor') {
        // Find this user's doctor_id
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $stmtDoc->execute([$authUser['user_id']]);
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
        
        if (!$doc) {
            send_success('No appointments found', ['items' => []]);
            return;
        }
        
        $sql .= " AND a.doctor_id = ?";
        $params[] = $doc['doctor_id'];
    }

    $sql .= " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    send_success('Appointments retrieved', ['items' => $results]);
}

function getAppointmentById(PDO $pdo, int $id) {
    // Similar joins as list
    $authUser = get_auth_user();

    $sql = "SELECT a.appointment_id, a.patient_id, a.doctor_id, a.created_by, 
                   a.appointment_date, a.appointment_time, a.chief_complaint, a.status,
                   p.first_name as patient_first, p.last_name as patient_last,
                   u_doc.first_name as doctor_first, u_doc.last_name as doctor_last
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.patient_id
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u_doc ON d.user_id = u_doc.user_id
            WHERE a.appointment_id = ?";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment) {
        send_error('Appointment not found.', [], 404);
    }
    
    if ($authUser['role_name'] === 'Doctor') {
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $stmtDoc->execute([$authUser['user_id']]);
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
        if (!$doc || $appointment['doctor_id'] != $doc['doctor_id']) {
             send_error('Unauthorized access to this appointment.', [], 403);
        }
    }

    send_success('Appointment retrieved', ['item' => $appointment]);
}
