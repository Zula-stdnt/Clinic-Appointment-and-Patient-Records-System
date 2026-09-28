---
tags: [module]
---

# Manage Doctors

**Route:** `#doctors` · **File:** `assets/js/modules/doctors.js` · **Controller:** `api/doctor_controller.php`

## Purpose
Manage doctor profiles, their login account, and clinical specialties.

## UI
- Search (name, specialty, contact), specialty filter, pagination.
- **Doctors Table**: Multiple specialties are rendered as compact, wrapping badges (`<div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 250px;">`) to keep rows aligned and prevent horizontal stretching.
- **Add/Edit modal**:
  - First Name, Last Name, Middle Initial (optional, max 5 characters).
  - **Gender** — "Select Gender" disabled placeholder. Selecting "Other" dynamically displays a text input for specifying custom gender.
  - **Clinical Specialties** — `<select multiple size="6">` with Ctrl/Cmd multi-selection hint. At least one required.
  - **Contact Number** — formatted dynamically as `09XX XXX XXXX` (4-3-4 grouping) with smart cursor-tracking logic.
  - **Username & Password**:
    - Password helper text detailing complexity requirements (uppercase, lowercase, number, special character, min 6 characters).
    - Accessible eye-icon button to toggle password visibility.
    - On Edit Doctor, leaving password blank leaves the existing password unchanged.
- Create/Edit here creates or updates the linked `users` row (names/gender/credentials live on `users`, doctor profile holds specialties and `contact_no`).
- Archive confirmation (soft deletes both doctor and linked user).

## Specialties
- Multiple selection (`specialty_ids` array); at least one required; all must be active.
- On update the junction rows are deleted and re-inserted.
- Table displays wrapped badges; detail modal shows combined names.

## Validation & Notes
- **Server Validation** (`validateDoctorInput` in `api/doctor_controller.php`):
  - Enforces required first/last name (max 80 chars).
  - Enforces `gender` (max 50 chars).
  - Enforces `contact_no` (must be exactly 11 digits starting with `09` when provided).
  - Enforces password complexity regex (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`) for new accounts or updated passwords.
- `?meta=specialties` returns only active specialties.
- Hard delete is blocked when appointments reference the doctor (`409`).
