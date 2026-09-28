# Development Walkthrough

## 1. Users & Doctors Synchronization
- **Backend Refactoring:** Refactored `user_controller.php` to securely wrap user creation and profile creation inside Database Transactions (`PDO::beginTransaction`). Whenever a User is created with the `Doctor` role, a linked clinical record is automatically created in the `doctors` and `doctor_specialty` tables.
- **Form Alignment:** Refactored the `users.js` modal to use the exact same modern, responsive 2-column CSS Grid layout as the `doctors.js` modal.

## 2. Modal Scrolling Fix
- **Root Cause Identified:** The main layout used CSS Flexbox inside the modals, but the nested `<form>` tag disrupted the flex chain. Additionally, the modal body lacked an absolute maximum height.
- **The Fix:** Updated `assets/css/style.css` to force the `<form>` inside `.modal-dialog` to adopt `display: flex; flex-direction: column`. Furthermore, gave `.modal-body` an explicit CSS calculation `max-height: calc(90vh - 160px)`. This ensures it mathematically cannot push the footer off-screen regardless of how large the form becomes.

## 3. Manage Archive System
- **Centralized Archive:** Created a new module called `Manage Archive` (`assets/js/modules/archive.js`). This acts as the universal recycle bin for the entire system.
- **Dropdown Entity Filter:** Inside the Archive module, administrators can select which table to view (Users, Doctors, Patients, Services, Specialties, Discounts) from a dropdown. The table columns and data dynamically rebuild themselves based on the selection.
- **Global UI Overhaul:**
  - Removed the `Status` filter dropdown from all main management pages. Main pages now *only* display active records natively.
  - Removed the `Soft Delete`, `Restore`, and `Hard Delete` buttons from all main pages.
  - Added a new, singular **Archive** button to all main pages. Clicking it safely hides the record and moves it to the Archive.
  - From the Archive, users can either **Restore** the record to return it to the main pages, or permanently **Hard Delete** it to purge it from the database.

## 4. Manage Archive Restore Confirmation Fix
- **Root Cause Identified:** The Restore button in `assets/js/modules/archive.js` previously invoked `confirmSoftDelete` from `ui.js`, which had hardcoded strings for deactivation ("Deactivate Record" button, warning alert).
- **The Fix:**
  - Added a dedicated `confirmRestore` modal utility function in `assets/js/ui.js` that displays `Restore Record` as the title, an informational notice about returning the record to active status, and a green `Restore` action button (`btn-success`).
  - Updated `handleRestore` in `assets/js/modules/archive.js` to call `confirmRestore`, ensuring the prompt and action button are clearly labeled "Restore".
  - Verified that clicking "Restore" dispatches the proper `PUT ...?action=restore` request, sets `deleted_at = NULL` in the database, removes the record from the archive table, and places it back in the active list.
  - Updated `confirmSoftDelete` in `assets/js/ui.js` to use "Confirm Archive" / "Archive Record" terminology as default.
  - Added cache busters in `admin_dashboard.php` for `main.js` and `style.css` to guarantee instant client update.

## 5. Middle Initial Field & Optional Labeling
- **Patient Middle Initial Integration:**
  - Added `middle_initial` input field to the Add/Edit Patient modal forms in `assets/js/modules/patients.js`.
  - Updated `api/patient_controller.php` to handle, validate, and persist `middle_initial` into the `patients` table.
- **Form Label Clarity:**
  - Marked the Middle Initial field explicitly as `Middle Initial (Optional)` across all relevant forms (`Manage Patients`, `Manage Users`, and `Manage Doctors`).
  - Retained optional validation across frontend forms and backend controllers.

## 6. Manage Users Form UX & Validation Enhancements
- **Disabled Placeholders:**
  - Made "Select Gender" and "Select Role" disabled placeholder options to prevent submitting empty/invalid selections while keeping role-specific visibility triggers intact.
- **Dynamic Custom Gender:**
  - Added dynamic display of a custom text input whenever "Other" is selected in Gender dropdowns across Add and Edit User modals.
  - Input auto-hides and clears when selecting another gender option.
- **Contact Number Input Masking & Cursor Fix:**
  - Automatically formats Philippine mobile numbers into `09XX XXX XXXX` (4-3-4 grouping) during typing, pasting, or pre-filling in Edit User.
  - Resolved cursor-jumping bug by implementing cursor-position tracking during input formatting, allowing Backspace, Delete, selection replacement, and pasting without re-inserting deleted spaces.
  - Validates strictly for exactly 11 digits starting with `09` on both client and server; strips formatting spaces before payload delivery and storage.
- **Password Strength & Visibility Toggle:**
  - Added helper text outlining password requirements (uppercase, lowercase, number, special character; minimum 6 characters).
  - Enforced password complexity regex on both frontend and backend (`api/user_controller.php`).
  - Added an accessible eye-icon toggle to switch password visibility between masked and clear text.
  - Preserved optional blank-password logic on Edit User so existing passwords are not overwritten unless intentionally changed.

## 7. Database Schema Standardization & Synchronization
- **Gender Column Modernization:**
  - Altered the `gender` column in `users`, `doctors`, and `patients` tables from `ENUM` to `VARCHAR(50) NOT NULL DEFAULT 'unknown'` to support custom gender entries without database rejection or truncation.
- **Database Dump & Documentation Sync:**
  - Re-synchronized `migrations/hospital_db.sql` via `mysqldump` to match the live schema, incorporating table alterations while preserving seed data and relationships.
  - Analyzed and confirmed architectural alignment across the live MySQL schema, the updated Draw.io logical ERD (`erd/hospital_erd2.drawio`), and the Obsidian schema documentation (`docs/obsidian-vault/Database Schema.md`).
- **Cache-Busting Maintenance:**
  - Updated cache-buster version queries across dashboard views (`admin_dashboard.php`, `doctor_dashboard.php`, `receptionist_dashboard.php`, `assets/js/main.js`) to guarantee clients fetch the latest JavaScript module code.

## 8. Manage Patients UX Modernization
- **Middle Initial & Name Handling:**
  - Added optional Middle Initial input to patient creation and edit modal forms.
- **Gender Selection & Custom Gender ("Other"):**
  - Configured "Select Gender" as a disabled placeholder.
  - Selecting "Other" dynamically displays a text field for custom gender entry (`#patient-custom-gender`).
  - Deselecting "Other" automatically clears and hides the custom input.
  - Preserved "Unknown" as a valid standard option adhering to clinical intake and HL7/FHIR healthcare standards for emergency/unidentified triage.
  - Data-binding in Edit Patient populates custom gender values seamlessly.
- **Contact Number Masking & Validation:**
  - Formats numbers in real-time as `09XX XXX XXXX` (4-3-4 digit grouping).
  - Implemented cursor-tracking logic calculating offset by digit count to enable natural Backspace, Delete, text selection replacement, and pasting without jumping cursor positions.
  - Strips spaces on form submission and validates on both client and server (`patient_controller.php`) that the number consists of exactly 11 digits starting with `09` when provided.

## 9. Manage Doctors UI/UX Modernization
- **Specialty Display in Table:**
  - Updated doctor table rendering to display multiple specialties as compact, stacked wrapping badges constrained within a `max-width: 250px` flex container, preventing horizontal table blowout.
- **Add / Edit Modal Enhancements:**
  - Configured "Select Gender" as a disabled placeholder and integrated the dynamic "Other" custom gender input field.
  - Implemented identical 4-3-4 Philippine mobile number formatting (`09XX XXX XXXX`) with smart cursor tracking.
  - Added password complexity requirements helper text (uppercase, lowercase, number, special character, min 6 characters).
  - Integrated an accessible eye-icon toggle button to switch password visibility between masked and clear text.
  - Retained optional blank password behavior when editing existing doctor accounts.
- **Backend API Validation (`doctor_controller.php`):**
  - Enforced password complexity regex on user creation and password updates.
  - Enforced exact 11-digit `09` format for contact numbers.
  - Enforced maximum string length (50 characters) for gender.

## 10. Manage Archive Bug Fixes (Doctors Module)
- **Default Sort Column Collision (`d.d.doctor_id`):**
  - Resolved a bug in `doctor_controller.php` where omitting `sort_by` caused the fallback `'d.doctor_id'` to fail an inequality check against `'doctor_id'`, erroneously prepending `d.` to yield `d.d.doctor_id` and throwing an SQL 1054 error.
  - Fixed fallback assignment to `'doctor_id'` so the standard table prefix logic correctly generates `d.doctor_id`.
- **Search Count Query Join:**
  - Added `LEFT JOIN users u ON d.user_id = u.user_id` to the count query in `doctor_controller.php`, preventing SQL column errors when searching archived doctors by first or last name.

## 11. Login Page Accessible Password Toggle
- **Password Visibility Control:**
  - Added an accessible eye-icon `<button type="button">` inside the password field on `login.php`.
  - Configured dynamic `aria-label` and `title` attributes switching between "Show password" and "Hide password".
  - Keyboard accessible (navigable via `Tab`, triggerable via `Space` / `Enter`) without submitting the form.
  - Kept state in sync with `<input type="password">` ↔ `<input type="text">` and eye SVG icons.

