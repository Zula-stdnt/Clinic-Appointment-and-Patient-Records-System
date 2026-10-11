---
tags: [module]
---

# Manage Doctors

**Route:** `#doctors` · **File:** `assets/js/modules/doctors.js` · **Controller:** `api/doctor_controller.php`

## Purpose
Allows Administrators to manage doctor profiles, their linked login accounts, and their assigned medical specialties. Receptionists have read-only access to doctor availability and specialties for dashboard widgets.

## UI & Controls
- **Table Toolbar & Controls:**
  - **Search Bar:** Real-time search across doctor name, specialty, or phone number.
  - **Specialty Filter Dropdown:** Filter by specific clinical specialty.
  - **Gender Filter Dropdown:** `All Genders`, `Male`, `Female`, `Other` (properly matches all custom non-binary and other gender identities cleanly).
  - **Status Filter Dropdown:** `Active`, `Deleted` (archived), and `All`.
  - **Interactive Column Headers:** Clickable headers (Doctor Name, Specialty, Contact No, Status) with `▲`/`▼` caret indicators.
  - **Page Navigation:** Standardized page size selector (5, 10, 25 rows per page).
- **Doctors Table:** Multiple specialties display as neat, wrapping pill badges inside a compact container (`max-width: 250px`).
- **Add/Edit Pop-Up Form (Modal):**
  - **First Name**, **Last Name**, and **Middle Initial** (optional, up to 5 characters).
  - **Gender** — Starts with an unselectable `"Select Gender"` prompt. Selecting `"Other"` reveals a text box for custom gender input.
  - **Clinical Specialties** — Multi-select list (`Ctrl` / `Cmd` + click) allowing assignment to one or more specialties.
  - **Contact Number** — Formatted live as `09XX XXX XXXX` with cursor tracking.
  - **Username & Password:**
    - Password rules helper text (at least 6 characters, uppercase, lowercase, number, special character).
    - Accessible eye-icon button to toggle password visibility.
    - Optional password field on edit (blank keeps existing password).
- **Synchronized Accounts:** Creates or updates linked login row in `users` and profile in `doctors` inside a single PDO transaction.
- **Archiving:** Soft-deletes both the doctor profile and linked user account together.

## Validation & Notes
- **Server Validation (`validateDoctorInput` in `api/doctor_controller.php`):**
  - Requires first and last name (up to 80 characters).
  - Validates `gender` (up to 50 characters).
  - Validates `contact_no` (11 digits starting with `09`).
  - Enforces password complexity rules.
- **Permissions:** `GET` list and read are permitted for `Administrator` and `Receptionist`. Modifying records (`POST`, `PUT`, soft delete, restore, hard delete) requires `Administrator`.
- **Foreign Key Safety:** Permanently deleting a doctor from the Archive is blocked (`409 Conflict`) if appointments are linked to that doctor.
