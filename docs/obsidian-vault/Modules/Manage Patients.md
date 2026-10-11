---
tags: [module]
---

# Manage Patients

**Route:** `#patients` · **File:** `assets/js/modules/patients.js` · **Controller:** `api/patient_controller.php`

## Purpose
Allows Administrators to review the patient directory, manage archiving, and inspect patient demographic cards.

## UI & Controls
- **Table Toolbar & Controls:**
  - **Search Bar:** Real-time search across patient name, contact number, and residential address.
  - **Gender Filter Dropdown:** `All Genders`, `Male`, `Female`, `Other` (properly matches all custom non-binary and other gender identities), and `Unknown`.
  - **Status Filter Dropdown:** `Active`, `Deleted` (archived), and `All`.
  - **Interactive Column Headers:** Clickable column headers (Patient Name, Gender, Date of Birth, Contact No, Status) with ascending/descending (`▲`/`▼`) direction indicators.
  - **Page Navigation:** Configurable page size (5, 10, 25 rows) with fixed arrow padding.
- **Record Action:**
  - Clicking **Record** opens the unified `patient-record-view.js` component in Administrative Governance mode, showing the patient's identity and demographic details while respecting clinical privacy.
- **Archive Action:**
  - Soft-deletes the patient record to [[Manage Archive]] with confirmation prompt.

## Columns Shown
Patient Name, Gender, Date of Birth, Contact No, Status (`.badge-status-*`), Actions.

## Validation & Query Logic
- **Gender Filter Query:** When `'other'` is selected, the server evaluates:
  ```sql
  (LOWER(TRIM(COALESCE(gender, ''))) NOT IN ('male', 'female', 'unknown') 
   AND LOWER(TRIM(COALESCE(gender, ''))) != '')
  ```
  ensuring all custom identities are gathered without returning empty tables.
- **Server Validation (`validatePatientInput` in `api/patient_controller.php`):**
  - Requires first and last name (up to 80 characters each).
  - Checks `gender` (up to 50 characters, stored in a `VARCHAR(50)` column so custom gender text fits cleanly).
  - Requires a valid past `date_of_birth`.
  - Validates `contact_no`: exactly 11 digits starting with `09`.
