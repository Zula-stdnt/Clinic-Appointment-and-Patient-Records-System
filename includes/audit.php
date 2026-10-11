<?php
// includes/audit.php
// System-wide Compliance & Security Audit Logging
// Records critical events: demographic changes, emergency break-glass access, appointments, authentications, etc.

if (!function_exists('log_audit')) {
    function log_audit(
        PDO $pdo,
        int $userId,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        $oldValues = null,
        $newValues = null,
        ?string $reason = null
    ): bool {
        try {
            if ($userId <= 0) {
                $userId = (int)($_SESSION['user_id'] ?? 0);
            }
            if ($userId <= 0) {
                // Cannot log without a valid foreign key referencing users.user_id
                return false;
            }

            $oldStr = is_array($oldValues) ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : (is_string($oldValues) ? $oldValues : null);
            $newStr = is_array($newValues) ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : (is_string($newValues) ? $newValues : null);
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

            $stmt = $pdo->prepare(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, reason, ip_address, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())"
            );
            return $stmt->execute([
                $userId,
                $action,
                $entityType,
                $entityId,
                $oldStr,
                $newStr,
                $reason,
                $ip
            ]);
        } catch (Throwable $e) {
            error_log("Failed to write audit log: " . $e->getMessage());
            return false;
        }
    }
}

