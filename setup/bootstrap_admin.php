<?php
/**
 * First-Administrator Bootstrap Script
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Security Error: This bootstrap script must be run from the command line.\n");
}

$config_path = __DIR__ . '/../config/db_connect.php';
if (!file_exists($config_path)) {
    die("Error: config/db_connect.php not found. Ensure the project is properly configured.\n");
}

require_once $config_path;

try {
    // Check if an admin already exists to prevent duplicate bootstrapping
    $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role_id = 1");
    if ($stmt->fetchColumn() > 0) {
        die("Bootstrap Aborted: An Administrator account already exists in the database.\n");
    }
    
    // Verify Administrator role exists in the roles table
    $stmt = $pdo->query("SELECT COUNT(*) FROM roles WHERE role_id = 1");
    if ($stmt->fetchColumn() == 0) {
        die("Bootstrap Error: The Administrator role does not exist. Please run seeds.sql first.\n");
    }

    echo "=== Patient Records System - Admin Bootstrap ===\n";
    echo "Username: ";
    $username = trim(fgets(STDIN));

    if (empty($username)) {
        die("Error: Username cannot be empty.\n");
    }

    echo "Password: ";
    if (!stream_isatty(STDIN)) {
        // Being piped in via an automated test or external runner
        $password = trim(fgets(STDIN));
    } else {
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $exe = "powershell -Command \"\$p = Read-Host -AsSecureString; \$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR(\$p); [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(\$BSTR)\"";
            $password = rtrim(shell_exec($exe));
        } else {
            system('stty -echo');
            $password = trim(fgets(STDIN));
            system('stty echo');
        }
    }
    echo "\n";
    
    if (empty($password)) {
        die("Error: Password cannot be empty.\n");
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Insert the first admin
    $stmt = $pdo->prepare("INSERT INTO users (role_id, first_name, last_name, username, password_hash) VALUES (1, 'System', 'Administrator', ?, ?)");
    $stmt->execute([$username, $hash]);

    echo "Success: Administrator account '$username' created securely.\n";
    echo "You may now log in to the application.\n";

} catch (PDOException $e) {
    die("Database Error: " . $e->getMessage() . "\n");
}
