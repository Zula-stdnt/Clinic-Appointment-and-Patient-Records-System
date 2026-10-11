<?php
// logout.php
// Clears session, expires session cookie, destroys session, sets no-store headers,
// and redirects with window.location.replace() to prevent history retention.
// ITE 387 Lessons applied: 02 State and Session Management/cookies_and_sessions (Cookie expiration & session destruction)

require_once __DIR__ . '/includes/auth.php';

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 86400,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

if (session_status() === PHP_SESSION_ACTIVE) {
    session_destroy();
}

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Location: login.html');
exit;
