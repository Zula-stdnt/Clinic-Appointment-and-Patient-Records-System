---
tags: [module]
---

# Manage Patients

**Route:** `#patients` · **File:** `assets/js/modules/patients.js` · **Controller:** `api/patient_controller.php`

## Purpose
Allows Administrators to register, view, update, and archive patient personal and contact records.

## UI
- **Table toolbar & controls:** Search bar (searches patient name, phone number, or home address), gender filter dropdown, sortable column headers, and page navigation controls.
- **Add/Edit pop-up form (modal):**
  - **First Name**, **Last Name**, and **Middle Initial** (optional, up to 5 characters).
  - **Gender** — Starts with an unselectable `"Select Gender"` prompt. Options are `Male`, `Female`, `Other`, and `Unknown`. Choosing `"Other"` reveals a custom gender text box (`#patient-custom-gender`). `"Unknown"` is included to support standard hospital emergency room intake when an arriving patient cannot yet be identified.
  - **Date of Birth** (required; must be a date in the past).
  - **Contact Number** — Formats Philippine mobile numbers live as `09XX XXX XXXX` (4-3-4 grouping) while keeping the cursor position steady during Backspace, Delete, and paste actions.
  - **Address** (optional home address).
- **View & Archive modals:** Read-only patient profile pop-up and a confirmation box for moving a patient record to the Archive.

## Columns shown
Patient Name, Gender, Date of Birth, Contact No, Status, Actions.

## Validation
- **In the browser (Client-side):** Checks that first name, last name, and birth date are filled in; requires custom text if `"Other"` gender is selected; and checks that any entered phone number has 11 digits starting with `09` (spaces are stripped automatically before sending).
- **On the server (`validatePatientInput` in `api/patient_controller.php`):**
  - Requires first and last name (up to 80 characters each).
  - Checks `gender` (up to 50 characters, stored in a `VARCHAR(50)` column so custom gender text fits cleanly).
  - Requires a valid past `date_of_birth`.
  - Checks `contact_no`: if provided, it must be 11 digits starting with `09`. Any field errors are returned and displayed directly inside the pop-up form.
