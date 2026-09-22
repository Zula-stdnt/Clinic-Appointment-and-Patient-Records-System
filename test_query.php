<?php
require_once 'config/db_connect.php';

$tables = ['roles', 'users', 'patients', 'doctors', 'specialties', 'doctor_specialty', 'services', 'discounts', 'appointments', 'billing'];
foreach ($tables as $t) {
    try {
        $count = $pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
        $active = 0;
        $cols = $pdo->query("DESCRIBE $t")->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('deleted_at', $cols)) {
            $active = $pdo->query("SELECT COUNT(*) FROM $t WHERE deleted_at IS NULL")->fetchColumn();
        }
        echo "$t: total=$count, active=$active\n";
    } catch (Exception $e) {
        echo "$t: error " . $e->getMessage() . "\n";
    }
}

echo "\nSpecialties sample:\n";
print_r($pdo->query("SELECT * FROM specialties LIMIT 5")->fetchAll(PDO::FETCH_ASSOC));


