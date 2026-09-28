---
tags: [module]
---

# Manage Patients

**Route:** `#patients` · **File:** `assets/js/modules/patients.js` · **Controller:** `api/patient_controller.php`

## Purpose
Maintain patient demographic records.

## UI
- Search (name, contact, address), gender filter, pagination, sortable columns.
- **Add/Edit modal**:
  - First Name, Last Name, Middle Initial (optional, max 5 characters).
  - **Gender** — "Select Gender" disabled placeholder. Options: Male, Female, Other, Unknown. Selecting "Other" dynamically displays a custom gender text input (`#patient-custom-gender`). "Unknown" is retained for clinical/ER triage intake standards.
  - Date of Birth (required, must be past date).
  - **Contact Number** — formatted in real time as `09XX XXX XXXX` (4-3-4 grouping) with cursor-tracking logic for Backspace, Delete, and paste.
  - Address (optional).
- View modal (profile) and archive confirmation.

## Columns shown
Patient Name, Gender, Date of Birth, Contact No, Status, Actions.

## Validation
- **Client-side**: Required name and birth date; if "Other" gender is chosen, custom gender input is required. Contact number must be 11 digits starting with `09` if provided. Spaces are stripped before transmission.
- **Server-side** (`validatePatientInput` in `api/patient_controller.php`):
  - Required first/last name (max 80 chars).
  - `gender` validated (max 50 chars, supports custom strings stored in `VARCHAR(50)`).
  - Past `date_of_birth` required.
  - `contact_no` validated: if non-empty, must be exactly 11 digits starting with `09`. Errors render inline in the modal.
