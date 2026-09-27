<?php
// api/auth_controller.php
// Handles authentication endpoints: login, logout, and session status

require_once __DIR__ . '/../config/db_connect.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/auth.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? 'login');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

switch ($action) {
    case 'login':
        handle_login($pdo);
        break;

    case 'logout':
        handle_logout();
        break;

    case 'me':
        handle_me();
        break;

    default:
        send_error('Invalid action specified.', [], 400);
        break;
}

function handle_login(PDO $pdo): void {
    if (!check_login_throttle()) {
        send_error('Too many failed attempts. Please wait a moment before trying again.', [], 429);
    }

    $input = get_json_input();
    if (empty($input)) {
        $input = $_POST;
    }

    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    $errors = [];
    if ($username === '') {
        $errors['username'] = 'Username is required.';
    }
    if ($password === '') {
        $errors['password'] = 'Password is required.';
    }

    if (!empty($errors)) {
        send_error('Please fill in all required fields.', $errors, 422);
    }

    try {
        // Query users by username, joined to roles.
        // Soft-deleted users (deleted_at IS NOT NULL) are excluded as if the account did not exist.
        $stmt = $pdo->prepare(
            "SELECT u.user_id, u.role_id, 
                    CONCAT(u.last_name, ', ', u.first_name, IF(u.middle_initial IS NOT NULL AND u.middle_initial != '', CONCAT(' ', u.middle_initial, '.'), '')) AS full_name,
                    u.username, u.password_hash, u.deleted_at, r.role_name
             FROM users u
             INNER JOIN roles r ON u.role_id = r.role_id
             WHERE u.username = ? AND u.deleted_at IS NULL
             LIMIT 1"
        );
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        // Generic error message for both unknown username and wrong password
        $genericError = 'Invalid username or password.';

        if (!$user) {
            record_failed_login();
            send_error($genericError, [], 401);
        }

        if (!password_verify($password, $user['password_hash'])) {
            record_failed_login();
            send_error($genericError, [], 401);
        }

        // Role verification: only Administrator, Doctor, and Receptionist are allowed
        $allowedRoles = ['Administrator', 'Doctor', 'Receptionist'];
        if (!in_array($user['role_name'], $allowedRoles, true)) {
            record_failed_login();
            send_error('Access not permitted for this role.', [], 403);
        }

        // Login success: regenerate session ID to prevent session fixation
        session_regenerate_id(true);

        $_SESSION['user_id']   = (int)$user['user_id'];
        $_SESSION['role_id']   = (int)$user['role_id'];
        $_SESSION['role_name'] = $user['role_name'];
        $_SESSION['username']  = $user['username'];
        $_SESSION['full_name'] = $user['full_name'];

        // Fresh CSRF token
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

        reset_login_throttle();

        // Determine destination based on role
        $redirect = 'admin_dashboard.html';
        if ($user['role_name'] === 'Doctor') {
            $redirect = 'doctor_dashboard.html';
        } elseif ($user['role_name'] === 'Receptionist') {
            $redirect = 'receptionist_dashboard.html';
        }

        send_success('Login successful.', [
            'redirect'   => $redirect,
            'role'       => $user['role_name'],
            'full_name'  => $user['full_name'],
            'csrf_token' => $_SESSION['csrf_token']
        ]);
    } catch (PDOException $e) {
        error_log('Login error: ' . $e->getMessage());
        send_error('An unexpected error occurred during login. Please try again.', [], 500);
    }
}

function handle_logout(): void {
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();

    send_success('Logged out successfully.', [
        'redirect' => 'login.html'
    ]);
}

function handle_me(): void {
    if (!is_logged_in()) {
        send_error('Not authenticated.', [], 401);
    }

    send_success('Authenticated user data.', [
        'user'       => get_auth_user(),
        'csrf_token' => get_csrf_token()
    ]);
}
