---
tags: [changelog]
---

# Changelog

A plain-English summary of major updates, new modules, and bug fixes across the project.

## Recent — Doctor Dashboard Portal & Clinical Workflow Implementation
### Doctor SPA Shell & Router
- Replaced the placeholder `doctor_dashboard.html` page with a full, mobile-friendly **Single-Page Application (SPA)** workspace and dedicated navigation router (`assets/js/doctor_main.js`) that supports parameterized links (`#doctor_consultation/{id}`) and checks doctor login permissions via `requireSession(['Doctor'])`.
- Built [[Doctor Dashboard]] (`assets/js/modules/doctor_overview.js`) showing live daily summary counters (**Total Appointments Today** and **Pending Consultations**).

### Appointments & Clinical Consultation
- Added [[Doctor Appointments]] (`assets/js/modules/doctor_appointments.js` + `api/appointment_controller.php`) filtered strictly to the logged-in doctor's `doctor_id`, complete with color-coded status badges and **Start Consult** / **View Encounter** buttons.
- Added [[Doctor Consultation]] (`assets/js/modules/doctor_consultation.js` + `api/consultation_controller.php` + `api/medication_controller.php`) so doctors can record clinical SOAP notes, multiple ICD-10 diagnoses, medication prescriptions (choosing from active `medications` with an unselectable `"Select Medication..."` prompt), and lab test requests inside a single all-or-nothing database transaction that marks the appointment `completed`.

### Patient Records & Doctor Profile
- Added [[Doctor Patient Records]] (`assets/js/modules/doctor_patients.js` + `api/doctor_patients_controller.php`) giving doctors a searchable, paged list of their assigned patients and a read-only visit history timeline protected by `403` ownership checks.
- Added [[Doctor Profile]] (`assets/js/modules/doctor_profile.js` + `api/doctor_profile_controller.php`) featuring a profile header card (with read-only clinical specialty badges) and two-column forms for updating personal details, `09XX XXX XXXX` phone number, username, and password (requiring current-password verification and immediately updating the top bar and session name).

### ITE 387 Coding & Writing Style Alignment
- Exported shared HTML and currency helpers (`create`, `gId`, `formatCurrency`) in `assets/js/ui.js` (`01 JavaScript Foundations/javascript_modules` & `03 APIs and Database Operations/header_detail_forms`).
- Added row **factory functions** (`createEmptyDiagnosis`, `createEmptyPrescription`, `createEmptyLabRequest`) and used `create('div')` in `assets/js/modules/doctor_consultation.js` (`01 JavaScript Foundations/javascript_objects_and_arrays`).
- Applied the *Create → Configure → Listen → Append* step-by-step row building pattern (`create('tr')` + row-scoped `tr.querySelector('.btn-start-consult')`) and standardized `res.message` error messages in `assets/js/modules/doctor_appointments.js` (`02 DOM and UI/dom_create_and_remove_elements` & `03 APIs and Database Operations/javascript_working_with_apis`).
- Added brief file-level comments across `config/db_connect.php`, `includes/response.php`, `api/*_controller.php`, and `assets/js/**/*.js` linking each file to its applied ITE 387 lessons, and updated file version numbers (**cache-busting**) to `?v=22`.

## Admin Dashboard UX Modernization, Validation, and Bug Fixes
### Manage Users & Doctors
- Added an optional Middle Initial field across the Add and Edit forms for users and doctors.
- Made "Select Gender" an unselectable prompt and added a custom gender text box that appears automatically when "Other" is chosen.
- Added live Philippine mobile number formatting (`09XX XXX XXXX` in a 4-3-4 pattern) with smart cursor tracking so Backspace, Delete, and pasting never make the cursor jump.
- Added password requirement helper text and enforced strong password rules (at least 6 characters, with uppercase, lowercase, number, and special character).
- Added accessible eye-icon buttons inside password boxes to show or hide typed passwords.
- Improved the Doctors table so multiple specialties wrap neatly as compact pill badges inside a 250px container.
- Matched server-side validation rules in `user_controller.php` and `doctor_controller.php`.

### Manage Patients
- Added an optional Middle Initial box to the Add and Edit Patient forms.
- Added the "Other" custom gender text input while keeping "Unknown" available for emergency room intake standards.
- Formatted patient phone numbers as `09XX XXX XXXX` with cursor tracking and 11-digit server validation.
- Updated the database column `patients.gender` to flexible text (`VARCHAR(50) DEFAULT 'unknown'`).

### Manage Archive Fixes
- Fixed `doctor_controller.php` default sorting so it starts with `'doctor_id'` before adding the `'d.'` table prefix, preventing SQL 1054 `d.d.doctor_id` errors.
- Added `LEFT JOIN users u` to the doctor count query so searching archived doctors by name works cleanly.

### Authentication & Shell
- Added a keyboard-accessible eye-icon show/hide password button to `login.php` / `login.html` with dynamic screen-reader (`aria-label`) updates.
- Bumped browser cache-busting version numbers to `?v=13`.

## `4d9045a` — Add admin overview dashboard, responsive UI, multi-select doctor specialties, and remove ID columns from tables
### Dashboard
- Added the [[Overview Dashboard]] module (`assets/js/modules/overview.js`) as the default home screen for Administrators.
- Added clickable summary cards (patients, doctors, staff, services, specialties, discounts) with animated loading placeholders, Quick Actions, and a "Recent Patient Registrations" table.

### Responsive shell
- Added a slide-out mobile sidebar menu with a hamburger button, darkened backdrop, `Escape` key closing, and automatic closing when a menu link is clicked.
- Added screen-size layout adjustments at `1024px`, `768px`, and `520px` so tables and toolbars fit cleanly on tablets and phones.
- Added keyboard focus outlines (`:focus-visible`) and support for users who prefer reduced animation (`prefers-reduced-motion`).

### Doctors & users
- Upgraded Clinical Specialty selection to a multi-select box (`Ctrl`/`Cmd` + click) in [[Manage Users]] and [[Manage Doctors]] so doctors can hold multiple specialties in the `doctor_specialty` linking table.
- Updated `user_controller.php` and `doctor_controller.php` to accept `specialty_ids[]` (while keeping single `specialty_id` support) and verify that every selected specialty is active.

### Tables
- Removed internal database ID columns from main list tables, the archive table, and detail pop-ups for a cleaner user view.
- Raised browser cache-busting version numbers to `?v=7`.

## `775979f` — test
## `0904117` — Initial commit: Hospital Billing and Patient Information System with Master Files, RBAC, and Centralized Archive
