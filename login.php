<?php
// login.php
// Public entry point and login interface

require_once __DIR__ . '/includes/auth.php';

// If user is already logged in, redirect them to their respective dashboard
if (is_logged_in()) {
    $role = get_current_user_role();
    if ($role === 'Administrator') {
        header('Location: admin_dashboard.php');
        exit;
    } elseif ($role === 'Doctor') {
        header('Location: doctor_dashboard.php');
        exit;
    } elseif ($role === 'Receptionist') {
        header('Location: receptionist_dashboard.php');
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Hospital Billing & Patient Information System</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <script src="assets/js/axios.min.js"></script>
</head>
<body class="login-body">
    <div class="login-wrapper">
        <div class="login-card">
            <div class="login-header">
                <img src="logo.png" alt="Hospital Logo" class="login-logo">
                <h1>Hospital Billing &amp; Patient Information System</h1>
                <p class="login-subtitle">Sign in with your username and password</p>
            </div>

            <div id="login-alert" class="alert alert-danger" style="display: none;" role="alert"></div>

            <form id="login-form" novalidate>
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" class="form-control" autocomplete="username" required autofocus placeholder="Enter your username">
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" class="form-control" autocomplete="current-password" required placeholder="Enter your password">
                </div>

                <button type="submit" id="btn-login" class="btn btn-primary btn-block">
                    <span class="btn-text">Sign In</span>
                    <span class="btn-spinner" style="display: none;">Authenticating...</span>
                </button>
            </form>

            <div class="login-footer">
                <p class="text-muted text-center"><small>&copy; <?= date('Y') ?> Hospital Information System. All rights reserved.</small></p>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('login-form');
            const alertBox = document.getElementById('login-alert');
            const btnLogin = document.getElementById('btn-login');
            const btnText = btnLogin.querySelector('.btn-text');
            const btnSpinner = btnLogin.querySelector('.btn-spinner');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                alertBox.style.display = 'none';
                alertBox.textContent = '';

                const username = document.getElementById('username').value.trim();
                const password = document.getElementById('password').value;

                if (!username || !password) {
                    alertBox.textContent = 'Please enter both username and password.';
                    alertBox.style.display = 'block';
                    return;
                }

                btnLogin.disabled = true;
                btnText.style.display = 'none';
                btnSpinner.style.display = 'inline';

                try {
                    const response = await axios.post('api/auth_controller.php?action=login', {
                        username: username,
                        password: password
                    }, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.data && response.data.success) {
                        window.location.href = response.data.data.redirect || 'admin_dashboard.php';
                    } else {
                        throw new Error(response.data.message || 'Login failed.');
                    }
                } catch (err) {
                    let msg = 'Invalid username or password.';
                    if (err.response && err.response.data && err.response.data.message) {
                        msg = err.response.data.message;
                    }
                    alertBox.textContent = msg;
                    alertBox.style.display = 'block';
                } finally {
                    btnLogin.disabled = false;
                    btnText.style.display = 'inline';
                    btnSpinner.style.display = 'none';
                }
            });
        });
    </script>
</body>
</html>

