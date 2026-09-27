<?php
$pdo = new PDO('mysql:host=localhost;dbname=hospital_db', 'root', '');
$stmt = $pdo->query('SELECT patient_id, first_name, middle_initial, last_name FROM patients ORDER BY patient_id DESC LIMIT 1');
print_r($stmt->fetch());
