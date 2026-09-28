---
tags: [module]
---

# Manage Doctors

**Route:** `#doctors` · **File:** `assets/js/modules/doctors.js` · **Controller:** `api/doctor_controller.php`

## Purpose
Allows Administrators to manage doctor profiles, their linked login accounts, and their assigned medical specialties.

## UI
- **Table toolbar & controls:** Search bar (searches doctor name, specialty, or phone number), specialty filter dropdown, and page navigation controls.
- **Doctors Table:** When a doctor has multiple specialties, the table displays them as neat, wrapping pill badges inside a compact container (`<div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 250px;">`) so rows stay aligned and the table does not stretch sideways.
- **Add/Edit pop-up form (modal):**
  - **First Name**, **Last Name**, and **Middle Initial** (optional, up to 5 characters).
  - **Gender** — Starts with an unselectable `"Select Gender"` prompt. Selecting `"Other"` reveals a text box for entering a custom gender.
  - **Clinical Specialties** — Multi-select list (`<select multiple size="6">`) with a hint explaining how to hold `Ctrl` or `Cmd` to select more than one specialty. At least one specialty is required.
  - **Contact Number** — Formats Philippine mobile numbers live as `09XX XXX XXXX` (4-3-4 grouping) with smooth cursor tracking.
  - **Username & Password:**
    - Displays helper text listing the password rules (at least 6 characters, including an uppercase letter, lowercase letter, number, and special character).
    - Includes an accessible eye-icon button to show or hide the password.
    - When editing an existing doctor, leaving the password blank keeps their current password unchanged.
- **Synchronized Accounts:** Creating or editing a doctor here automatically creates or updates their linked login row in the `users` table inside a single database transaction (login credentials and name fields live on `users`, while `doctors` and `doctor_specialty` store clinical details and specialties).
- **Archiving:** Confirming an archive action soft-deletes both the doctor profile and their linked user login account together.

## Specialties
- Supports choosing multiple specialties (`specialty_ids` array); at least one active specialty must be selected.
- When a doctor's specialties are updated, their old links in `doctor_specialty` are replaced with the newly selected set.
- The main table displays individual specialty badges, while the View Details pop-up lists the combined specialty names.

## Validation & Notes
- **Server Validation (`validateDoctorInput` in `api/doctor_controller.php`):**
  - Requires first and last name (up to 80 characters).
  - Validates `gender` (up to 50 characters).
  - Validates `contact_no` (must be 11 digits starting with `09` when provided).
  - Enforces the password complexity rule (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`) for new accounts or password changes.
- Calling `?meta=specialties` returns only active specialties.
- Permanently deleting a doctor from the Archive is blocked (`409 Conflict`) if patient appointments are linked to that doctor.
