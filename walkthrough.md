# Development Walkthrough

This document records the major features, user-interface improvements, bug fixes, and code quality updates completed across the **Hospital Billing & Patient Information System**, written in plain English so both technical and non-technical readers can follow how the system evolved.

---

## 1. Users & Doctors Synchronization
- **Automatic Doctor Profile Creation (Backend):** Updated `user_controller.php` so that creating a staff account and creating their doctor profile happen inside a single **database transaction** (`PDO::beginTransaction` — an "all-or-nothing" save where every step must succeed, or the database automatically undoes the whole operation). Whenever an Administrator creates a User with the `Doctor` role, the system automatically creates a matching profile in the `doctors` table and links their medical specialties in the `doctor_specialty` table.
- **Matching Form Layouts (Frontend):** Updated the pop-up form (modal) in `users.js` to use the same clean, two-column grid layout (**CSS Grid**) as the form in `doctors.js`.

## 2. Modal Scrolling Fix
- **Why It Happened:** Pop-up forms (modals) used a flexible box layout (**CSS Flexbox**), but the `<form>` tag inside the pop-up interrupted that layout chain, and the scrollable middle section had no height limit. On smaller screens or tall forms, the Save and Cancel buttons at the bottom were pushed off the screen.
- **How It Was Fixed:** Updated `assets/css/style.css` so the `<form>` inside `.modal-dialog` uses `display: flex; flex-direction: column`, and gave `.modal-body` a strict maximum height (`max-height: calc(90vh - 160px)` — 90% of the screen height minus the header and footer). Now the middle of the form scrolls smoothly while the header and bottom action buttons always stay visible.

## 3. Manage Archive System
- **Centralized Recycle Bin:** Created the **Manage Archive** module (`assets/js/modules/archive.js`), which acts as a single recycle bin for the entire system.
- **Category Dropdown Filter:** Inside Manage Archive, administrators can pick which record type to inspect (Users, Doctors, Patients, Services, Specialties, or Discounts) from a dropdown menu. The table columns and rows automatically rebuild to match the chosen category.
- **Cleaner Main Screens:**
  - Removed the `Status` filter dropdown from all main management pages so active work screens only show active records.
  - Replaced the separate `Soft Delete`, `Restore`, and `Hard Delete` buttons on main pages with a single **Archive** button. Clicking **Archive** safely hides the record from active lists and moves it to the Archive.
  - Inside **Manage Archive**, administrators can either click **Restore** to return the record to active use, or click **Delete** (**Hard Delete**) to permanently remove it from the database.

## 4. Manage Archive Restore Confirmation Fix
- **Why It Happened:** Clicking the **Restore** button in `assets/js/modules/archive.js` originally called the `confirmSoftDelete` helper in `assets/js/ui.js`, which displayed misleading "Deactivate Record" warning text.
- **How It Was Fixed:**
  - Added a dedicated `confirmRestore` confirmation box in `assets/js/ui.js` with the title `Restore Record`, a clear message explaining that the record will return to active status, and a green `Restore` button (`btn-success`).
  - Updated `handleRestore` in `assets/js/modules/archive.js` to use `confirmRestore`.
  - Confirmed that clicking **Restore** sends a `PUT ...?action=restore` request to the server, clears the deletion timestamp (`deleted_at = NULL`) in the database, removes the item from the archive table, and returns it to the active module list.
  - Updated `confirmSoftDelete` in `assets/js/ui.js` to use clear "Confirm Archive" / "Archive Record" wording.
  - Bumped version numbers (**cache busters**) in `admin_dashboard.php` for `main.js` and `style.css` so browsers immediately load the updated scripts.

## 5. Middle Initial Field & Optional Labeling
- **Patient Middle Initial Support:**
  - Added a `middle_initial` input box to the Add and Edit Patient forms in `assets/js/modules/patients.js`.
  - Updated `api/patient_controller.php` to validate and save `middle_initial` into the `patients` database table.
- **Clear Optional Labels:**
  - Labeled the field as `Middle Initial (Optional)` across `Manage Patients`, `Manage Users`, and `Manage Doctors` so staff know they can leave it blank when a person does not have a middle initial.

## 6. Manage Users Form UX & Validation Enhancements
- **Unselectable Dropdown Prompts:**
  - Made "Select Gender" and "Select Role" disabled placeholder options so users cannot accidentally submit a form without choosing a real option.
- **Custom Gender Input ("Other"):**
  - Choosing "Other" in the Gender dropdown on the Add or Edit User form smoothly reveals a text box where staff can type a custom gender description.
  - Switching back to another option automatically clears and hides the custom box.
- **Phone Number Auto-Formatting & Cursor Fix:**
  - Automatically formats Philippine mobile numbers with spaces as `09XX XXX XXXX` (4-3-4 digit grouping) while typing, pasting, or editing a user.
  - Fixed a cursor-jumping issue by tracking how many digits sit before the cursor, so pressing Backspace, Delete, or replacing selected digits feels natural.
  - Strips spaces before sending the data to the server and checks on both the browser and the server that the number has exactly 11 digits starting with `09`.
- **Password Rules & Show/Hide Toggle:**
  - Added clear helper text explaining password rules (at least 6 characters, including an uppercase letter, a lowercase letter, a number, and a special character).
  - Enforced the password rule pattern (**regular expression**) in both the browser and `api/user_controller.php`.
  - Added an eye-icon button inside password fields so users can toggle between hidden dots and readable text, and kept the password optional when editing an existing user.

## 7. Database Schema Standardization & Synchronization
- **Flexible Gender Column:**
  - Updated the `gender` column in the `users`, `doctors`, and `patients` tables from a fixed list (`ENUM`) to flexible text (`VARCHAR(50) NOT NULL DEFAULT 'unknown'`) so custom gender entries can be saved without errors.
- **Database File & Documentation Sync:**
  - Exported the live database structure and starter data back into `migrations/hospital_db.sql` using `mysqldump`.
  - Verified that the live MySQL database, the visual diagram (`erd/hospital_erd2.drawio`), and the documentation (`docs/obsidian-vault/Database Schema.md`) all match.
- **Browser Cache Refresh:**
  - Updated file version numbers across `admin_dashboard.php`, `doctor_dashboard.php`, `receptionist_dashboard.php`, and `assets/js/main.js` so browsers load the newest JavaScript files right away.

## 8. Manage Patients UX Modernization
- **Middle Initial & Name Handling:**
  - Added the optional Middle Initial field to the Add and Edit Patient forms.
- **Gender Selection & Custom Gender ("Other"):**
  - Set "Select Gender" as a disabled prompt.
  - Selecting "Other" reveals a custom gender text input (`#patient-custom-gender`), while selecting another option clears and hides it.
  - Kept "Unknown" as a standard choice to follow hospital emergency intake standards (HL7/FHIR) when a patient arrives unidentified.
  - Editing a patient with a custom gender automatically selects "Other" and fills in their saved text.
- **Phone Number Formatting & Validation:**
  - Formats phone numbers live as `09XX XXX XXXX` (4-3-4 grouping) with smooth cursor tracking.
  - Removes spaces when saving and verifies in both the browser and `patient_controller.php` that any entered phone number is 11 digits starting with `09`.

## 9. Manage Doctors UI/UX Modernization
- **Neat Specialty Badges in the Table:**
  - Updated the Doctors table so doctors with multiple specialties display them as neat, wrapping pill badges inside a `max-width: 250px` container, keeping table rows compact instead of stretching the page sideways.
- **Add / Edit Doctor Form Improvements:**
  - Added the disabled "Select Gender" prompt and dynamic "Other" custom gender text box.
  - Added the `09XX XXX XXXX` mobile number formatter with cursor tracking.
  - Added password requirement helper text and the eye-icon show/hide password button, while allowing the password box to stay blank when editing an existing doctor.
- **Server-Side Validation (`doctor_controller.php`):**
  - Enforced the password complexity rule, the 11-digit `09` phone number rule, and the 50-character gender limit on the server.

## 10. Manage Archive Bug Fixes (Doctors Module)
- **Duplicate Table Prefix Fix (`d.d.doctor_id`):**
  - Fixed a bug in `doctor_controller.php` where leaving out the `sort_by` parameter caused the default value `'d.doctor_id'` to be prefixed a second time as `d.d.doctor_id`, triggering an SQL 1054 "Unknown column" error.
  - Changed the default fallback to `'doctor_id'` so the prefix step cleanly produces `d.doctor_id`.
- **Archived Doctor Name Search Fix:**
  - Added `LEFT JOIN users u ON d.user_id = u.user_id` to the total-count query in `doctor_controller.php`, fixing an error that occurred when searching archived doctors by first or last name.

## 11. Login Page Accessible Password Toggle
- **Show / Hide Password on Sign-In:**
  - Added an eye-icon button (`<button type="button">`) inside the password box on `login.php` / `login.html`.
  - Updates screen-reader labels (`aria-label` and `title`) between "Show password" and "Hide password".
  - Works with keyboard navigation (`Tab` to focus, `Space` or `Enter` to toggle) without accidentally submitting the login form.

## 12. Doctor Portal & Clinical Encounter Modules
- **Doctor Portal Shell & Navigation Router (`doctor_dashboard.html`, `assets/js/doctor_main.js`):**
  - Checks that a logged-in user has the `Doctor` role via `requireSession(['Doctor'])` (`assets/js/session-guard.js`) before showing the portal.
  - Supports URL hash links with parameters (such as `#doctor_consultation/{appointment_id}`) and provides a global `window.navigateTo(route)` helper so buttons inside one screen can open another screen.
- **Dashboard Overview (`assets/js/modules/doctor_overview.js`):**
  - Loads the logged-in doctor's appointments from `GET api/appointment_controller.php` (`res.data.items`), compares them against today's date, and displays two summary cards: **Total Appointments Today** and **Pending Consultations**.
- **Appointments Queue (`assets/js/modules/doctor_appointments.js`, `api/appointment_controller.php`):**
  - Combines (`JOIN`s) data from `appointments`, `patients`, `doctors`, and `users`, filtered strictly to the logged-in doctor's `doctor_id` so a doctor only sees their own schedule.
  - Shows color-coded status badges (`scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`) and an action button that says **Start Consult** for upcoming visits or **View Encounter** for completed visits.
- **Clinical Consultation (`assets/js/modules/doctor_consultation.js`, `api/consultation_controller.php`, `api/medication_controller.php`):**
  - Displays the patient's name, calculated age, gender, chief complaint, and triage `vital_signs` (`blood_pressure`, `temperature`, `oxygen_saturation`).
  - Provides a clinical notes box (`#cons-notes`) and dynamic multi-row sections for **Diagnoses** (`diagnosis`), **Prescriptions** (`prescriptions` linked to active `medications` with an unselectable `"Select Medication..."` prompt), and **Lab Requests** (`lab_requests`).
  - Saves the entire visit in one all-or-nothing database transaction (`$pdo->beginTransaction()`), creating or updating the main `consultation` record, replacing its child diagnosis/prescription/lab rows using `$consultationId`, and marking `appointments.status = 'completed'`.
- **Patient Records (`assets/js/modules/doctor_patients.js`, `api/doctor_patients_controller.php`):**
  - **List View (`?action=list`):** Lists unique patients who have appointments with the logged-in doctor (`INNER JOIN appointments`), complete with search and page controls.
  - **Medical Record Timeline (`?action=history&patient_id=X`):** Confirms the doctor is assigned to that patient (returning `403 Forbidden` if not) and displays the patient's profile card above a newest-first timeline of their consultations, vitals, clinical notes, diagnoses, prescriptions, and lab requests.
- **My Profile (`assets/js/modules/doctor_profile.js`, `api/doctor_profile_controller.php`):**
  - Displays a summary banner with the doctor's initial avatar, `DOC-XXXX` ID badge, and read-only specialty badges (`doctor_specialty`).
  - Saves changes to both the `users` and `doctors` tables in a single database transaction (updating personal details, `09XX XXX XXXX` phone number, unique username, and optional password change after checking `current_password`), and immediately refreshes `$_SESSION['full_name']` and the top navigation bar without requiring the doctor to log out and back in.

## 13. ITE 387 Lesson Style & Pattern Alignment
- **Shared Screen & Currency Helpers (`assets/js/ui.js`):**
  - Exported reusable helper functions—`create(tagName)` for building HTML elements, `gId(id)` for finding an element by its ID, and `formatCurrency(amount)` (`Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`) for formatting Philippine Peso amounts—following the course lessons in `01 JavaScript Foundations/javascript_modules` and `03 APIs and Database Operations/header_detail_forms`.
- **Factory Functions for Consultation Rows (`assets/js/modules/doctor_consultation.js`):**
  - Added small **factory functions** (`createEmptyDiagnosis`, `createEmptyPrescription`, `createEmptyLabRequest` — functions that return a fresh, blank data object with the right fields) from `01 JavaScript Foundations/javascript_objects_and_arrays`, and used `create('div')` when building each row on screen.
- **Create → Configure → Listen → Append Row Building (`assets/js/modules/doctor_appointments.js`):**
  - Built each appointment table row step-by-step: create the row with `create('tr')`, fill in its HTML content, attach the click listener to its `.btn-start-consult` button, and append it to the table (`02 DOM and UI/dom_create_and_remove_elements`), while reading server error messages consistently from `res.message` and `err.response?.data?.message` (`03 APIs and Database Operations/javascript_working_with_apis`).
- **Lesson Notes in Code & Cache Refresh:**
  - Added brief, accurate comments at the top of `config/db_connect.php`, `includes/response.php`, `api/*_controller.php`, and `assets/js/**/*.js` noting which ITE 387 course lessons (`01 JavaScript Foundations`, `02 DOM and UI`, `03 APIs and Database Operations`, `04 Database Design`) each file demonstrates.
  - Updated browser cache-busting version numbers to `?v=22` in `admin_dashboard.html`, `doctor_dashboard.html`, `assets/js/main.js`, and `assets/js/doctor_main.js`.

## 14. Receptionist Portal — Appointment Booking & Triage
- **Front-Desk SPA Shell (`receptionist_dashboard.html`, `assets/js/receptionist_main.js`):** Replaced the old "Coming Soon" placeholder with a full responsive workspace (off-canvas sidebar, top bar, hash routing) guarded by `requireSession(['Receptionist'])` so only signed-in receptionists can open it.
- **Book an Appointment ([[Receptionist Appointments]], `assets/js/modules/receptionist_appointments.js`):**
  - **New Appointment form (`#appointment-form-modal`):** Choose an active patient (with a `PAT-XXXX` friendly ID) and an active doctor (with specialty badges) from dropdowns, set the date and time, type the chief complaint, and optionally fill in triage vital signs (blood pressure, temperature in °C, and oxygen saturation in %).
  - **Live queue table:** Lists appointments newest-first with color-coded status badges and the recorded vitals; the search box and status dropdown filter rows instantly in the browser.
  - **Field-level errors:** Server validation responses (`422`) appear underneath the matching input with a red `is-invalid` outline, following the same pattern as the Admin forms.
- **Backend (`api/appointment_controller.php`):**
  - Added `POST`, which validates the request, checks that the patient and doctor are active, and blocks duplicate active bookings for the same doctor, date, and time (`409 Conflict`).
  - Follows the **Header-Detail Form** pattern (`03 APIs and Database Operations/header_detail_forms`): one `appointments` header row (`status = 'scheduled'`, `created_by` = signed-in user) is inserted together with an optional `vital_signs` detail row inside a single all-or-nothing transaction (`$pdo->beginTransaction()` / `$pdo->rollBack()`).
  - Added `GET ?meta=patients` and `GET ?meta=doctors` dropdown lookups, and the appointment list now `LEFT JOIN`s `vital_signs` so triage values flow into [[Doctor Consultation]] and [[Doctor Patient Records]].

## 15. Database Diagram Sync (Patient Records Requirements)
- **ERD Accuracy (`erd/hospital_erd2.drawio`):** Added the missing `patients.middle_initial` column and `medications.deleted_at` column, and corrected two relationship cardinalities to match the real constraints: `appointments → consultation` and `consultation → billing` are now **zero-or-one** (a visit may not have a consultation yet, and each consultation has at most one invoice).
- **Requirements coverage:** Verified the diagram covers the full **Patient Records System** flow — Appointment → Consultation → Diagnosis → (generated) Medical History — where medical history is assembled from the accumulated consultation/diagnosis records rather than stored in a separate table.
