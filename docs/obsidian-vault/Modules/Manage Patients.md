---
tags: [module]
---

# Manage Patients

**Route:** `#patients` · **File:** `assets/js/modules/patients.js` · **Controller:** `api/patient_controller.php`

## Purpose
Maintain patient demographic records.

## UI
- Search (name, contact, address), gender filter, pagination, sortable columns.
- Add/Edit modal: first/last name, gender, date of birth, contact number, address.
- View modal (profile) and archive confirmation.

## Columns shown
Patient Name, Gender, Date of Birth, Contact No, Status, Actions.

## Validation
Server-side (`validatePatientInput`): required first/last name (max 80 chars), valid gender, valid past `date_of_birth`. Errors render inline in the modal.
