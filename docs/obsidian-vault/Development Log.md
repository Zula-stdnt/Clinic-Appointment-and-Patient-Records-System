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
