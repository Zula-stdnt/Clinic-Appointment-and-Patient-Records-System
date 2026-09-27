<?php
// doctor_dashboard.php
// Placeholder route for Doctor role with strict session and role check

require_once __DIR__ . '/includes/auth.php';
require_role('Doctor');

$currentUser = get_auth_user();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doctor Portal - Coming Soon</title>
    <link rel="stylesheet" href="assets/css/style.css?v=13">
</head>
<body class="login-body">
    <div class="login-wrapper">
        <div class="login-card" style="text-align: center;">
            <img src="logo.png" alt="Hospital Logo" class="login-logo" style="margin: 0 auto 1.5rem auto; display: block;">
            <h2>Doctor Portal</h2>
            <p class="login-subtitle">Welcome, Dr. <?= htmlspecialchars($currentUser['full_name'] ?? 'Doctor', ENT_QUOTES, 'UTF-8') ?></p>
            <div class="alert alert-info" style="margin: 1.5rem 0; text-align: left;">
                <strong>Clinical Dashboard Coming Soon!</strong>
                <p style="margin: 0.5rem 0 0 0;">This portal is currently under active development. You will soon be able to manage patient consultations, electronic prescriptions, and diagnostic requests here.</p>
            </div>
            <a href="logout.php" class="btn btn-secondary btn-block">Sign Out</a>
        </div>
    </div>
</body>
</html>
