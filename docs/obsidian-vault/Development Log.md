---
tags: [development, log]
---

# Development Log

A running, per-commit record of every change and implementation in this project, written so the other developer can see **exactly what changed, when, and how to verify it**. High-level feature history lives in [[Changelog]]; this note is the technical trail that matches the Git history.

## How to record a change

1. Finish and commit your work following [[Team Sync]] (`git pull --rebase` → commit → `git pull --rebase` → `git push`).
2. Copy the template below to the top of **Entries**.
3. Fill in the **commit ID** (`git log --oneline -1`), the date, the files touched, and any IDs the change introduces (database tables/columns, API response IDs, new module keys).
4. If the database changed, name the migration file and remind readers to apply it ([[Database Migrations]]).
5. Commit the updated note with your change (or immediately after) so both land together.

### Entry template

```markdown
### YYYY-MM-DD — Short title (`<commit-sha>`)
**Type:** feat / fix / docs / chore
**Database / migrations:** none, or `migrations/00X_name.sql`
**Files changed:**
- `path/to/file` — what changed
**New IDs introduced:** table.column, API response fields, module route keys… (say "none" if not applicable)
**How to verify:**
- step-by-step check (login, URL, expected result)
```

> [!tip] Quick diff of any recorded change
> `git show --stat <commit-sha>` shows the files; `git show <commit-sha>` shows the exact lines.

## Entries

### 2026-10-16 — Admin Audit Logs Module Improvements, Scrollable Filter & Expanded Tracking (`working tree`)
**Type:** feat / fix / ui
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/audit_logs.js` — implemented custom scrollable dropdown menu with max-height 260px, thin scrollbar, 4-group categorizations (*Appointments & Clinical*, *Patient Records & Demographics*, *Security & Access Control*, *Administration & Staff*), active indicators, and real-time quick search input `#audit-action-search`; synchronized with underlying `<select id="audit-action-filter">`; expanded `formatAuditDetails()` for all 30+ actions with zero undefined artifacts.
- `assets/css/style.css` — added `.custom-dropdown-container`, `.custom-dropdown-menu`, `.custom-dropdown-item`, and search input styles for constrained action dropdown.
- `api/audit_log_controller.php` — joined `doctors` to `users` on `user_id` to ensure compatibility with normalized schemas where doctor names reside in `users`; added target resolution for `consultation` entities mapping to parent appointment, patient, and doctor names.
- `api/appointment_controller.php` — added granular audit logging for `RESCHEDULE_APPOINTMENT` and `EDIT_APPOINTMENT`; enriched `CREATE_APPOINTMENT`, `CANCEL_APPOINTMENT`, and `CANCEL_REQUEST` with patient and doctor IDs, chief complaint, and clinical reasons.
- `api/consultation_controller.php` — added `SAVE_CONSULTATION` and `UPDATE_CONSULTATION` audit logs on `consultation` entity with diagnosis, prescription, and lab request metrics; enriched `ADD_ENCOUNTER_ADDENDUM` with patient, doctor, and appointment IDs.
- `api/doctor_schedule_controller.php` — added `UPDATE_DOCTOR_SCHEDULE` audit logging on `doctor` entity with schedule count.
- `tests/verify_audit_logs_expansion.php` — 13-test automated verification suite covering normalized name resolution, appointment events, consultation events, API enrichment, and action filtering.
**New IDs introduced:** `.custom-dropdown-menu`, `#audit-action-search`, action keys `SAVE_CONSULTATION`, `UPDATE_CONSULTATION`, `RESCHEDULE_APPOINTMENT`, `EDIT_APPOINTMENT`
**How to verify:**
- Run `php tests/verify_audit_logs_expansion.php` (13/13 PASS).
- Log in as Administrator → navigate to Audit Logs:
  - Click the Action Filter dropdown → verify constrained scrollable list (max 260px) with category headers.
  - Type "Consultation" in search → verify instant filtering.
  - Verify all row details render clear English sentences with target patient and doctor names, with no "undefined" text.

### 2026-10-16 — Doctor Patient Consultation Form SOAP Notes & Structured Prescriptions Revamp (`e63d34a`)
**Type:** feat / clinical / ui
**Database / migrations:** `migrations/014_structured_prescriptions.sql`
**Files changed:**
- `assets/js/modules/doctor_consultation.js` — split consultation clinical notes into 4 distinct SOAP panels (Subjective, Objective, Assessment, Plan); added one-click "⚡ Summarize Prescriptions in Plan" button; overhauled Prescriptions into a 7-field structured card (Medication, Strength, Dosage, Route, Frequency, Duration, Instructions); maintained separate Lab Requests section.
- `includes/clinical_notes.php` — bidirectional SOAP parser and compiler ensuring backward compatibility with legacy plain text notes.
- `migrations/014_structured_prescriptions.sql` — added `strength`, `route`, `duration`, `instructions` columns to `prescriptions` table.
- `api/consultation_controller.php` — persists structured prescription attributes; compiles SOAP notes atomically.
- `assets/js/components/patient-record-view.js` — updated longitudinal encounter timeline with structured prescription table and SOAP headers.
- `assets/js/components/print-prescription.js` — formats strength, route, duration, and patient instructions on printed Rx slip.
- `tests/verify_consultation_soap_rx.php` — 5-test automated verification suite.
**New IDs introduced:** `prescriptions.strength`, `prescriptions.route`, `prescriptions.duration`, `prescriptions.instructions`, `compileSoapNotes()`, `parseSoapNotes()`
**How to verify:**
- Run `php tests/verify_consultation_soap_rx.php` (5/5 PASS).
- Log in as Doctor → Open active consultation:
  - Enter SOAP notes across S, O, A, P cards.
  - Add structured prescription item → click "⚡ Summarize Prescriptions in Plan" → verify auto-compiled bullet in Plan.
  - Save consultation and view completed encounter in Patient Records.
**Type:** feat
**Database / migrations:** `migrations/013_doctor_schedules_and_hybrid_break_glass.sql`
**Files changed:**
- `assets/js/modules/doctors.js` — added "Weekly Schedule" table column rendering colored duty day badges; added "Schedule" action button with calendar icon; created `#doctor-schedule-modal` with 7-day checkboxes and start/end time pickers; added 1-click rotation presets (`Dr. House Rotation (Mon, Tue)`, `Dr. Grey Rotation (Wed, Thu)`, `Dr. Strange Rotation (Fri, Sat)`, `Full Week`, `Clear All`); integrated with `api/doctor_schedule_controller.php`.
- `api/doctor_schedule_controller.php` — handles `GET ?doctor_id=X` and `POST` schedule array; enforces daily time boundaries; emits `UPDATE_DOCTOR_SCHEDULE` audit log.
- `api/doctor_controller.php` — enriched `GET` response items with `schedules` array and formatted `schedule_summary`.
**New IDs introduced:** `doctor_schedules` table, `api/doctor_schedule_controller.php`, modal `#doctor-schedule-modal`
**How to verify:**
- Log in as Administrator → navigate to Manage Doctors.
- Inspect the Weekly Schedule column showing duty days badges.
- Click "Schedule" on any doctor → test 1-click rotation presets → save and verify schedule badges update.

### 2026-10-14 — Receptionist Appointment Form Schedule Warnings, Date/Time Boundaries & Zero-Retype UX (`local`)
**Type:** feat / fix
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/receptionist_appointments.js` — added `#doctor-schedule-notice` inline badge beneath doctor combobox; enriched dropdown options with duty day badges; added calendar date `min="YYYY-MM-DD"` (today's date); added time bounds `min="08:00"` and `max="17:00"` (`step="900"`); implemented real-time `validateAppointmentScheduleLive()` displaying `#appt-schedule-warning-banner` and inline field error when an off-duty doctor, Sunday, or lunch hour is picked; guaranteed zero form resets on validation failure.
- `api/appointment_controller.php` — enriched `meta=doctors` payload with `schedules` and `schedule_summary`; strictly validates doctor duty days against `doctor_schedules`, clinic operating window, and daily capacity.
**New IDs introduced:** `#doctor-schedule-notice`, `#appt-schedule-warning-banner`, `validateAppointmentScheduleLive()`
**How to verify:**
- Run `php tests/verify_schedule_and_form_ux.php` (20/20 pass).
- Log in as Receptionist → New Appointment:
  - Select Dr. Gregory House → observe duty notice shows Mon, Tue (08:00 - 17:00).
  - Pick a Wednesday → observe immediate schedule warning banner and inline error.
  - Fill patient, triage vitals, and chief complaint → click "Schedule Appointment" → verify form inputs are never cleared.

### 2026-10-13 — Hybrid Break-Glass, Standard Access Requests & Live Multi-Tab Sync (`local`)
**Type:** feat
**Database / migrations:** `migrations/013_doctor_schedules_and_hybrid_break_glass.sql`
**Files changed:**
- `migrations/013_doctor_schedules_and_hybrid_break_glass.sql` — created `doctor_schedules` and `record_access_requests` tables; seeded multi-specialties and weekly rotas for clinic's 3 doctors.
- `api/access_request_controller.php` — created two-tier request controller: standard mode (requires Admin review, 24-hr grant) vs urgent break-glass mode (immediate access flagged for audit).
- `assets/js/live-sync.js` — created cross-tab revision polling helper; polls `api/appointment_controller.php?action=sync_state` every 5 seconds and dispatches `cprms:sync` custom event.
- `assets/js/modules/receptionist_overview.js`, `assets/js/modules/receptionist_appointments.js`, `assets/js/modules/doctor_overview.js` — subscribed to `cprms:sync` for auto-refreshing queues.
- `assets/js/components/patient-record-view.js` — fixed runtime `ReferenceError: record is not defined` via `const record = data || {};`.
**New IDs introduced:** `record_access_requests` table, `api/access_request_controller.php`, `assets/js/live-sync.js`, `cprms:sync` event
**How to verify:**
- Run `php tests/verify_todo_improvements.php` and `php tests/verify_acceptance.php`.
- Open two browser tabs: Receptionist booking in Tab 1 and Doctor Overview in Tab 2.
- Book an appointment in Tab 1 → observe Doctor Overview automatically refreshes without reloading.

### 2026-10-12 — System UI & Functional Improvements (Overview Tables, Date Range Filter, Vitals Alignment) (`local`)
**Type:** feat / style
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/receptionist_overview.js` — moved Chief Complaint to a dedicated table column with 2-line clamp and tooltip; standardized Triage Vitals into stacked `.vital-badge` chips matching Doctor Dashboard; added Start/End Date range picker with Apply button; added "All Time" period filter pill; added Rows per page selector (10, 25, 50).
- `assets/js/modules/doctor_overview.js` — updated queue table layout; added Start/End Date range filter; added Rows per page selector; subscribed to `cprms:sync`.
- `assets/js/modules/doctor_appointments.js` — restored Triage Vitals column; replaced text "Request Cancel" button with compact ✕ icon button with tooltip.
- `assets/css/style.css` — refined `.dashboard-columns` desktop grid template (`minmax(0, 2.35fr) minmax(260px, 1fr)`), table cell padding, and column width distribution to eliminate horizontal scrollbars at 100% zoom.
**New IDs introduced:** `.vital-badge`, `#overview-date-start`, `#overview-date-end`, `#overview-apply-range`, `#overview-page-size`
**How to verify:**
- Run `php tests/verify_ui_functional_improvements.php` (17/17 pass).
- View Receptionist Overview at 100% zoom: verify no horizontal scrollbar exists and Chief Complaint has its own column.

### 2026-10-11 — Human-Readable Audit Logs & Entity Name Enrichment (`6557204`)
**Type:** feat / fix
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/audit_logs.js` — added `formatAuditDetails(item)` helper to translate raw JSON payloads and technical diffs into natural, plain-English sentences for all 26 audit log actions (e.g., "Doctor logged in", "Appointment created for patient Jose Rizal and assigned to Dr. Gregory House", "Appointment status changed from Scheduled to Confirmed"); added expandable `<details>` section for optional inspection of raw JSON diffs; enriched target entity column with target names.
- `api/audit_log_controller.php` — added batch entity lookups to enrich paginated logs with patient names (`target_patient_name`), doctor names (`target_doctor_name`), and target entity names (`target_name`); parsed JSON strings in `old_values` and `new_values`.
- `assets/js/main.js` — incremented cache-busting query parameter for `audit_logs.js?v=2`.
- `docs/obsidian-vault/Modules/Compliance & Audit Logs.md` — created dedicated module documentation in the Obsidian vault.
**New IDs introduced:** none (read-only presentation enhancement; database schema and immutable JSON storage remain unchanged)
**How to verify:**
- Run `php tests/verify_improvements.php` (10/10 tests pass).
- Log in as Administrator → navigate to Compliance & Audit Logs:
  - Verify "Details / Reason" column shows plain English sentences without curly braces or JSON code.
  - Verify patient and doctor names appear in appointment and medical record rows.
  - Click "View technical details" under any modified record: original before-and-after JSON expands cleanly.

### 2026-10-11 — Universal Gender Filtering & "Other" Option Resolution (`b3f0bc2`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `api/patient_controller.php` — updated query for `gender=other` to match non-binary and custom entries: `(LOWER(TRIM(COALESCE(gender, ''))) NOT IN ('male', 'female', 'unknown') AND LOWER(TRIM(COALESCE(gender, ''))) != '')`.
- `api/doctor_controller.php` — applied identical `other` filter query logic.
- `api/doctor_patients_controller.php` — applied identical `other` filter query logic and added `gender` filtering parameter support.
- `api/user_controller.php` — applied identical `other` filter query logic.
- `assets/js/modules/doctor_patients.js` — added `#patients-gender-filter` selector (`All Genders`, `Male`, `Female`, `Other`, `Unknown`) to toolbar for full portal parity.
- `assets/js/modules/doctors.js` — aligned frontend gender filter dropdown options.
- `admin_dashboard.html`, `doctor_dashboard.html`, `receptionist_dashboard.html` — incremented cache-busting script version tags.
**New IDs introduced:** none
**How to verify:**
- Run `php tests/verify_gender_filters.php` (6/6 tests pass).
- In Admin → Manage Patients, Receptionist → Patient Directory, and Doctor → Patient Records, choose "Other": custom entries like "Transgender" and "Non-Binary" are correctly listed without empty tables.

### 2026-10-11 — Break-Glass Modal Direct Opening & Event Delegation Fix (`b3f0bc2`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/doctor_patients.js` — added `data-assigned="0"` to unassigned patient action buttons; clicking immediately opens `#break-glass-modal` without making a premature chart request that triggered a 403 error; replaced row-level listeners with container-level event delegation (`e.target.closest('.btn-break-glass')`) to stop event listeners from multiplying across table re-renders.
**New IDs introduced:** none
**How to verify:**
- Log in as Doctor → Patient Records → locate an Unassigned patient → click "Break-Glass": modal opens smoothly with zero console errors or screen flickers.

### 2026-10-11 — Two-Stage Patient Allergy Intake & Doctor Confirmation Workflow (`b3f0bc2`)
**Type:** feat
**Database / migrations:** none (columns `allergies_alerts` and `allergies_confirmed_by_doctor` pre-created in `setup/schema.sql`)
**Files changed:**
- `api/appointment_controller.php` — added `allergies_alerts` and `allergies_confirmed_by_doctor` to `meta=patients` and `getAppointmentById`; records allergy intake note and logs `UPDATE_ALLERGIES_AT_INTAKE` in audit logs.
- `api/appointment_patient_controller.php` — demographic updates reset `allergies_confirmed_by_doctor = 0`.
- `api/consultation_controller.php` — completing an encounter automatically elevates `allergies_confirmed_by_doctor = 1`.
- `assets/js/components/patient-register.js` — added allergy alert notes field to walk-in registration.
- `assets/js/modules/receptionist_appointments.js` — added allergy notes textarea with dynamic confirmation status badge to booking modal.
- `assets/js/modules/doctor_consultation.js` — added amber allergy alert banner and NKDA button to patient header.
- `assets/js/components/print-appointment-form.js` — formatted intake slip with allergy alert block and confirmation badge.
**New IDs introduced:** none
**How to verify:**
- Run `php tests/verify_allergy_workflow.php` (6/6 tests pass).
- Receptionist schedules patient with allergy → status shows amber "Unconfirmed Intake Note". Doctor completes consultation → status elevates to green "Doctor Confirmed".

### 2026-10-11 — Receptionist Dashboard Direct Landing & Doctor Controller Read Permission (`b3f0bc2`)
**Type:** feat / fix
**Database / migrations:** none
**Files changed:**
- `api/auth_controller.php` — login redirect response for Receptionists defaults to `#receptionist_overview`.
- `assets/js/receptionist_main.js` — router default route set to `receptionist_overview`.
- `api/doctor_controller.php` — granted Receptionists read-only (`GET`) access to doctor lists and specialties to populate dashboard metrics without 403 Forbidden errors.
**New IDs introduced:** none
**How to verify:**
- Log in as Receptionist: browser routes directly to Dashboard. Clicking "Refresh" loads data with 0 console errors.

### 2026-10-11 — Permanent Status Badge Design Tokens & Feather/Lucide SVG Icons (`b3f0bc2`)
**Type:** chore / style
**Database / migrations:** none
**Files changed:**
- `assets/css/style.css` — centralized semantic status badge tokens (`.badge-status-scheduled`, `.badge-status-confirmed`, `.badge-status-completed`, `.badge-status-cancelled`, `.badge-status-noshow`, `.badge-status-breakglass`). Standardized `.table-page-size` padding.
- All HTML dashboard shells & modules — removed all informal emojis and replaced with clean inline SVG vector graphics.
**New IDs introduced:** CSS classes `.badge-status-*`
**How to verify:**
- Inspect status badges across Admin, Doctor, and Receptionist portals: all colors and icon sizes are consistent and professional.

### 2026-10-11 — Universal Interactive Column Sorting & Filter Parity Across All Tables (`b3f0bc2`)
**Type:** feat
**Database / migrations:** none
**Files changed:**
- All frontend module files (`patients.js`, `doctors.js`, `users.js`, `services.js`, `specialties.js`, `medications.js`, `archive.js`, `audit_logs.js`, `doctor_appointments.js`, `doctor_patients.js`, `receptionist_appointments.js`, `receptionist_patients.js`).
- All API controllers — added safe column sorting allow-lists (`sort_by`, `sort_order`).
**New IDs introduced:** `data-sort` attributes on table header cells
**How to verify:**
- Click column headers on any table: rows sort A-Z on first click and Z-A on second click with visible caret indicators.

### 2026-10-11 — Clinical Privacy Separation, Universal Directory & Break-Glass Protocol (`b3f0bc2`)
**Type:** feat
**Database / migrations:** `migrations/011_create_audit_logs.sql`, `migrations/012_clinical_safety_and_constraints.sql`
**Files changed:**
- `assets/js/components/patient-record-view.js` — added `isReceptionist` guard to display demographic-only card and completely block clinical encounter history.
- `api/patient_record_controller.php` — blocks encounter history from Receptionists and enforces ownership gating on Doctors.
- `api/doctor_patients_controller.php` — lists all hospital patients with "Assigned" / "Unassigned" badges; implements `action=break_glass`.
- `includes/audit.php` & `api/audit_log_controller.php` — permanent audit logging for break-glass emergency access, demographic changes, and appointment cancellations.
- `assets/js/modules/audit_logs.js` — Administrator audit log viewer with multi-filter controls.
- All frontend modules — universal ID masking (removed `PAT-XXXX`, `APT-XXXX` from all visible labels).
**New IDs introduced:** `audit_logs` table, `consultation_addenda` table
**How to verify:**
- Run `php tests/verify_todo_improvements.php` (8/8 tests pass).
- Run `php tests/verify_improvements.php` (10/10 tests pass).

### 2026-10-11 — Foundational Bug Fixes & Session Check Probe (`b3f0bc2`)
**Type:** fix
**Database / migrations:** `migrations/008_icd10_catalog.sql`, `migrations/009_prescriptions_time_to_take.sql`
**Files changed:**
- `api/auth_controller.php` — added `action=check` probe returning 200 OK `{ logged_in: false }` to eliminate red 401 console errors on `login.html`.
- `assets/js/login.js` — uses probe check on page load.
- `api/patient_record_controller.php` — handles `time_to_take` and `icd10_codes` cleanly with schema fallbacks to prevent 500 crashes.
- `assets/js/modules/doctor_appointments.js` — replaced `display: flex` on `<td>` with standard `.actions-cell` to fix row distortion.
- `assets/js/modules/receptionist_appointments.js` — fixed walk-in registration modal structure and converted action buttons to compact icon buttons.
**New IDs introduced:** `api/auth_controller.php?action=check`
**How to verify:**
- Open `login.html`: console displays zero red network errors.
- Doctor appointments table rows render evenly aligned.

### 2026-10-05 — Compact appointment row actions (`ad7657d`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/receptionist_appointments.js` — **Print Form** and **Cancel** are now icon-only buttons (with `title` and `aria-label`), so the Actions column no longer squeezes the Patient/Doctor columns into wrapping and making every row taller.
- `assets/js/modules/doctor_appointments.js` — **Cancel** is icon-only; Start Consult / View Encounter keeps its text label.
- `assets/css/style.css` — added `.btn-icon` sizing and kept `.actions-cell` on a single line.
**How to verify:**
- Receptionist → Appointments and Doctor → My Appointments: rows are back to a single compact line; hover an icon to see its tooltip.

### 2026-10-05 — Compact patient record visit cards (`0f11ab0`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `assets/js/components/patient-record-view.js` — the diagnosis/prescription/lab counters now sit on the existing summary line instead of their own line, removing the extra height each visit card had gained.
- `assets/css/style.css` — tightened encounter card padding, header spacing, grid gap, vitals margin, and action row spacing.
**How to verify:**
- Open any patient record: each visit card is shorter while keeping the counters; search, filters, collapse/expand, and printing are unchanged.

### 2026-10-05 — Appointment cancellation for front desk and doctors (`b48c675`)
**Type:** feat
**Database / migrations:** none
**Files changed:**
- `api/appointment_controller.php` — new `PUT ?action=cancel&id`: cancels **Scheduled** or **Confirmed** visits; returns `409` for completed or already-cancelled visits; Administrators/Receptionists may cancel any visit, Doctors only their own (`403` otherwise). Cancelling frees the doctor's slot for rebooking.
- `assets/js/components/confirm-dialog.js` — **new** reusable confirmation dialog for destructive actions, built on the existing modal styles (no change to `ui.js`).
- `assets/js/modules/receptionist_appointments.js` — red **Cancel** action on scheduled/confirmed rows with a confirmation dialog, warning toast, and list refresh.
- `assets/js/modules/doctor_appointments.js` — same Cancel action for the doctor's **own** list.
- `docs/obsidian-vault/Modules/Receptionist Appointments.md` — documented the cancellation flow.
**How to verify:**
- Receptionist → Appointments → **Cancel** a scheduled visit → confirm: the row turns **Cancelled** and the slot can be rebooked at the same date/time.
- Doctor → My Appointments → Cancel works on own visits; another doctor's appointment returns `403`.
- Completed visits and repeat cancellations return `409`; anonymous requests return `401`.

### 2026-10-05 — Searchable, collapsible patient record timeline (`1152f50`)
**Type:** feat
**Database / migrations:** none
**Files changed:**
- `assets/js/components/patient-record-view.js` — added an in-record search that matches diagnosis name/ICD-10 code, medicine, lab test, doctor, chief complaint, clinical notes, and dates, with a **Showing X of Y visits** count. Each visit card can collapse to a one-line summary (`2 diagnoses · 1 prescription · 2 lab requests`) and there is a **Collapse All / Expand All** toggle. Status filter chips and print actions are unchanged and work together with the search.
- `assets/css/style.css` — styles for the search/filter row, chevron rotation, collapsed cards, and visit counters.
- `docs/obsidian-vault/Modules/Patient Records.md` — documented the new controls.
**How to verify:**
- Open any patient record with several visits; type `dengue`, a medicine, or a lab test: only matching visits remain with the count shown.
- Click a visit header (or press Enter/Space) to collapse it; **Collapse All** compacts the timeline for scanning.

### 2026-10-05 — Manage Services modal fix (`cc76726`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/services.js` — the Add/Edit and View dialogs used `class="modal-backdrop"` (a class with no CSS) and `data-close-modal` (an attribute `ui.js` does not handle), so their content rendered inline below the table instead of as a centered dialog. Both now use the standard `.modal` > `.modal-content` structure with `data-dismiss="modal"` close buttons.
- System-wide scan: every other module, component, and dashboard shell already used the correct structure; no remaining `modal-backdrop` or `data-close-modal` usages exist.
**How to verify:**
- Administrator → Manage Services → **Edit** / **View**: the dialog opens centered over a dark backdrop and closes via X, Cancel/Close, backdrop click, or Escape.

### 2026-10-05 — Manage Patients uses the full patient record as its only view (`fbdd911`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `assets/js/modules/patients.js` — removed the small Patient Profile modal and its **View** button. **Record** now opens the shared patient record screen (with **Edit Patient Info** inside), identical to the doctor and receptionist portals. The **Manage Patients** sidebar name plus its Edit and Archive capabilities are unchanged.
**How to verify:**
- Administrator → Manage Patients: row actions are **Record / Edit / Archive**; Record shows the full visit timeline and prints.

### 2026-10-05 — Patient record layout + admin edit from record (`5f95389`)
**Type:** fix
**Database / migrations:** none
**Files changed:**
- `assets/css/style.css` — encounter cards now carry their own padding (the shared `.card` class has none) and record tables use wider cell padding, so text no longer sits flush against the left border.
- `assets/js/components/patient-record-view.js` — optional **Edit Patient Info** action in the toolbar (shown only when the host module provides it).
- `assets/js/modules/patients.js` — Administrator-only edit from inside the record; after saving, the open record refreshes in place. The **Manage Patients** name and its edit/archive capabilities are unchanged.
**How to verify:**
- Administrator → Manage Patients → **Record** → **Edit Patient Info** → save; the record refreshes with the new values.
- Doctor and Receptionist record views show no edit button; spacing is consistent in all three portals.

### 2026-10-05 — Shared Patient Record across portals (`1ffe8ae`)
**Type:** feat
**Database / migrations:** none
**Files changed:**
- `api/patient_record_controller.php` — **new** read-only history endpoint: Administrator/Receptionist may open any patient; Doctors are scoped to patients with an appointment under them (`403` otherwise); consultation notes are omitted for Receptionists.
- `api/consultation_controller.php` — per-method roles: `GET` now also allows Receptionist (needed to print prescriptions/lab requests), `POST` stays Doctor/Administrator.
- `assets/js/components/patient-record-view.js` — **new** shared record screen: summary stats, status filter chips, color-coded encounter timeline, vitals, diagnoses, prescriptions, lab requests, and per-visit print actions.
- `assets/js/modules/patients.js`, `doctor_patients.js`, `receptionist_patients.js` — wired to the shared view (admin gets a Record button; receptionist View opens the full record and the module is renamed Patient Records; doctor keeps the own-patient scope).
- `assets/css/style.css` — patient record layout and status badge colors.
- `docs/obsidian-vault/Modules/Patient Records.md` — **new** module documentation.
**How to verify:**
- Administrator → Manage Patients → **Record**: full timeline for any patient, all statuses color coded.
- Receptionist → Patient Records → **View**: same record with notes hidden; completed visits show Print Prescription / Print Lab Request / Print Form.
- Doctor → Patient Records → View Record: own patients only; another doctor's patient returns `403`.
- `php tests/verify_acceptance.php` (20/20), `php tests/verify_all_modules_crud.php`, patient-record role smoke (13/13).

### 2026-10-05 — Clinical charting + print suite on the patient-records baseline (`409f6d5`)
**Type:** feat
**Database / migrations:** on databases that ran the removed experimental financial migrations, apply `migrations/005a_drop_legacy_financial_remnants.sql` first, then `006_remove_financial_schema.sql`, then `migrations/007_seed_medications.sql` (57 medicines, no pricing), `migrations/008_icd10_catalog.sql` (ICD-10 catalog), and `migrations/009_prescriptions_time_to_take.sql` (Rx time-of-day). 007 and 009 are absent-safe and can be re-run.
**Files changed:**
- `api/medication_controller.php` — paged/searchable medication CRUD (Administrator writes, Doctor reads) with archive, restore, and guarded permanent delete.
- `api/icd10_controller.php` — ICD-10 lookup for the diagnosis picker.
- `api/consultation_controller.php` — diagnoses, prescriptions with `time_to_take`, and free-text lab requests in one transaction.
- `assets/js/components/` — printable appointment/registration form (saved + blank for patients), prescription slip, laboratory request; shared `print-utils.js`.
- `assets/js/modules/medications.js`, `account_settings.js`, `my_profile.js`, `receptionist_patients.js` — new modules wired into `main.js` / `receptionist_main.js`.
- `login.html`, dashboards, `assets/css/style.css` — refreshed UI on top of the leader's branding.
**How to verify:**
- Admin → Manage Medications: add/edit/archive/restore, search, pagination.
- Doctor → Consultation: ICD-10 diagnosis, prescription with time picker, free-text lab request; save then print Rx and Lab Request.
- Receptionist → Patient Records: register a patient and print the blank or saved registration/appointment form.
- `php tests/verify_acceptance.php` and `php tests/verify_all_modules_crud.php` (adjust `$baseUrl` to your install path).

### 2026-09-30 — Receptionist appointment booking & triage (`a083555`)
**Type:** feat
**Database / migrations:** none — the existing `appointments` and `vital_signs` tables already support bookings.
**Files changed:**
- `api/appointment_controller.php` — added `POST` (create appointment + optional triage `vital_signs` row in one transaction; duplicate active booking returns `409`), `GET ?meta=patients`, `GET ?meta=doctors`, and triage vitals in the list query (`LEFT JOIN vital_signs`).
- `receptionist_dashboard.html` — replaced the "Coming Soon" placeholder with a full portal shell (sidebar, top bar, hash routing).
- `assets/js/receptionist_main.js` — **new** receptionist SPA router, guarded by `requireSession(['Receptionist'])`.
- `assets/js/modules/receptionist_appointments.js` — **new** booking module: patient/doctor dropdowns, date/time, chief complaint, optional vitals (blood pressure, temperature °C, oxygen saturation %), live search + status filter, field-level `422` errors.
- `docs/obsidian-vault/Modules/Receptionist Appointments.md` — **new** module documentation.
- `docs/obsidian-vault/API Endpoints.md`, `Changelog.md`, `Roadmap.md`, `Project Overview.md`, `walkthrough.md`, `README.md` — documentation updates.
- `erd/hospital_erd2.drawio` — canvas position tidy-up only (content unchanged from `f2b4465`).
**New IDs introduced:**
- API: `POST api/appointment_controller.php` → `201` with `data.appointment_id`; `409` when the doctor already has an active booking at that date/time.
- Module route key: `#receptionist_appointments`.
**How to verify:**
- Sign in as `recep.jane` / `RecepPass123!` → you land on `receptionist_dashboard.html`.
- **New Appointment** → pick patient + doctor, date/time, optional vitals → **Schedule Appointment**.
- The row appears as `SCHEDULED` with its vitals; booking the same doctor/date/time again shows the `409` error.
- Doctor portal (`dr.smith` / `DoctorPass123!`) shows the visit and its triage vitals in Appointments and Consultation.

### 2026-09-29 — Patient Records ERD sync (`f2b4465`)
**Type:** fix (diagram/docs)
**Database / migrations:** none — diagram only; the live DB already had migration `005` and `update_schema.sql` applied.
**Files changed:**
- `erd/hospital_erd2.drawio` — added `patients.middle_initial` and `medications.deleted_at`; corrected `appointments → consultation` and `consultation → billing` to **zero-or-one** (matching the `UNIQUE` constraints).
**New IDs introduced:** none.
**How to verify:**
- Open the ERD; `PATIENTS` has 11 columns including `middle_initial`, `MEDICATIONS` has 8 including `deleted_at`.
- Compare with the live schema using the `information_schema` query in [[Database Migrations]].
- Confirmed on 2026-09-29: live `hospital_db` (MySQL 8.4.7) has the same columns and a unique `billing.fk_billing_consultation` index, so diagram and database match.

### Earlier work (before 2026-09-29)
Previously completed features are summarized in [[Changelog]] (doctor portal, admin CRUD, archive, validation, and the migration history in [[Database Migrations]]).

## Related
- [[Changelog]] — plain-English history of user-facing features.
- [[Team Sync]] — how changes are committed and pushed.
- [[Database Migrations]] — schema updates every developer must apply.
- [[API Endpoints]] — request/response reference for API changes.
