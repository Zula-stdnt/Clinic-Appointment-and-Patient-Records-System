<?php
// includes/patient_validation.php
// Shared patient input validation used by both the Administrator patient CRUD
// (api/patient_controller.php) and the Receptionist walk-in registration
// (api/walkin_patient_controller.php), so the two entry points cannot drift apart.
// This file contains no authorization logic: each controller enforces its own role checks.

function validatePatientInput(array $input): array {
    $errors = [];
    $firstName = trim($input['first_name'] ?? '');
    $middleInitial = trim($input['middle_initial'] ?? '');
    $lastName  = trim($input['last_name'] ?? '');
    $gender    = trim($input['gender'] ?? 'unknown');
    $dob       = trim($input['date_of_birth'] ?? '');

    if ($firstName === '') {
        $errors['first_name'] = 'First name is required.';
    } elseif (strlen($firstName) > 80) {
        $errors['first_name'] = 'First name cannot exceed 80 characters.';
    }

    if ($middleInitial !== '') {
        if (!preg_match('/^[A-Za-z]$/', $middleInitial)) {
            $errors['middle_initial'] = 'Middle initial must be a single letter (A-Z).';
        }
    }

    if ($lastName === '') {
        $errors['last_name'] = 'Last name is required.';
    } elseif (strlen($lastName) > 80) {
        $errors['last_name'] = 'Last name cannot exceed 80 characters.';
    }

    if ($gender === '') {
        $errors['gender'] = 'Gender is required.';
    } elseif (strlen($gender) > 50) {
        $errors['gender'] = 'Gender cannot exceed 50 characters.';
    }

    if ($dob === '') {
        $errors['date_of_birth'] = 'Date of birth is required.';
    } else {
        $d = DateTime::createFromFormat('Y-m-d', $dob);
        if (!$d || $d->format('Y-m-d') !== $dob) {
            $errors['date_of_birth'] = 'Date of birth must be a valid date in YYYY-MM-DD format.';
        } elseif ($d > new DateTime()) {
            $errors['date_of_birth'] = 'Date of birth cannot be in the future.';
        }
    }

    $contactNo = trim($input['contact_no'] ?? '');
    if ($contactNo !== '') {
        if (!ctype_digit($contactNo) || strlen($contactNo) !== 11 || !str_starts_with($contactNo, '09')) {
            $errors['contact_no'] = 'Contact number must be exactly 11 digits and start with 09.';
        }
    }

    return $errors;
}
