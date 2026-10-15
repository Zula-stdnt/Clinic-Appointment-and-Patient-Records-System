<?php
// api/doctor_schedule_controller.php
// REST API for doctor weekly schedules and availability

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

require_login();
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    if ($method === 'GET') {
        getDoctorSchedules($pdo);
    } elseif ($method === 'POST' || $method === 'PUT') {
        require_role(['Administrator']);
        saveDoctorSchedules($pdo);
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in doctor_schedule_controller.php: " . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in doctor_schedule_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function getDoctorSchedules(PDO $pdo): void {
    $doctorId = (int)($_GET['doctor_id'] ?? 0);
    $params = [];
    $where = ['ds.is_active = 1'];

    if ($doctorId > 0) {
        $where[] = 'ds.doctor_id = ?';
        $params[] = $doctorId;
    }

    $whereSql = implode(' AND ', $where);
    $sql = "
        SELECT ds.schedule_id, ds.doctor_id, ds.day_of_week, ds.start_time, ds.end_time, ds.is_active,
               u.first_name, u.last_name, u.middle_initial
        FROM doctor_schedules ds
        INNER JOIN doctors d ON ds.doctor_id = d.doctor_id
        INNER JOIN users u ON d.user_id = u.user_id
        WHERE {$whereSql}
        ORDER BY ds.doctor_id, ds.day_of_week
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $days = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];
    foreach ($schedules as &$s) {
        $s['day_name'] = $days[(int)$s['day_of_week']] ?? 'Unknown';
        $s['start_time_fmt'] = date('H:i', strtotime($s['start_time']));
        $s['end_time_fmt'] = date('H:i', strtotime($s['end_time']));
    }
    unset($s);

    send_success('Doctor schedules retrieved.', [
        'items'     => $schedules,
        'schedules' => $schedules
    ]);
}

function saveDoctorSchedules(PDO $pdo): void {
    $input = get_json_input();
    $doctorId = (int)($input['doctor_id'] ?? 0);
    $schedules = $input['schedules'] ?? [];

    if ($doctorId <= 0) {
        send_error('doctor_id is required.', [], 422);
    }

    $docChk = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? AND deleted_at IS NULL LIMIT 1");
    $docChk->execute([$doctorId]);
    if (!$docChk->fetch()) {
        send_error('Doctor not found or archived.', [], 404);
    }

    $pdo->beginTransaction();
    try {
        // Deactivate old schedules
        $deact = $pdo->prepare("UPDATE doctor_schedules SET is_active = 0 WHERE doctor_id = ?");
        $deact->execute([$doctorId]);

        $ins = $pdo->prepare("
            INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
            VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), is_active = 1
        ");

        foreach ($schedules as $item) {
            $dayOfWeek = (int)($item['day_of_week'] ?? 0);
            $start = trim($item['start_time'] ?? '08:00:00');
            $end = trim($item['end_time'] ?? '17:00:00');
            if ($dayOfWeek >= 1 && $dayOfWeek <= 7) {
                $ins->execute([$doctorId, $dayOfWeek, $start, $end]);
            }
        }

        $pdo->commit();
        send_success('Doctor schedules saved successfully.');
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
