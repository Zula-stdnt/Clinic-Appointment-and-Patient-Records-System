---
tags: [changelog]
---

# Changelog

A plain-English summary of major updates, new modules, and bug fixes across the project.

> [!info] Looking for the technical trail?
> This note summarizes **features**. For a per-commit record (commit IDs, exact files, verification steps), see [[Development Log]].

## 2026-10-18 — Appointments View Toolbar Alignment, Profile Dropdown Unresponsiveness Fix, Double-Cancel Elimination & Audit

### Appointments Module: View Dropdown Toolbar Integration
- **View Selection Dropdown:** Replaced the separate `.appointment-date-tabs` banner row above the appointments table with a clean `<select id="appointments-date-filter">` dropdown located directly inside `.toolbar-filters`.
- **Aligned with Rows Selector:** Styled the View dropdown with matching `<span class="text-muted">View:</span>` label and form-control styling, positioned side-by-side with the `<span class="text-muted">Rows:</span>` dropdown across both Receptionist and Doctor portals.
- **Dynamic Sorting & Filtering:** Selecting View options (`Upcoming`, `Today`, `Past`, `All`) seamlessly updates date filters and ordering (`ASC` for Upcoming/Today, `DESC` for Past/All) without page reload.

### Authentication & Shell: Profile Dropdown & Logout Resolution
- **Multi-Evaluation Double-Listener Fix:** Identified and resolved race condition in `assets/js/ui.js` where mismatched ES module version queries (`ui.js?v=25` vs `ui.js?v=24`) caused duplicate click event listeners, opening and instantly closing the profile menu on the same click.
- **Idempotency Guard:** Added `window.__cprms_ui_events_initialized` so document delegation listeners (`click`, `keydown`, `resize`) are guaranteed to attach only once across any module evaluations.
- **Unified Query Versioning:** Harmonized all 28 `ui.js` module imports across the codebase to `v=26` and all `api.js` imports to `v=8`.
- **Active Modal Shared State:** Synchronized modal state on `window.__cprms_active_modal` for seamless Escape-key handling across components.

### Receptionist Front Desk: Double-Cancel Elimination & Patient Name Locking
- **Double-Cancel Modal Prevention:** Updated confirmation dialogs in `receptionist_appointments.js`, `ui.js`, and `confirm-dialog.js` so the primary action button explicitly reads "Cancel Appointment" while the dismissal button reads "Keep Appointment" (or "Close" via global fallback), completely eliminating "Cancel" / "Cancel" confusion.
- **Safe Patient Name Formatting:** Fixed `undefined, undefined` patient name bug when cancelling appointments by adding `formatPatientName()` to safely parse last and first names.
- **Immutable Patient Name on Appointment Edit:** Disabled patient selection combobox in Edit Appointment mode (`patSelect.disabled = true`, `patientPicker.setDisabled(true)`) with helper hint to cancel and rebook if wrong patient was chosen. Backed by HTTP 422 Unprocessable Entity protection on `api/appointment_controller.php`.

### Dashboard Refresh Buttons Audit
- **Full Refresh Audit across 3 Dashboards:** Verified and hardened `#btn-refresh-dashboard` / `#btn-refresh-overview` across Admin, Doctor, and Receptionist portals.
- **Event Delegation Persistence:** Replaced brittle direct bindings with delegated click handlers on module containers so refresh listeners survive period tab switches (`Today`, `This Week`, `All-Time`).
- **Visual Feedback:** Animated SVG spinner and toast notifications on manual refresh.

### Clinical Data & Capacity Limits Seeding
- **Daily Appointment Ceiling:** Seeded realistic test appointments maintaining the 10-patient maximum capacity limit while leaving 1 slot available (max 9 booked) for realistic front-desk testing.
- **Status Integrity:** Ensured today's and upcoming appointments remain strictly in `scheduled` status (never completed or confirmed ahead of time).
- **Patient History:** Seeded 4 past appointment histories across patient records for complete timeline testing.

## Recent — UI/UX Fixes, Compact Icon-Only Action Buttons, No-Show Logic & Navbar Cleanup

### Receptionist Appointment Arrival & No-Show Logic
- **Arrival-Aware Action Visibility:** The "Mark as No Show" action in the Receptionist Appointments table is now hidden once a patient is confirmed to have arrived at the clinic (`appt.status === 'confirmed'`).
- **Backend Guard:** Enforced in `api/appointment_controller.php` where confirmed visits cannot transition to `no_show`.

### Compact Icon-Only Action Buttons Across 10 Tables
- **Clutter-Free Visual Design:** Replaced text-labeled action buttons with compact, color-coded icon-only buttons (`.btn-sm.btn-icon`) with unique SVG icons and informative tooltips (`title` / `aria-label`) across:
  - **Admin:** Manage Users, Manage Patients, Manage Doctors, Manage Specialties, Manage Services, Manage Medications, Manage Archive.
  - **Doctor:** My Appointments, Patient Records.
  - **Receptionist:** Patient Records.
- **Dedicated Outline & Icon CSS:** Styled `.btn-outline-primary`, `.btn-outline-secondary`, `.btn-outline-success`, `.btn-outline-danger`, `.btn-outline-warning`, and `.btn-outline-info` with standardized 28px square hit targets in `assets/css/style.css`.

### Global Navbar Cleanup (Eliminate Header Redundancy)
- **Topbar Simplification:** Removed duplicate module titles from the top navigation bar across all three dashboard shells (`admin_dashboard.html`, `doctor_dashboard.html`, `receptionist_dashboard.html`). Headers now live cleanly within the active workspace cards.
- **Browser Tab Sync:** Module navigation dynamically updates `document.title` to `${moduleTitle} - CAPRS`.

## Admin Audit Logs Module Improvements & Expanded Event Tracking

### UI/UX Scrollable Dropdown Menu with Quick Search Filter
- **Ergonomic Scrollable Action Filter:** Replaced default dropdown select with a responsive custom menu constrained to `max-height: 260px; overflow-y: auto;` featuring a thin scrollbar.
- **Categorized Optgroups:** Actions are organized into 4 intuitive categories (*Appointments & Clinical*, *Patient Records & Demographics*, *Security & Access Control*, *Administration & Staff*) with visual active-state indicators.
- **Instant Search Input:** Integrated a sticky `#audit-action-search` field at the top of the dropdown menu for real-time keystroke filtering across 30+ action options.
- **Full DOM Synchronization:** Mirrors selections to an underlying native `<select>` element to preserve test suite compatibility and keyboard navigation accessibility.

### Expanded Audit Event Tracking Across Appointments & Consultations
- **Appointment Events (`api/appointment_controller.php`):** Added distinct tracking for `RESCHEDULE_APPOINTMENT` (capturing previous and new schedule timestamps), `EDIT_APPOINTMENT` (field diffs of appointment changes), enriched `CREATE_APPOINTMENT` with chief complaints and vitals status, and detailed `CANCEL_APPOINTMENT` and `CANCEL_REQUEST` with clinical reasons.
- **Consultation Events (`api/consultation_controller.php`):** Logged `SAVE_CONSULTATION` and `UPDATE_CONSULTATION` on consultation entity with appointment, patient, and doctor IDs alongside clinical diagnosis, prescription, and lab request metrics. Enriched `ADD_ENCOUNTER_ADDENDUM` with patient, doctor, and encounter identifiers.
- **Doctor Schedule Events (`api/doctor_schedule_controller.php`):** Automatically logs `UPDATE_DOCTOR_SCHEDULE` on the doctor entity with active duty days and shift hours.

### Backend Data Integrity & Schema Normalization Resilience
- **Database Normalization Agnostic:** Joined `doctors` to `users` on `user_id` using `COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), 'Doctor')`, resolving `Unknown column 'first_name'` errors on normalized databases like `hospital_db_test`.
- **Target Entity Resolution:** Extended `api/audit_log_controller.php` to resolve consultation entity targets (`CONSULTATION #ID`) into their associated patient and doctor names.
- **Zero Undefined Values:** Upgraded `formatAuditDetails()` in `assets/js/modules/audit_logs.js` to render clean, readable sentences for all 30+ actions with zero `undefined` values or technical jargon.

## Doctor Consultation SOAP Format & Structured Prescriptions Revamp

### Clinical Notes SOAP Format (Subjective, Objective, Assessment, Plan)
- **Dedicated SOAP Clinical Panels:** Replaced the single unstructured notes textarea with 4 distinct, color-coded clinical cards:
  - **S · Subjective:** History of present illness (HPI), patient symptoms, onset, duration, aggravating/relieving factors, and pain scale.
  - **O · Objective:** Physical examination findings, clinical inspection, HEENT, chest, abdomen, extremities observations, with live triage vitals (BP, Temp, SpO2) referenced directly above.
  - **A · Assessment:** Clinical impression, differential/working diagnosis synthesis, disease severity, and clinical progress.
  - **P · Plan:** Treatment strategy, patient education, dietary/activity advice, return precautions, and follow-up timeline.
- **Zero-Duplicate Plan Shortcut (`⚡ Summarize Prescriptions in Plan`):** Integrated a one-click shortcut in the Plan section that automatically gathers all prescribed medications and generates a formatted, itemized bulleted summary into the Plan textarea. If updated, it refreshes the summary block without overwriting custom clinical notes or requiring doctors to type prescriptions twice.
- **Bi-directional Backward Compatibility:** Clinical notes are serialized into standardized clinical text with `SUBJECTIVE:`, `OBJECTIVE:`, `ASSESSMENT:`, `PLAN:` section tags for database storage (`consultation.notes`). Older legacy plain-text consultations seamlessly load into the *Subjective* section without data loss.

### Structured Prescriptions (Rx) Section
- **7-Field Structured Medication Orders:** Replaced the basic 3-field input with an ergonomic, structured prescription item card capturing:
  1. **Medication Name:** Type-ahead catalog search from `medications`.
  2. **Strength:** Specific strength concentration (e.g., `500 mg`, `250 mg/5 mL`, `10 mg`).
  3. **Dosage:** Unit dosage (e.g., `1 tablet`, `5 mL`, `2 capsules`).
  4. **Route:** Standardized clinical dropdown (`Oral (PO)`, `Sublingual`, `Topical`, `Inhalation`, `IM`, `IV`, `SC`, `Ophthalmic`, `Otic`, `Nasal`, `Rectal`, `Other`).
  5. **Frequency:** Standard clinical abbreviations and frequency intervals with instant datalist autocomplete (`OD`, `BID`, `TID`, `QID`, `Q4H`, `Q8H`, `QHS`, `PRN`).
  6. **Duration:** Treatment duration (e.g., `7 days`, `14 days`, `30 days`, `Ongoing`).
  7. **Additional Instructions / Timing:** Patient instructions (e.g., `Take after meals with plenty of water`, `Finish all antibiotics`).
- **Database Schema Migration (`014_structured_prescriptions.sql`):** Added `strength`, `route`, `duration`, and `instructions` to the `prescriptions` table with zero-downtime idempotent checks.

### Dedicated Laboratory & Diagnostic Requests Section
- **Dedicated Lab Card:** Retained and refined Laboratory & Diagnostic Requests as an independent section with quick-pick datalists for routine tests (e.g., `CBC with Platelet`, `FBS`, `Lipid Profile`, `Chest X-Ray`, `Urinalysis`).

### Downstream Parity: Printed Slips & Longitudinal Timeline
- **Print Prescription Slip (`print-prescription.js`):** Updated printed Rx slips to format medication strength, administration route, duration, and patient instructions.
- **Longitudinal Patient Records (`patient-record-view.js`):** Updated encounter timeline Prescriptions table with structured columns (`Medication & Strength`, `Dosage & Route`, `Frequency & Duration`, `Instructions`) and formatted SOAP section headers in Clinical Notes.

---

## Doctor Schedules, Form UX Constraints, and Dashboard Modernization

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

## Recent — Dashboard & Module Refresh Button Audit & Enhancements
- **Doctor Dashboard Resiliency:** Fixed the Doctor Dashboard Refresh button (`#btn-refresh-dashboard`), which previously lost its click event listener after switching time periods (Today / This Week / All-Time) due to DOM element replacement. Converted to delegated container event handling and guarded against duplicate listener registrations.
- **Receptionist Dashboard Resiliency:** Fixed the Receptionist Dashboard Refresh and Print Blank Form buttons with delegated event listeners so they remain functional after changing time horizon filters or pagination.
- **Admin Dashboard Refresh Button:** Added a matching `#btn-refresh-overview` Refresh button to the Administrator Overview Dashboard header, allowing administrators to refresh live stats and recent patient registrations without reloading the browser.
- **Visual Feedback & Spin Animation:** Added spinning SVG icon animations (`@keyframes spin`), disabled loading states, and toast notifications across all dashboard and list Refresh buttons (`overview.js`, `doctor_overview.js`, `receptionist_overview.js`, `doctor_appointments.js`, `receptionist_appointments.js`, `audit_logs.js`).

## Recent — Elimination of "Double Cancel" Confirmation Modals
- **Distinct Action & Dismissal Labels:** Resolved the confusing "double cancel" modal where cancelling an appointment showed two adjacent buttons both labeled `Cancel`. The modal now clearly differentiates the options:
  - Action button: `Cancel Appointment` (solid red danger button).
  - Dismissal button: `Keep Appointment` (secondary outline button).
- **Descriptive Titles & Context:** The status modal now displays explicit titles (e.g., `Cancel Appointment`, `Confirm Appointment Arrival`, `Mark Appointment as No Show`) and contextual messages referencing the patient's name and consequences (e.g., slot becoming available for rescheduling).
- **Core UI Safeguard in `ui.js`:** Enhanced `confirmAction` to accept `cancelBtnText` and implemented an automatic safety check: if any caller specifies an action button starting with `Cancel`, the dismissal button automatically defaults to `Close` or the custom label instead of repeating `Cancel`.
- **Form Discard Clarity:** Modal close confirmations for unsaved edits now feature `Keep Editing` instead of generic `Cancel` alongside `Discard`.

## Recent — Receptionist Appointments Patient Immutability
- **Patient Immutability on Edit:** In the Receptionist Edit Patient Appointment form, the patient combobox and underlying select input are locked and disabled (`is-disabled`), preventing inadvertent or unauthorized switching of the patient identity on existing visits.
- **Contextual Guidance:** Added clear helper text under the locked patient field advising staff: *"Patient cannot be changed. If booked for the wrong patient, cancel this visit and create a new appointment."*
- **Backend API Protection:** `api/appointment_controller.php` enforces that `PUT` updates cannot modify `patient_id` on existing appointments, returning HTTP 422 Unprocessable Entity with error message `Patient cannot be changed on an existing appointment. Please cancel this appointment and create a new one.`
- **New Appointments Unaffected:** When scheduling a new appointment, the patient combobox and "+ Register Walk-in" buttons remain fully accessible.

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
