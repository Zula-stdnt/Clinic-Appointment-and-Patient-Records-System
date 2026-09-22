<?php
// includes/auth.php
// Authentication, Session Security, Role-Based Access Control, and CSRF Protection

require_once __DIR__ . '/response.php';

function init_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isSecure,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_start();
    }

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

// Automatically initialize session on include
init_session();

function get_csrf_token(): string {
    return $_SESSION['csrf_token'] ?? '';
}

function verify_csrf_token(?string $token = null): bool {
    if ($token === null) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? null;
    }
    if (empty($token) || empty($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

function verify_csrf_on_state_change(): void {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
        if (!verify_csrf_token()) {
            send_error('Invalid or missing CSRF token.', [], 403);
        }
    }
}

function is_logged_in(): bool {
    return !empty($_SESSION['user_id']);
}

function get_current_user_role(): ?string {
    return $_SESSION['role_name'] ?? null;
}

function get_auth_user(): ?array {
    if (!is_logged_in()) {
        return null;
    }
    return [
        'user_id'   => $_SESSION['user_id'],
        'role_id'   => $_SESSION['role_id'] ?? null,
        'role_name' => $_SESSION['role_name'] ?? null,
        'username'  => $_SESSION['username'] ?? '',
        'full_name' => $_SESSION['full_name'] ?? ''
    ];
}

function is_api_request(): bool {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (strpos($uri, '/api/') !== false) {
        return true;
    }
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    return stripos($accept, 'application/json') !== false;
}

function require_login(): void {
    if (!is_logged_in()) {
        if (is_api_request()) {
            send_error('Authentication required.', [], 401);
        } else {
            header('Location: login.php');
            exit;
        }
    }
}

function require_role($allowedRoles): void {
    require_login();

    if (!is_array($allowedRoles)) {
        $allowedRoles = [$allowedRoles];
    }

    $currentRole = get_current_user_role();
    if (!in_array($currentRole, $allowedRoles, true)) {
        if (is_api_request()) {
            send_error('Access forbidden: insufficient role permissions.', [], 403);
        } else {
            http_response_code(403);
            header('Content-Type: text/html; charset=utf-8');
            echo '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body>';
            echo '<h1>403 Forbidden</h1><p>You do not have permission to access this page.</p>';
            echo '<p><a href="logout.php">Logout</a></p>';
            echo '</body></html>';
            exit;
        }
    }
}

// Basic login throttling
function check_login_throttle(): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = 'failed_attempts_' . md5($ip);

    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = ['count' => 0, 'last_attempt' => time()];
    }

    $data = &$_SESSION[$key];
    // Reset after 5 minutes of inactivity
    if (time() - $data['last_attempt'] > 300) {
        $data['count'] = 0;
        $data['last_attempt'] = time();
    }

    if ($data['count'] >= 10) {
        // Enforce progressive delay
        usleep(1000000); // 1-second delay
        return false;
    }

    if ($data['count'] >= 5) {
        usleep(500000); // 500ms delay
    }

    return true;
}

function record_failed_login(): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = 'failed_attempts_' . md5($ip);
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = ['count' => 0, 'last_attempt' => time()];
    }
    $_SESSION[$key]['count']++;
    $_SESSION[$key]['last_attempt'] = time();
}

function reset_login_throttle(): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = 'failed_attempts_' . md5($ip);
    unset($_SESSION[$key]);
}
