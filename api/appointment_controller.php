<?php
// api/appointment_controller.php
// Master CRUD for Appointments
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records & mysql_retrieve_specific_record (INNER JOIN relational retrieval and parameterized primary-key lookup)

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

require_login();
require_role(['Administrator', 'Receptionist', 'Doctor']);
verify_csrf_on_state_change();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        if ($action === 'sync_state') {
            getSyncState($pdo);
        } elseif (isset($_GET['meta'])) {
            $meta = $_GET['meta'];
            if ($meta === 'patients') {
                listPatientOptions($pdo);
            } elseif ($meta === 'doctors') {
                listDoctorOptions($pdo);
            } else {
                send_error('Unknown meta resource.', [], 400);
            }
        } elseif (isset($_GET['id'])) {
            getAppointmentById($pdo, (int)$_GET['id']);
        } else {
            listAppointments($pdo);
        }
    } elseif ($method === 'POST') {
        if ($action === 'request_cancel') {
            requestCancelAppointment($pdo);
        } else {
            createAppointment($pdo);
        }
    } elseif ($method === 'PUT') {
        if ($action === 'cancel') {
            cancelAppointment($pdo);
        } elseif ($action === 'request_cancel') {
            requestCancelAppointment($pdo);
        } elseif (isset($_GET['id'])) {
            updateAppointment($pdo, (int)$_GET['id']);
        } else {
            send_error('Appointment ID is required or unknown action.', [], 400);
        }
    } else {
        send_error('Method not allowed.', [], 405);
    }
} catch (PDOException $e) {
    error_log("Database Error in appointment_controller.php: " . $e->getMessage());
    send_error('A database error occurred. Please try again.', [], 500);
} catch (Exception $e) {
    error_log("General Error in appointment_controller.php: " . $e->getMessage());
    send_error($e->getMessage(), [], 400);
}

function listAppointments(PDO $pdo) {
    $authUser = get_auth_user();
    
    $where = ['1=1'];
    $params = [];
    
    // If doctor, restrict to their appointments
    if ($authUser['role_name'] === 'Doctor') {
        $stmtDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
        $stmtDoc->execute([$authUser['user_id']]);
        $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
        
        if (!$doc) {
            send_success('No appointments found', [
                'items' => [],
                'total' => 0,
                'page' => 1,
                'page_size' => 10,
                'pages' => 1
            ]);
            return;
        }
        
        $where[] = "a.doctor_id = :auth_doctor_id";
        $params[':auth_doctor_id'] = $doc['doctor_id'];
    }

    $status = trim($_GET['status'] ?? '');
    if ($status !== '' && in_array($status, ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'], true)) {
        $where[] = "a.status = :status";
        $params[':status'] = $status;
    }

    $startDate = trim($_GET['start_date'] ?? '');
    $endDate = trim($_GET['end_date'] ?? '');
    if ($startDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
        if ($endDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            if ($startDate > $endDate) {
                $temp = $startDate;
                $startDate = $endDate;
                $endDate = $temp;
            }
            $where[] = "a.appointment_date BETWEEN :start_date AND :end_date";
            $params[':start_date'] = $startDate;
            $params[':end_date'] = $endDate;
        } else {
            $where[] = "a.appointment_date >= :start_date";
            $params[':start_date'] = $startDate;
        }
    } elseif ($endDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        $where[] = "a.appointment_date <= :end_date";
        $params[':end_date'] = $endDate;
    }

    $monthFilter = trim($_GET['month'] ?? '');
    if ($monthFilter !== '' && preg_match('/^\d{4}-\d{2}$/', $monthFilter)) {
        $firstDay = $monthFilter . '-01';
        $lastDay = date('Y-m-t', strtotime($firstDay));
        $where[] = "a.appointment_date BETWEEN :month_start AND :month_end";
        $params[':month_start'] = $firstDay;
        $params[':month_end'] = $lastDay;
    }

    $dateFilter = trim($_GET['date_filter'] ?? '');
    $manilaTz = new DateTimeZone('Asia/Manila');
    $nowManila = new DateTime('now', $manilaTz);
    if ($dateFilter === 'today') {
        $where[] = "a.appointment_date = :filter_today";
        $params[':filter_today'] = $nowManila->format('Y-m-d');
    } elseif ($dateFilter === 'upcoming') {
        $where[] = "CONCAT(a.appointment_date, ' ', a.appointment_time) >= :filter_upcoming";
        $params[':filter_upcoming'] = $nowManila->format('Y-m-d H:i:s');
    } elseif ($dateFilter === 'past') {
        $where[] = "CONCAT(a.appointment_date, ' ', a.appointment_time) < :filter_past";
        $params[':filter_past'] = $nowManila->format('Y-m-d H:i:s');
    }

    $search = trim($_GET['search'] ?? '');
    if ($search !== '') {
        $where[] = "(p.first_name LIKE :search1 OR p.last_name LIKE :search2 OR u_doc.first_name LIKE :search3 OR u_doc.last_name LIKE :search4 OR a.chief_complaint LIKE :search5)";
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
        $params[':search4'] = '%' . $search . '%';
        $params[':search5'] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);
    $isPaginated = isset($_GET['page']) || isset($_GET['page_size']);

    if ($isPaginated) {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $pageSize = max(1, min(100, (int)($_GET['page_size'] ?? 10)));
        $offset = ($page - 1) * $pageSize;

        // Total count
        $countSql = "SELECT COUNT(*) 
                     FROM appointments a
                     INNER JOIN patients p ON a.patient_id = p.patient_id
                     INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                     INNER JOIN users u_doc ON d.user_id = u_doc.user_id
                     WHERE {$whereSql}";
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $k => $v) {
            $countStmt->bindValue($k, $v);
        }
        $countStmt->execute();
        $total = (int)$countStmt->fetchColumn();
        $pages = $total > 0 ? (int)ceil($total / $pageSize) : 1;

        $sortBy = trim($_GET['sort_by'] ?? '');
        $sortOrder = strtoupper(trim($_GET['sort_order'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $allowedSortCols = [
            'appointment_date' => 'a.appointment_date %s, a.appointment_time %s, a.appointment_id DESC',
            'patient_name'     => 'p.last_name %s, p.first_name %s, a.appointment_date DESC',
            'doctor_name'      => 'u_doc.last_name %s, u_doc.first_name %s, a.appointment_date DESC',
            'chief_complaint'  => 'a.chief_complaint %s, a.appointment_date DESC',
            'status'           => 'a.status %s, a.appointment_date DESC'
        ];

        $sort = trim($_GET['sort'] ?? '');
        $dataParams = $params;

        if (isset($allowedSortCols[$sortBy])) {
            $orderSql = "ORDER BY " . sprintf($allowedSortCols[$sortBy], $sortOrder, $sortOrder);
        } else {
            $useUpcomingSort = ($sort === 'upcoming') || ($authUser['role_name'] === 'Doctor' && $sort !== 'desc');
            if ($useUpcomingSort) {
                $clinicNow = $nowManila->format('Y-m-d H:i:s');
                $dataParams[':clinic_now1'] = $clinicNow;
                $dataParams[':clinic_now2'] = $clinicNow;
                $orderSql = "ORDER BY 
                    CASE 
                        WHEN a.status IN ('scheduled', 'confirmed') AND CONCAT(a.appointment_date, ' ', a.appointment_time) >= :clinic_now1 THEN 0
                        ELSE 1
                    END ASC,
                    CASE 
                        WHEN a.status IN ('scheduled', 'confirmed') AND CONCAT(a.appointment_date, ' ', a.appointment_time) >= :clinic_now2 
                            THEN CONCAT(a.appointment_date, ' ', a.appointment_time)
                    END ASC,
                    a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC";
            } else {
                $orderSql = "ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC";
            }
        }

        // Paginated query
        $dataSql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                           a.chief_complaint, a.status, 
                           a.cancel_requested, a.cancel_request_reason, a.cancel_requested_at,
                           p.patient_id, p.first_name as patient_first, p.last_name as patient_last,
                           (p.deleted_at IS NOT NULL) as patient_archived,
                           u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, d.doctor_id,
                           (d.deleted_at IS NOT NULL) as doctor_archived,
                           v.blood_pressure, v.temperature, v.oxygen_saturation
                    FROM appointments a
                    INNER JOIN patients p ON a.patient_id = p.patient_id
                    INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                    INNER JOIN users u_doc ON d.user_id = u_doc.user_id
                    LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
                    WHERE {$whereSql}
                    {$orderSql}
                    LIMIT :page_size OFFSET :offset";

        $stmt = $pdo->prepare($dataSql);
        foreach ($dataParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':page_size', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
        foreach ($results as &$appt) {
            $appt['is_overdue'] = false;
            $appt['minutes_overdue'] = 0;
            if (in_array($appt['status'], ['scheduled', 'confirmed'], true)) {
                $scheduledTime = new DateTime($appt['appointment_date'] . ' ' . $appt['appointment_time'], new DateTimeZone('Asia/Manila'));
                $graceTime = clone $scheduledTime;
                $graceTime->modify('+15 minutes');
                if ($now > $graceTime) {
                    $appt['is_overdue'] = true;
                    $diffSeconds = $now->getTimestamp() - $scheduledTime->getTimestamp();
                    $appt['minutes_overdue'] = (int)round($diffSeconds / 60);
                }
            }
        }
        unset($appt);

        send_success('Appointments retrieved', [
            'items' => $results,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'pages' => $pages
        ]);
    } else {
        // Non-paginated fallback for backward-compatible consumers
        $dataSql = "SELECT a.appointment_id, a.appointment_date, a.appointment_time, 
                           a.chief_complaint, a.status, 
                           a.cancel_requested, a.cancel_request_reason, a.cancel_requested_at,
                           p.patient_id, p.first_name as patient_first, p.last_name as patient_last,
                           (p.deleted_at IS NOT NULL) as patient_archived,
                           u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, d.doctor_id,
                           (d.deleted_at IS NOT NULL) as doctor_archived,
                           v.blood_pressure, v.temperature, v.oxygen_saturation
                    FROM appointments a
                    INNER JOIN patients p ON a.patient_id = p.patient_id
                    INNER JOIN doctors d ON a.doctor_id = d.doctor_id
                    INNER JOIN users u_doc ON d.user_id = u_doc.user_id
                    LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
                    WHERE {$whereSql}
                    ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.appointment_id DESC";

        $stmt = $pdo->prepare($dataSql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
        foreach ($results as &$appt) {
            $appt['is_overdue'] = false;
            $appt['minutes_overdue'] = 0;
            if (in_array($appt['status'], ['scheduled', 'confirmed'], true)) {
                $scheduledTime = new DateTime($appt['appointment_date'] . ' ' . $appt['appointment_time'], new DateTimeZone('Asia/Manila'));
                $graceTime = clone $scheduledTime;
                $graceTime->modify('+15 minutes');
                if ($now > $graceTime) {
                    $appt['is_overdue'] = true;
                    $diffSeconds = $now->getTimestamp() - $scheduledTime->getTimestamp();
                    $appt['minutes_overdue'] = (int)round($diffSeconds / 60);
                }
            }
        }
        unset($appt);
        $total = count($results);

        send_success('Appointments retrieved', [
            'items' => $results,
            'total' => $total,
            'page' => 1,
            'page_size' => $total,
            'pages' => 1
        ]);
    }
}

function getAppointmentById(PDO $pdo, int $id) {
    // Full joined record used by the printable Patient Registration & Appointment Form
    $authUser = get_auth_user();

    $sql = "SELECT a.appointment_id, a.patient_id, a.doctor_id, a.created_by, 
                   a.appointment_date, a.appointment_time, a.chief_complaint, a.status, a.created_at,
                   p.first_name as patient_first, p.last_name as patient_last, p.middle_initial as patient_middle,
                   p.gender as patient_gender, p.date_of_birth, p.contact_no, p.address, p.created_at as patient_created_at,
                   p.allergies_alerts, p.allergies_confirmed_by_doctor,
                   u_doc.first_name as doctor_first, u_doc.last_name as doctor_last, u_doc.middle_initial as doctor_middle,
                   (SELECT GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ')
                      FROM doctor_specialty ds
                      INNER JOIN specialties s ON ds.specialty_id = s.specialty_id
                     WHERE ds.doctor_id = d.doctor_id) AS doctor_specialties,
                   v.blood_pressure, v.temperature, v.oxygen_saturation
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.patient_id
            INNER JOIN doctors d ON a.doctor_id = d.doctor_id
            INNER JOIN users u_doc ON d.user_id = u_doc.user_id
            LEFT JOIN vital_signs v ON a.appointment_id = v.appointment_id
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
        if (!$doc || !is_doctor_authorized_for_appointment($pdo, (int)$doc['doctor_id'], $appointment)) {
             send_error('Unauthorized access to this appointment.', [], 403);
        }
    }

    send_success('Appointment retrieved', ['item' => $appointment]);
}

// Type-ahead data for the booking form: active patients only.
// Supports ?search= so the picker never has to load/scroll the full table.
function listPatientOptions(PDO $pdo): void {
    $search = trim($_GET['search'] ?? '');
    $sql = "SELECT patient_id, first_name, last_name, middle_initial, date_of_birth,
                   allergies_alerts, allergies_confirmed_by_doctor
            FROM patients
            WHERE deleted_at IS NULL";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (first_name LIKE :s1 OR last_name LIKE :s2
                       OR CONCAT(first_name, ' ', last_name) LIKE :s3
                       OR contact_no LIKE :s4)";
        $params[':s1'] = '%' . $search . '%';
        $params[':s2'] = '%' . $search . '%';
        $params[':s3'] = '%' . $search . '%';
        $params[':s4'] = '%' . $search . '%';
    }

    $sql .= " ORDER BY last_name ASC, first_name ASC LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    send_success('Patient options retrieved.', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// Type-ahead data for the booking form: active doctors with their specialties.
// Supports ?search= across name and specialty so users can jump straight to a doctor.
function listDoctorOptions(PDO $pdo): void {
    $search = trim($_GET['search'] ?? '');
    $params = [];

    $sql = "SELECT d.doctor_id, u.first_name, u.last_name, u.middle_initial,
                   GROUP_CONCAT(DISTINCT s.specialty_name ORDER BY s.specialty_name SEPARATOR ', ') AS specialty_names
            FROM doctors d
            LEFT JOIN users u ON d.user_id = u.user_id
            LEFT JOIN doctor_specialty ds ON d.doctor_id = ds.doctor_id
            LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
            WHERE d.deleted_at IS NULL";

    if ($search !== '') {
        $sql .= " AND (u.first_name LIKE :s1 OR u.last_name LIKE :s2
                       OR CONCAT(u.first_name, ' ', u.last_name) LIKE :s3
                       OR EXISTS (
                           SELECT 1 FROM doctor_specialty ds2
                           INNER JOIN specialties s2 ON ds2.specialty_id = s2.specialty_id
                           WHERE ds2.doctor_id = d.doctor_id AND s2.specialty_name LIKE :s4
                       ))";
        $params[':s1'] = '%' . $search . '%';
        $params[':s2'] = '%' . $search . '%';
        $params[':s3'] = '%' . $search . '%';
        $params[':s4'] = '%' . $search . '%';
    }

    $sql .= " GROUP BY d.doctor_id, u.first_name, u.last_name, u.middle_initial
              ORDER BY u.last_name ASC, u.first_name ASC
              LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $doctors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch schedules for all doctors
    $schedStmt = $pdo->query("SELECT doctor_id, day_of_week, start_time, end_time, is_active FROM doctor_schedules WHERE is_active = 1 ORDER BY doctor_id, day_of_week");
    $dayAbbr = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
    $schedulesByDoctor = [];
    while ($row = $schedStmt->fetch(PDO::FETCH_ASSOC)) {
        $dId = (int)$row['doctor_id'];
        if (!isset($schedulesByDoctor[$dId])) {
            $schedulesByDoctor[$dId] = [];
        }
        $schedulesByDoctor[$dId][] = $row;
    }

    foreach ($doctors as &$doc) {
        $dId = (int)$doc['doctor_id'];
        $docSchedules = $schedulesByDoctor[$dId] ?? [];
        $doc['schedules'] = $docSchedules;
        if (!empty($docSchedules)) {
            $daysSummary = [];
            foreach ($docSchedules as $ds) {
                $dow = (int)$ds['day_of_week'];
                $abbr = $dayAbbr[$dow] ?? "D$dow";
                $daysSummary[] = $abbr;
            }
            $startFmt = date('H:i', strtotime($docSchedules[0]['start_time']));
            $endFmt = date('H:i', strtotime($docSchedules[0]['end_time']));
            $doc['schedule_summary'] = implode(', ', $daysSummary) . " ({$startFmt} - {$endFmt})";
        } else {
            $doc['schedule_summary'] = 'Mon-Sat (08:00 - 17:00)';
        }
    }
    unset($doc);

    send_success('Doctor options retrieved.', ['items' => $doctors]);
}

function getSyncState(PDO $pdo): void {
    $manilaTz = new DateTimeZone('Asia/Manila');
    $nowManila = new DateTime('now', $manilaTz);
    $today = $nowManila->format('Y-m-d');

    $stmt = $pdo->prepare("SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN appointment_date = ? AND status IN ('scheduled', 'confirmed') THEN 1 ELSE 0 END) as active_today,
        MAX(appointment_id) as max_id
        FROM appointments");
    $stmt->execute([$today]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $auditStmt = $pdo->query("SELECT MAX(log_id) FROM audit_logs WHERE entity_type = 'appointment'");
    $maxAudit = (int)$auditStmt->fetchColumn();

    $revision = (int)($row['max_id'] ?? 0) . '-' . $maxAudit . '-' . (int)($row['total_appointments'] ?? 0) . '-' . (int)($row['active_today'] ?? 0);

    send_success('Sync state retrieved', [
        'revision' => $revision,
        'total' => (int)($row['total_appointments'] ?? 0),
        'active_today' => (int)($row['active_today'] ?? 0),
        'server_time' => $nowManila->format('Y-m-d H:i:s')
    ]);
}

function validateDoctorSchedule(PDO $pdo, int $doctorId, string $appointmentDate, string $normalizedTime): ?array {
    $dateObj = DateTime::createFromFormat('Y-m-d', $appointmentDate);
    if (!$dateObj) {
        return ['field' => 'appointment_date', 'message' => 'A valid appointment date is required.'];
    }
    $dayNum = (int)$dateObj->format('N'); // 1 = Monday, 7 = Sunday
    $dayMap = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];
    $dayName = $dayMap[$dayNum] ?? 'Unknown';

    if ($dayNum === 7) {
        return ['field' => 'appointment_date', 'message' => 'The clinic is closed on Sundays.'];
    }

    if ($normalizedTime < '08:00:00' || $normalizedTime > '17:00:00') {
        return ['field' => 'appointment_time', 'message' => 'Appointments can only be scheduled between 08:00 and 17:00.'];
    }

    $hour = (int)substr($normalizedTime, 0, 2);
    if ($hour === 12) {
        return ['field' => 'appointment_time', 'message' => 'The clinic is closed for lunch between 12:00 and 12:59.'];
    }

    $stmt = $pdo->prepare("SELECT day_of_week, start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND is_active = 1");
    $stmt->execute([$doctorId]);
    $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($schedules)) {
        $matching = null;
        $activeDayNames = [];
        foreach ($schedules as $s) {
            $dow = (int)$s['day_of_week'];
            $name = $dayMap[$dow] ?? "Day $dow";
            $activeDayNames[] = $name;
            if ($dow === $dayNum) {
                $matching = $s;
            }
        }

        if (!$matching) {
            $daysList = implode(', ', array_unique($activeDayNames));
            return ['field' => 'appointment_date', 'message' => "Doctor is not scheduled on {$dayName}. Available days: {$daysList}."];
        }

        $start = $matching['start_time'];
        $end = $matching['end_time'];
        if ($normalizedTime < $start || $normalizedTime > $end) {
            return ['field' => 'appointment_time', 'message' => "Appointment time {$normalizedTime} is outside doctor's working hours ({$start} - {$end}) on {$dayName}."];
        }
    }

    return null;
}

// Header-detail save: one appointment header plus optional triage vital sign row
function createAppointment(PDO $pdo): void {
    $authUser = get_auth_user();
    $input = get_json_input();

    $patientId       = (int)($input['patient_id'] ?? 0);
    $doctorId        = (int)($input['doctor_id'] ?? 0);
    $appointmentDate = trim($input['appointment_date'] ?? '');
    $appointmentTime = trim($input['appointment_time'] ?? '');
    $chiefComplaint  = trim($input['chief_complaint'] ?? '');
    $bloodPressure   = trim($input['blood_pressure'] ?? '');
    $temperature     = trim((string)($input['temperature'] ?? ''));
    $oxygenSat       = trim((string)($input['oxygen_saturation'] ?? ''));

    $errors = [];

    if ($patientId <= 0) {
        $errors['patient_id'] = 'Please choose a patient.';
    }
    if ($doctorId <= 0) {
        $errors['doctor_id'] = 'Please choose a doctor.';
    }

    $dateObj = DateTime::createFromFormat('Y-m-d', $appointmentDate);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $appointmentDate) {
        $errors['appointment_date'] = 'A valid appointment date is required.';
    }

    $timeObj = DateTime::createFromFormat('H:i', $appointmentTime)
        ?: DateTime::createFromFormat('H:i:s', $appointmentTime);
    if (!$timeObj) {
        $errors['appointment_time'] = 'A valid appointment time is required.';
    }

    $normalizedTime = $timeObj ? $timeObj->format('H:i:s') : '';

    if ($dateObj && $timeObj && $doctorId > 0) {
        $schedErr = validateDoctorSchedule($pdo, $doctorId, $appointmentDate, $normalizedTime);
        if ($schedErr !== null) {
            $errors[$schedErr['field']] = $schedErr['message'];
        }
    }

    if ($bloodPressure !== '') {
        if (mb_strlen($bloodPressure) > 20 || !preg_match('/^([6-9]\d|1\d\d|2[0-5]\d)\/([4-9]\d|1[0-4]\d)$/', $bloodPressure)) {
            $errors['blood_pressure'] = 'Blood pressure must be in SYS/DIA format (e.g., 120/80) with systolic 60-259 and diastolic 40-149.';
        }
    }
    if ($temperature !== '' && (!is_numeric($temperature) || (float)$temperature < 30 || (float)$temperature > 45)) {
        $errors['temperature'] = 'Temperature must be a number between 30 and 45 °C.';
    }
    if ($oxygenSat !== '' && (!is_numeric($oxygenSat) || (float)$oxygenSat < 0 || (float)$oxygenSat > 100)) {
        $errors['oxygen_saturation'] = 'Oxygen saturation must be a number between 0 and 100.';
    }

    if (!empty($errors)) {
        send_error('Please correct the highlighted fields.', $errors, 422);
    }

    // Verify the selected patient and doctor are active records
    $pStmt = $pdo->prepare("SELECT patient_id FROM patients WHERE patient_id = ? AND deleted_at IS NULL LIMIT 1");
    $pStmt->execute([$patientId]);
    if (!$pStmt->fetch()) {
        send_error('The selected patient is not available.', ['patient_id' => 'Patient not found or archived.'], 422);
    }

    $dStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? AND deleted_at IS NULL LIMIT 1");
    $dStmt->execute([$doctorId]);
    if (!$dStmt->fetch()) {
        send_error('The selected doctor is not available.', ['doctor_id' => 'Doctor not found or archived.'], 422);
    }

    $pdo->beginTransaction();

    try {
        // Concurrency lock: serialize bookings for this doctor
        $lockDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? FOR UPDATE");
        $lockDoc->execute([$doctorId]);

        // Prevent double booking: same doctor, same date and time, still active
        $dupStmt = $pdo->prepare(
            "SELECT appointment_id FROM appointments
             WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
               AND status IN ('scheduled', 'confirmed')
             LIMIT 1"
        );
        $dupStmt->execute([$doctorId, $appointmentDate, $normalizedTime]);
        if ($dupStmt->fetch()) {
            $pdo->rollBack();
            send_error('The doctor already has an active appointment at that date and time.', ['appointment_time' => 'Time slot is already occupied.'], 409);
        }

        // Daily clinic capacity check (max 10 active appointments clinic-wide per date)
        $capStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM appointments
             WHERE appointment_date = ?
               AND status IN ('scheduled', 'confirmed')"
        );
        $capStmt->execute([$appointmentDate]);
        $currentCount = (int)$capStmt->fetchColumn();

        if ($currentCount >= 10) {
            $pdo->rollBack();
            send_error('Daily clinic capacity reached (10 appointments max).', [], 409);
        }

        $stmt = $pdo->prepare(
            "INSERT INTO appointments (patient_id, doctor_id, created_by, appointment_date, appointment_time, chief_complaint, status)
             VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
        );
        try {
            $stmt->execute([
                $patientId,
                $doctorId,
                $authUser['user_id'],
                $appointmentDate,
                $normalizedTime,
                $chiefComplaint !== '' ? $chiefComplaint : null
            ]);
        } catch (PDOException $pe) {
            if ($pe->getCode() == 23000 || (isset($pe->errorInfo[1]) && $pe->errorInfo[1] == 1062)) {
                $pdo->rollBack();
                send_error('The doctor already has an active appointment at that date and time.', ['appointment_time' => 'Time slot is already occupied.'], 409);
            }
            throw $pe;
        }
        $appointmentId = (int)$pdo->lastInsertId();

        $newCount = $currentCount + 1;
        $warning = null;
        if ($newCount >= 8 && $newCount <= 10) {
            $warning = "Clinic is near capacity ({$newCount} appointments today).";
        }

        // Triage vitals are optional; save them on the same visit row when provided
        if ($bloodPressure !== '' || $temperature !== '' || $oxygenSat !== '') {
            $vStmt = $pdo->prepare(
                "INSERT INTO vital_signs (appointment_id, blood_pressure, temperature, oxygen_saturation)
                 VALUES (?, ?, ?, ?)"
            );
            $vStmt->execute([
                $appointmentId,
                $bloodPressure !== '' ? $bloodPressure : null,
                $temperature !== '' ? (float)$temperature : null,
                $oxygenSat !== '' ? (float)$oxygenSat : null
            ]);
        }

        // Patient-reported intake allergy note update if provided
        if (array_key_exists('allergies_alerts', $input)) {
            $newAllergies = trim((string)$input['allergies_alerts']) ?: null;
            $curPatStmt = $pdo->prepare("SELECT allergies_alerts FROM patients WHERE patient_id = ?");
            $curPatStmt->execute([$patientId]);
            $curAllergies = $curPatStmt->fetchColumn();

            if ($newAllergies !== $curAllergies) {
                $updAllergy = $pdo->prepare("UPDATE patients SET allergies_alerts = ?, allergies_confirmed_by_doctor = 0 WHERE patient_id = ?");
                $updAllergy->execute([$newAllergies, $patientId]);

                log_audit($pdo, (int)$authUser['user_id'], 'UPDATE_ALLERGIES_AT_INTAKE', 'patient', $patientId, [
                    'allergies_alerts' => $curAllergies
                ], [
                    'allergies_alerts' => $newAllergies,
                    'allergies_confirmed_by_doctor' => 0,
                    'appointment_id' => $appointmentId
                ]);
            }
        }

        $pdo->commit();
        $resData = ['appointment_id' => $appointmentId];
        if ($warning !== null) {
            $resData['warning'] = $warning;
        }
        log_audit($pdo, (int)$authUser['user_id'], 'CREATE_APPOINTMENT', 'appointment', $appointmentId, null, [
            'patient_id' => $patientId,
            'doctor_id' => $doctorId,
            'appointment_date' => $appointmentDate,
            'appointment_time' => $normalizedTime,
            'chief_complaint' => $chiefComplaint !== '' ? $chiefComplaint : null,
            'has_vitals' => ($bloodPressure !== '' || $temperature !== '' || $oxygenSat !== '')
        ]);
        send_success('Appointment scheduled successfully.', $resData, 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// Cancel a booked visit (patient changed their mind / no longer waiting).
// Only scheduled or confirmed appointments can be cancelled; cancelling frees
// the doctor's slot because the duplicate-slot check ignores cancelled rows.
// NOTE (Priority 4): Doctors cannot cancel directly; only Receptionists cancel.
function cancelAppointment(PDO $pdo): void {
    $authUser = get_auth_user();
    $input = get_json_input();
    $appointmentId = (int)($input['appointment_id'] ?? ($_GET['id'] ?? 0));

    if ($appointmentId <= 0) {
        send_error('appointment_id is required.', [], 400);
    }

    $stmt = $pdo->prepare("SELECT appointment_id, doctor_id, patient_id, status FROM appointments WHERE appointment_id = ? LIMIT 1");
    $stmt->execute([$appointmentId]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment) {
        send_error('Appointment not found.', [], 404);
    }

    // DOCTORS CANNOT DIRECTLY CANCEL (Priority 4)
    if ($authUser['role_name'] === 'Doctor') {
        send_error('Doctors cannot directly cancel appointments. Please submit a cancellation request with a reason instead.', [], 403);
    }

    if ($appointment['status'] === 'completed') {
        send_error('Completed visits cannot be cancelled.', [], 409);
    }
    if ($appointment['status'] === 'cancelled') {
        send_error('This appointment is already cancelled.', [], 409);
    }
    if (!in_array($appointment['status'], ['scheduled', 'confirmed'], true)) {
        send_error('Only scheduled or confirmed appointments can be cancelled.', [], 409);
    }

    $reason = trim($input['reason'] ?? '') ?: 'Cancelled by front desk';

    $upd = $pdo->prepare("UPDATE appointments SET status = 'cancelled', cancel_requested = 0, cancel_request_reason = NULL, cancel_requested_at = NULL, cancel_requested_by = NULL WHERE appointment_id = ? AND status IN ('scheduled', 'confirmed')");
    $upd->execute([$appointmentId]);

    if ($upd->rowCount() === 0) {
        send_error('This appointment can no longer be cancelled.', [], 409);
    }

    log_audit($pdo, (int)$authUser['user_id'], 'CANCEL_APPOINTMENT', 'appointment', $appointmentId, [
        'status' => $appointment['status'],
        'patient_id' => (int)$appointment['patient_id'],
        'doctor_id' => (int)$appointment['doctor_id']
    ], [
        'status' => 'cancelled',
        'patient_id' => (int)$appointment['patient_id'],
        'doctor_id' => (int)$appointment['doctor_id']
    ], $reason);

    send_success('Appointment cancelled. The time slot is now available for rebooking.');
}

function requestCancelAppointment(PDO $pdo): void {
    $authUser = get_auth_user();
    if ($authUser['role_name'] !== 'Doctor') {
        send_error('Only doctors can submit a cancellation request.', [], 403);
    }

    $input = get_json_input();
    $appointmentId = (int)($input['appointment_id'] ?? ($_GET['id'] ?? 0));
    $reason = trim($input['reason'] ?? '');

    if ($appointmentId <= 0) {
        send_error('appointment_id is required.', [], 400);
    }
    if (mb_strlen($reason) < 5) {
        send_error('A cancellation reason of at least 5 characters is required.', ['reason' => 'Please provide a reason for the cancellation request.'], 422);
    }

    $docStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
    $docStmt->execute([$authUser['user_id']]);
    $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        send_error('Doctor profile not found.', [], 404);
    }

    $stmt = $pdo->prepare("SELECT appointment_id, doctor_id, patient_id, status FROM appointments WHERE appointment_id = ? LIMIT 1");
    $stmt->execute([$appointmentId]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment || $appointment['doctor_id'] != $doc['doctor_id']) {
        send_error('Unauthorized access to this appointment.', [], 403);
    }

    if ($appointment['status'] === 'completed') {
        send_error('Completed visits cannot be cancelled.', [], 409);
    }
    if ($appointment['status'] === 'cancelled') {
        send_error('This appointment is already cancelled.', [], 409);
    }

    $upd = $pdo->prepare(
        "UPDATE appointments 
         SET cancel_requested = 1, cancel_request_reason = ?, cancel_requested_at = NOW(), cancel_requested_by = ?
         WHERE appointment_id = ?"
    );
    $upd->execute([$reason, $authUser['user_id'], $appointmentId]);

    log_audit($pdo, (int)$authUser['user_id'], 'CANCEL_REQUEST', 'appointment', $appointmentId, [
        'patient_id' => (int)$appointment['patient_id'],
        'doctor_id' => (int)$appointment['doctor_id'],
        'status' => $appointment['status']
    ], [
        'cancel_request_reason' => $reason,
        'patient_id' => (int)$appointment['patient_id'],
        'doctor_id' => (int)$appointment['doctor_id']
    ], $reason);

    send_success('Cancellation request submitted. Receptionist will contact the patient to reschedule or cancel.');
}

function updateAppointment(PDO $pdo, int $appointmentId): void {
    $authUser = get_auth_user();
    
    // Doctors cannot edit or change status of appointments via this endpoint.
    if ($authUser['role_name'] === 'Doctor') {
        send_error('Doctors are not permitted to edit appointments. Please use the Consultation workspace.', [], 403);
    }

    $input = get_json_input();
    
    $patientId = (int)($input['patient_id'] ?? 0);
    $doctorId = (int)($input['doctor_id'] ?? 0);
    
    if ($patientId <= 0) send_error('Please choose a patient.', [], 422);
    if ($doctorId <= 0) send_error('Please choose a doctor.', [], 422);

    $pdo->beginTransaction();

    try {
        // Consistent lock order: lock target doctor first (prevents double booking races)
        $lockDoc = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? FOR UPDATE");
        $lockDoc->execute([$doctorId]);
        
        // Then lock the appointment row (prevents stale writes and concurrent status changes)
        $lockAppt = $pdo->prepare("SELECT * FROM appointments WHERE appointment_id = ? FOR UPDATE");
        $lockAppt->execute([$appointmentId]);
        $lockedAppt = $lockAppt->fetch(PDO::FETCH_ASSOC);
        
        if (!$lockedAppt) {
            $pdo->rollBack();
            send_error('Appointment not found.', [], 404);
        }

        // Terminal statuses cannot be edited.
        if (in_array($lockedAppt['status'], ['completed', 'cancelled', 'no_show'])) {
            $pdo->rollBack();
            send_error("Cannot modify an appointment that is already " . $lockedAppt['status'] . ".", [], 409);
        }

        // Derive remaining values from authoritative locked row
        $appointmentDate = isset($input['appointment_date']) ? trim($input['appointment_date']) : $lockedAppt['appointment_date'];
        $appointmentTime = isset($input['appointment_time']) ? trim($input['appointment_time']) : $lockedAppt['appointment_time'];
        $chiefComplaint  = isset($input['chief_complaint']) ? trim($input['chief_complaint']) : $lockedAppt['chief_complaint'];
        $status          = isset($input['status']) ? trim($input['status']) : $lockedAppt['status'];
        
        $updateVitals = false;
        $bloodPressure = null;
        $temperature = null;
        $oxygenSat = null;

        if (array_key_exists('blood_pressure', $input) || array_key_exists('temperature', $input) || array_key_exists('oxygen_saturation', $input)) {
            $updateVitals = true;
            $bloodPressure = isset($input['blood_pressure']) ? trim($input['blood_pressure']) : '';
            $temperature = isset($input['temperature']) ? trim((string)$input['temperature']) : '';
            $oxygenSat = isset($input['oxygen_saturation']) ? trim((string)$input['oxygen_saturation']) : '';
        }

        $errors = [];

        if ($patientId <= 0) $errors['patient_id'] = 'Please choose a patient.';
        if ($doctorId <= 0) $errors['doctor_id'] = 'Please choose a doctor.';

        $dateObj = DateTime::createFromFormat('Y-m-d', $appointmentDate);
        if (!$dateObj || $dateObj->format('Y-m-d') !== $appointmentDate) {
            $errors['appointment_date'] = 'A valid appointment date is required.';
        }

        $timeObj = DateTime::createFromFormat('H:i', $appointmentTime) ?: DateTime::createFromFormat('H:i:s', $appointmentTime);
        if (!$timeObj) {
            $errors['appointment_time'] = 'A valid appointment time is required.';
        }

        $normalizedTime = $timeObj ? $timeObj->format('H:i:s') : '';

        if (in_array($status, ['scheduled', 'confirmed'])) {
            if ($dateObj && $timeObj && $doctorId > 0) {
                $schedErr = validateDoctorSchedule($pdo, $doctorId, $appointmentDate, $normalizedTime);
                if ($schedErr !== null) {
                    $errors[$schedErr['field']] = $schedErr['message'];
                }
            }
        }

        $oldStatus = $lockedAppt['status'];
        $validTransitions = [
            'scheduled' => ['scheduled', 'confirmed', 'cancelled', 'no_show'],
            'confirmed' => ['confirmed', 'cancelled']
        ];
        if (!isset($validTransitions[$oldStatus]) || !in_array($status, $validTransitions[$oldStatus])) {
            $errors['status'] = "Invalid status transition from {$oldStatus} to {$status}.";
        }

        if ($updateVitals) {
            if ($bloodPressure !== '') {
                if (mb_strlen($bloodPressure) > 20 || !preg_match('/^([6-9]\d|1\d\d|2[0-5]\d)\/([4-9]\d|1[0-4]\d)$/', $bloodPressure)) {
                    $errors['blood_pressure'] = 'Blood pressure must be in SYS/DIA format (e.g., 120/80) with systolic 60-259 and diastolic 40-149.';
                }
            }
            if ($temperature !== '' && (!is_numeric($temperature) || (float)$temperature < 30 || (float)$temperature > 45)) {
                $errors['temperature'] = 'Temperature must be a number between 30 and 45 °C.';
            }
            if ($oxygenSat !== '' && (!is_numeric($oxygenSat) || (float)$oxygenSat < 0 || (float)$oxygenSat > 100)) {
                $errors['oxygen_saturation'] = 'Oxygen saturation must be a number between 0 and 100.';
            }
        }

        if (!empty($errors)) {
            $pdo->rollBack();
            send_error('Please correct the highlighted fields.', $errors, 422);
        }

        // Enforce constraint: Patient cannot be changed on an existing appointment
        if ((int)$lockedAppt['patient_id'] !== $patientId) {
            $pdo->rollBack();
            send_error('Patient cannot be changed on an existing appointment. Please cancel this appointment and create a new one.', [
                'patient_id' => 'Patient cannot be changed on an existing appointment.'
            ], 422);
        }

        // Validate FKs, allowing the existing IDs to be preserved even if they are now archived
        $pStmt = $pdo->prepare("SELECT patient_id FROM patients WHERE patient_id = ? AND (deleted_at IS NULL OR patient_id = ?) LIMIT 1");
        $pStmt->execute([$patientId, $lockedAppt['patient_id']]);
        if (!$pStmt->fetch()) {
            $pdo->rollBack();
            send_error('The selected patient is not available.', ['patient_id' => 'Patient not found or archived.'], 422);
        }

        $dStmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE doctor_id = ? AND (deleted_at IS NULL OR doctor_id = ?) LIMIT 1");
        $dStmt->execute([$doctorId, $lockedAppt['doctor_id']]);
        if (!$dStmt->fetch()) {
            $pdo->rollBack();
            send_error('The selected doctor is not available.', ['doctor_id' => 'Doctor not found or archived.'], 422);
        }

        $warning = null;
        // Check for double booking and capacity if status is active
        if (in_array($status, ['scheduled', 'confirmed'])) {
            $dupStmt = $pdo->prepare(
                "SELECT appointment_id FROM appointments
                 WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
                   AND status IN ('scheduled', 'confirmed')
                   AND appointment_id != ?
                 LIMIT 1"
            );
            $dupStmt->execute([$doctorId, $appointmentDate, $normalizedTime, $appointmentId]);
            if ($dupStmt->fetch()) {
                $pdo->rollBack();
                send_error('The doctor already has an active appointment at that date and time.', ['appointment_time' => 'Time slot is already occupied.'], 409);
            }

            // Daily clinic capacity check (max 10 active appointments clinic-wide per date)
            $capStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM appointments
                 WHERE appointment_date = ?
                   AND status IN ('scheduled', 'confirmed')
                   AND appointment_id != ?"
            );
            $capStmt->execute([$appointmentDate, $appointmentId]);
            $currentCount = (int)$capStmt->fetchColumn();

            if ($currentCount >= 10) {
                $pdo->rollBack();
                send_error('Daily clinic capacity reached (10 appointments max).', [], 409);
            }

            $newCount = $currentCount + 1;
            if ($newCount >= 8 && $newCount <= 10) {
                $warning = "Clinic is near capacity ({$newCount} appointments today).";
            }
        }

        $stmtUpdate = $pdo->prepare(
            "UPDATE appointments 
             SET patient_id = ?, doctor_id = ?, appointment_date = ?, appointment_time = ?, chief_complaint = ?, status = ?,
                 cancel_requested = 0, cancel_request_reason = NULL, cancel_requested_at = NULL, cancel_requested_by = NULL
             WHERE appointment_id = ?"
        );
        try {
            $stmtUpdate->execute([
                $patientId,
                $doctorId,
                $appointmentDate,
                $normalizedTime,
                $chiefComplaint !== '' ? $chiefComplaint : null,
                $status,
                $appointmentId
            ]);
        } catch (PDOException $pe) {
            if ($pe->getCode() == 23000 || (isset($pe->errorInfo[1]) && $pe->errorInfo[1] == 1062)) {
                $pdo->rollBack();
                send_error('The doctor already has an active appointment at that date and time.', ['appointment_time' => 'Time slot is already occupied.'], 409);
            }
            throw $pe;
        }

        if ($updateVitals) {
            if ($bloodPressure === '' && $temperature === '' && $oxygenSat === '') {
                $pdo->prepare("DELETE FROM vital_signs WHERE appointment_id = ?")->execute([$appointmentId]);
            } else {
                $vCheck = $pdo->prepare("SELECT vital_sign_id FROM vital_signs WHERE appointment_id = ?");
                $vCheck->execute([$appointmentId]);
                if ($vCheck->fetch()) {
                    $vUpdate = $pdo->prepare("UPDATE vital_signs SET blood_pressure = ?, temperature = ?, oxygen_saturation = ? WHERE appointment_id = ?");
                    $vUpdate->execute([
                        $bloodPressure !== '' ? $bloodPressure : null,
                        $temperature !== '' ? (float)$temperature : null,
                        $oxygenSat !== '' ? (float)$oxygenSat : null,
                        $appointmentId
                    ]);
                } else {
                    $vInsert = $pdo->prepare("INSERT INTO vital_signs (appointment_id, blood_pressure, temperature, oxygen_saturation) VALUES (?, ?, ?, ?)");
                    $vInsert->execute([
                        $appointmentId,
                        $bloodPressure !== '' ? $bloodPressure : null,
                        $temperature !== '' ? (float)$temperature : null,
                        $oxygenSat !== '' ? (float)$oxygenSat : null
                    ]);
                }
            }
        }

        $statusChanged = ($oldStatus !== $status);
        $scheduleChanged = ($lockedAppt['appointment_date'] !== $appointmentDate || $lockedAppt['appointment_time'] !== $normalizedTime);
        $doctorChanged = ((int)$lockedAppt['doctor_id'] !== $doctorId);
        $patientChanged = ((int)$lockedAppt['patient_id'] !== $patientId);
        $complaintChanged = ($lockedAppt['chief_complaint'] !== ($chiefComplaint !== '' ? $chiefComplaint : null));

        if ($statusChanged || $scheduleChanged || $doctorChanged || $patientChanged || $complaintChanged || $updateVitals) {
            $actionName = $statusChanged ? 'STATUS_CHANGE' : ($scheduleChanged ? 'RESCHEDULE_APPOINTMENT' : 'EDIT_APPOINTMENT');
            $oldVals = [
                'status' => $oldStatus,
                'appointment_date' => $lockedAppt['appointment_date'],
                'appointment_time' => $lockedAppt['appointment_time'],
                'doctor_id' => (int)$lockedAppt['doctor_id'],
                'patient_id' => (int)$lockedAppt['patient_id'],
                'chief_complaint' => $lockedAppt['chief_complaint']
            ];
            $newVals = [
                'status' => $status,
                'appointment_date' => $appointmentDate,
                'appointment_time' => $normalizedTime,
                'doctor_id' => $doctorId,
                'patient_id' => $patientId,
                'chief_complaint' => $chiefComplaint !== '' ? $chiefComplaint : null
            ];
            log_audit($pdo, (int)$authUser['user_id'], $actionName, 'appointment', $appointmentId, $oldVals, $newVals);
        }

        // Patient-reported intake allergy note update if provided
        if (array_key_exists('allergies_alerts', $input)) {
            $newAllergies = trim((string)$input['allergies_alerts']) ?: null;
            $curPatStmt = $pdo->prepare("SELECT allergies_alerts FROM patients WHERE patient_id = ?");
            $curPatStmt->execute([$patientId]);
            $curAllergies = $curPatStmt->fetchColumn();

            if ($newAllergies !== $curAllergies) {
                $updAllergy = $pdo->prepare("UPDATE patients SET allergies_alerts = ?, allergies_confirmed_by_doctor = 0 WHERE patient_id = ?");
                $updAllergy->execute([$newAllergies, $patientId]);

                log_audit($pdo, (int)$authUser['user_id'], 'UPDATE_ALLERGIES_AT_INTAKE', 'patient', $patientId, [
                    'allergies_alerts' => $curAllergies
                ], [
                    'allergies_alerts' => $newAllergies,
                    'allergies_confirmed_by_doctor' => 0,
                    'appointment_id' => $appointmentId
                ]);
            }
        }

        $pdo->commit();
        $resData = [];
        if ($warning !== null) {
            $resData['warning'] = $warning;
        }
        send_success('Appointment updated successfully.', $resData);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

