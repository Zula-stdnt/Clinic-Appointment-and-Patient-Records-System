---
tags: [changelog]
---

# Changelog

A plain-English summary of major updates, new modules, and bug fixes across the project.

> [!info] Looking for the technical trail?
> This note summarizes **features**. For a per-commit record (commit IDs, exact files, verification steps), see [[Development Log]].

## Recent — Doctor Schedules, Form UX Constraints, and Dashboard Modernization

### Receptionist Form UX, Schedule Warnings & Zero-Retype Protection
- **Live Doctor Schedule Notice Badge:** Added an interactive inline `#doctor-schedule-notice` badge directly beneath the doctor selection combobox, immediately showing the assigned doctor's duty days (e.g. `Duty: Monday, Tuesday (08:00 - 17:00)`).
- **Option Dropdown Schedule Previews:** Enriched doctor combobox option labels to display scheduled rota days alongside their specialties.
- **HTML5 Date `min` Constraint:** Enforced `min="YYYY-MM-DD"` (today's local date) on the Appointment Date input, natively preventing selection of past months, years, or days in the calendar picker.
- **HTML5 Time Bounds:** Enforced `min="08:00"` and `max="17:00"` with 15-minute intervals (`step="900"`) on the Appointment Time input.
- **Proactive Client-Side Schedule Validation (`validateAppointmentScheduleLive()`):** Evaluates appointment inputs in real-time as the receptionist interacts with the form. Proactively blocks past dates and Sundays, verifies whether the chosen doctor is on duty on that specific weekday, and detects bookings during the 12:00–12:59 lunch pause.
- **Persistent Warning Banner (`#appt-schedule-warning-banner`):** Renders a prominent yellow warning banner with doctor duty details and an inline date field error whenever an off-duty day is picked.
- **Zero Form Loss & Zero Retyping Guarantee:** Proactive validation stops invalid form submissions before sending network requests; patient selections, chief complaint, allergies, and triage vitals inputs are never cleared or lost if a scheduling error occurs.

### Admin Manage Doctors Weekly Schedule Rota Configuration
- **Weekly Schedule Column:** Added a dedicated `Weekly Schedule` table column in the Manage Doctors module, rendering colored badges for each doctor's duty days and working hours.
- **Interactive Schedule Modal (`#doctor-schedule-modal`):** Added a "Schedule" action button with calendar icon to each doctor row, launching an interactive 7-day checklist modal with Day toggles and custom Start/End time pickers.
- **1-Click Rotation Presets:** Integrated one-click schedule presets aligned with the clinic's 3 attending physicians:
  - `Dr. House Rotation (Mon, Tue)`
  - `Dr. Grey Rotation (Wed, Thu)`
  - `Dr. Strange Rotation (Fri, Sat)`
  - `Full Week (Mon-Sat)`
  - `Clear All`
- **Backend Rota Management (`api/doctor_schedule_controller.php`):** Saves and retrieves weekly schedules via `doctor_schedules` table, validates shifts, and logs `UPDATE_DOCTOR_SCHEDULE` audit records.

### Overview Dashboard Modernization & Responsive Layout (100% Zoom)
- **Dedicated Chief Complaint Column:** Separated Chief Complaint from underneath the patient's name into its own column, styled with 2-line clamping (`-webkit-line-clamp: 2`), `overflow: hidden`, and native `title="..."` tooltips.
- **Standardized Stacked Triage Vitals:** Formatted BP, Temperature, and SpO2 readings as vertical stacked badges (`.vital-badge`) on the Receptionist Overview dashboard, matching the Doctor Dashboard layout.
- **100% Zoom Responsive Layout:** Eliminated horizontal scrollbar on standard displays at 100% browser zoom through optimized grid column sizing (`minmax(0, 2.35fr) minmax(260px, 1fr)`), compact table cell padding (`0.55rem 0.65rem`), and refined column width balance.
- **Custom Date Range Filter:** Added Start Date and End Date datepickers with an "Apply" button to both Receptionist Overview and Doctor Overview, alongside quick period filter pills (`All Time`, `Today`, `This Week`, `This Month`).
- **Rows per Page & Pagination:** Added a Rows per page selector (10, 25, 50) and responsive page controls to both overview tables.
- **Doctor Appointments Compact Actions:** Replaced the wide "Request Cancel" button with a compact ✕ icon button with tooltip.

### Hybrid Access Requests & Break-Glass Workflow
- **Two-Tier Record Access Control:** Implemented `api/access_request_controller.php` and migration `013_doctor_schedules_and_hybrid_break_glass.sql` (`record_access_requests`).
- **Standard Access Requests:** Doctors submit planned record access requests for non-assigned patients with clinical justification ($\ge 10$ chars); Administrators review and approve requests, granting a strictly time-bounded 24-hour access window.
- **Urgent Break-Glass Overrides:** Immediate emergency access bypasses the approval queue with a red alert banner, immediately writing to `audit_logs` and flagging the request for mandatory administrative post-access sign-off.

### Live Multi-Tab State Synchronization (`live-sync.js`)
- **Real-Time Cross-Tab Event Bus:** Added `assets/js/live-sync.js` which polls `api/appointment_controller.php?action=sync_state` every 5 seconds.
- **Automated Queue Refresh:** When appointment creations, status changes, or updates occur, `live-sync.js` detects revision state changes and dispatches a `cprms:sync` custom DOM event, automatically refreshing queues across all open browser tabs without manual reloads.

### Patient Record View Runtime Fix
- **Safe Record Initialization:** Fixed a runtime `ReferenceError: record is not defined` in `assets/js/components/patient-record-view.js` by safely initializing `const record = data || {};`.

## Recent — System Improvements, Clinical Privacy, and Modernization
### System-Wide Table Sorting, Filtering & Gender "Other" Resolution
- **Universal Interactive Table Sorting:** Clickable column headers across all tables in Admin, Doctor, and Receptionist portals with ascending/descending caret indicators.
- **Universal Gender Filter Fix:** Resolved the "Other" gender filter across all modules and controllers so selecting "Other" cleanly matches non-binary, transgender, and all custom gender identities without returning empty tables. Added the gender filter dropdown to Doctor Patient Records for full portal parity.

### Two-Stage Patient Allergy Workflow
- **Front-Desk Allergy Intake:** Receptionists can capture patient-reported allergies during booking or walk-in registration. The system marks them with an amber `Unconfirmed Intake Note` badge so clinical staff are alerted before consultations.
- **Doctor Clinical Confirmation:** Attending physicians see a prominent allergy banner during consultation and automatically elevate the allergy to `Doctor Confirmed` upon completing the visit.
- **Printed Slips & Safety Resets:** Physical intake slips display the allergy warning, and demographic updates safely reset confirmation to ensure doctor re-verification.

### Clinical Privacy Separation & Universal ID Masking
- **Demographics-Only Front-Desk Card:** Receptionists see a dedicated patient demographics profile card; clinical encounter histories and doctor notes are blocked on both client and server sides to protect patient privacy.
- **Universal Database ID Masking:** Removed visible database IDs and primary keys (`PAT-0001`, `APT-0042`, etc.) across all screens, headers, dialogs, and forms in favor of real-world patient names, birth dates, and contact numbers.

### Doctor Universal Directory & Break-Glass Emergency Protocol
- **Universal Patient Directory:** Doctors can browse all registered hospital patients, with clear `Assigned` vs `Unassigned` status indicators.
- **Audited Break-Glass Emergency Override:** Access to unassigned patients is locked by default. In medical emergencies, doctors can activate the Break-Glass protocol by entering a clinical justification, immediately opening the chart with an emergency alert banner and recording a permanent audit log entry.

### Immutable Audit Trail & Administrator Viewer
- **Permanent Compliance Logging:** Introduced an immutable `audit_logs` table tracking critical actions across the system (Break-Glass emergency access, patient demographic edits, and appointment status changes).
- **Admin Audit Viewer:** Dedicated Administrator module (`assets/js/modules/audit_logs.js`) with date range, user, action, and keyword filters.
- **Human-Readable Details Transformation:** Converted raw JSON strings and technical diff codes in the "Details / Reason" column into clear, friendly English sentences (e.g., "Doctor logged in", "Appointment created for patient Jose Rizal and assigned to Dr. Gregory House", "Appointment status changed from Scheduled to Confirmed").
- **Entity Name Enrichment:** Updated `api/audit_log_controller.php` to look up and attach real patient and doctor names, preventing cryptic database IDs from appearing in the log.
- **On-Demand Technical Diff Preview:** Added an expandable "View technical details" toggle to every row containing raw JSON, giving developers and IT auditors full forensic visibility without cluttering the clean view for non-coders.

### Receptionist Navigation & Permissions
- **Direct Dashboard Landing:** Configured Receptionists to land directly on the Overview Dashboard (`receptionist_overview.js`) upon login to review daily clinic volume and lobby queues before booking.
- **Doctor Read Permissions:** Granted Receptionists read-only access to doctor availability and specialties to resolve console errors on dashboard refresh.

### Design System Standardization
- **Permanent Status Badges:** Centralized semantic CSS status badge tokens (`.badge-status-*`) across all views.
- **Complete Emoji Elimination:** Replaced all informal emojis with lightweight Feather/Lucide inline SVG vector graphics sized consistently at 14x14px.

## Recent — Patient Records System & Clinic Operations
### Patient Records Core Flow (`Appointment → Consultation → Diagnosis → Medical History`)
- **Walk-in Patient Intake:** Receptionists can now register brand-new walk-in patients on the spot directly from the appointment booking modal with single-letter middle initial support, immediately selecting them for scheduling without navigating away.
- **Operating Hours & Sunday Closure:** Enforced clinic operating hours between 08:00 AM and 05:00 PM, blocked scheduling during the 12:00 PM to 12:59 PM lunch closure, and closed scheduling on Sundays.
- **Clinic-Wide Daily Capacity Model:** Transitioned clinic booking rules to a daily maximum of 10 appointments clinic-wide across all doctors, issuing a capacity warning at 8 to 10 daily visits and blocking further bookings once full.
- **Doctor Consultation Gating:** Protects clinical encounters so doctors can only open the consultation screen once the front desk confirms the appointment, displaying `Awaiting Confirmation` for scheduled visits.
- **Accumulated Medical History:** Doctor Patient Records now dynamically compiles and displays an accumulated, reverse-chronological timeline of all past encounters, clinical notes, vital signs, and ICD-10 diagnoses for each patient.
- **UI Polish:** Removed patient ID numbers from the appointment table rows to keep the view clean and centered on patient names, and sorted receptionist appointments nearest-first.

## Recent — Product & Hospital Branding Update
### Branding & Scope Alignment
- Renamed the product to **Hospital Patient Information System** across page titles (`index.html`, `login.html`, `admin_dashboard.html`, `doctor_dashboard.html`, `receptionist_dashboard.html`), the `README.md`, and project documentation to reflect its focus on clinical records and appointments rather than billing or cashiering.
- Updated the hospital brand name to **Healing for Everyone Hospital**, displaying **Healing for Everyone** in the sidebar brand header of the Admin, Doctor, and Receptionist portals.
- Removed outdated future billing and invoice printing milestones from the project [[Roadmap]], and clarified in [[Manage Discounts]] and [[Manage Services]] that money-handling workflows are no longer part of the active user interface.

## Recent — Receptionist Appointment Booking & Triage
- Replaced the placeholder `receptionist_dashboard.html` with a full **SPA shell** (`assets/js/receptionist_main.js`) guarded by `requireSession(['Receptionist'])`, with an off-canvas sidebar, top bar, and hash routing.
- Added [[Receptionist Appointments]] (`assets/js/modules/receptionist_appointments.js`): book a patient appointment by choosing an active patient and doctor, a date/time, and a chief complaint, with optional triage **vital signs** (blood pressure, temperature, oxygen saturation).
- Extended `api/appointment_controller.php` with:
  - `POST` — creates the `appointments` header row (`status = 'scheduled'`, `created_by` = signed-in user) and, when triage values are supplied, a linked `vital_signs` detail row in one database transaction; duplicate active bookings for the same doctor/date/time return `409 Conflict`.
  - `GET ?meta=patients` and `GET ?meta=doctors` — dropdown options for the booking form.
  - Triage vitals now appear in the appointment list (`LEFT JOIN vital_signs`), so the doctor portal shows them in [[Doctor Consultation]] and [[Doctor Patient Records]].
- Field-level `422` validation errors (patient, doctor, date, time, vitals ranges) are displayed under the matching form inputs.

## Doctor Dashboard Portal & Clinical Workflow Implementation
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
## `0904117` — Initial commit: Hospital Patient Information System with Master Files, RBAC, and Centralized Archive
