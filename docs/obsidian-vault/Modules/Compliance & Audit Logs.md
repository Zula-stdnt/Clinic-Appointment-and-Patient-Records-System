---
tags: [module, security, compliance]
---

# Compliance & Audit Logs

**Route:** `#audit_logs` · **File:** `assets/js/modules/audit_logs.js` · **Controller:** `api/audit_log_controller.php`

## Purpose
Provides the hospital **Administrator** with a centralized, immutable compliance audit trail. It records every security-sensitive action, clinical emergency override, demographic modification, staff login, and appointment lifecycle change across the hospital system.

Rather than displaying raw technical code, database keys, or unformatted JSON to administrators, the module automatically translates all event data into clear, human-readable English sentences while preserving original records in the database for auditing and legal compliance.

## UI
- **Toolbar & Filtering:**
  - **Scrollable Action Filter Dropdown:** Constrained to a max-height of 260px with a thin custom scrollbar and real-time quick search input. Categorizes over 30 distinct actions into organized groups (`Appointments & Clinical`, `Patient Records & Demographics`, `Security & Access Control`, `Administration & Staff`) without breaking dashboard layouts or overflowing the browser viewport. An underlying `<select>` remains synced for DOM accessibility.
  - **Date Range Filter:** Quickly view activity from `All Dates`, `Today`, `Last 7 Days`, or `Last 30 Days`.
  - **Debounced Search Bar:** Search instantly by staff username, staff full name, action type, or clinical justification reason.
  - **Rows Per Page Selector:** Choose between 10, 25, or 50 rows per page.
  - **Interactive Sorting Headers:** Clickable column headers with dual carets (`▲`/`▼`) for `Timestamp`, `User (Actor)`, `Action`, and `Target Entity`.
- **Table Columns:**
  - **Timestamp:** The date and time when the action occurred.
  - **User (Actor):** Full name, username, and role badge of the staff member who performed the action.
  - **Action:** Color-coded status badge identifying the event category (e.g., green for creation/registration/approval, blue for status changes/rescheduling, amber for break-glass, red for cancellations/rejections/purging, teal for consultations).
  - **Target Entity:** The affected record type and identifier (e.g., `PATIENT #76`, `APPOINTMENT #38`, `CONSULTATION #12`), enriched with the target person's name and attending physician.
  - **Details / Reason:** Human-readable explanation of what changed, why, and any clinical justifications.
  - **IP Address:** Network client IP address associated with the event request.

## Human-Readable Event Presentation
The module converts technical audit payloads into plain English:

| Event Type | Plain-English Presentation | Example |
| :--- | :--- | :--- |
| **`LOGIN`** | `[Role] logged in` | `Doctor logged in` |
| **`CREATE_APPOINTMENT`** | `Appointment created for patient [Name] and assigned to Dr. [Doctor] (Scheduled for [Date] at [Time])` | `Appointment created for patient Jose Rizal and assigned to Dr. Gregory House (Scheduled for Oct 31, 2026 at 02:30 PM)` |
| **`STATUS_CHANGE`** | `Appointment status changed from [Old] to [New]` | `Appointment status changed from Scheduled to Confirmed` |
| **`RESCHEDULE_APPOINTMENT`** | `Appointment rescheduled to [New Date/Time]` with previous schedule reference | `Appointment rescheduled to Oct 31, 2026 at 03:00 PM (Previous schedule: Oct 30, 2026 at 09:00 AM)` |
| **`EDIT_APPOINTMENT`** | Detailed field-by-field diff of appointment changes | `Chief Complaint changed from "Flu symptoms" to "Severe migraine"` |
| **`SAVE_CONSULTATION`** | Doctor recorded clinical consultation with diagnosis, prescription, and lab request metrics | `Doctor saved clinical consultation (1 diagnosis, 2 prescriptions, and 1 lab request recorded)` |
| **`UPDATE_CONSULTATION`** | Doctor updated existing clinical consultation | `Doctor updated clinical consultation (2 diagnoses and 2 prescriptions recorded)` |
| **`COMPLETE_CONSULTATION`** | Doctor completed encounter consultation | `Doctor completed clinical consultation` |
| **`ADD_ENCOUNTER_ADDENDUM`** | Clinical follow-up addendum appended to completed consultation with note | `Clinical follow-up addendum note appended to consultation. Addendum note: "Patient called reporting nausea..."` |
| **`BREAK_GLASS_ACCESS`** | `Emergency "Break-Glass" access override granted to restricted patient record` with prominent emergency justification | `Emergency justification: "Acute severe myocardial infarction in ER trauma unit"` |
| **`EDIT_DEMOGRAPHICS`** | Natural field diffs listing each changed field | `Contact Number changed from "09170001122" to "09170003344"; First Name changed from "Clara" to "Clara Jane"` |
| **`UPDATE_ALLERGIES_AT_INTAKE`** | Updated allergy alerts with verification status | `Patient allergy alerts updated: "peanuts allergy" (Recorded at front-desk intake)` |
| **`CANCEL_REQUEST`** | Identifies doctor cancellation requests and displays clinical reason | `Doctor requested appointment cancellation. Reason: "Emergency surgery callout"` |
| **`CANCEL_APPOINTMENT`** | Front-desk cancellation with reason | `Appointment cancelled. Reason: "Patient unwell"` |
| **`UPDATE_DOCTOR_SCHEDULE`** | Doctor weekly duty rota updated with scheduled days and hours | `Doctor weekly schedule updated for Dr. Gregory House (Active days: Mon, Tue 08:00 - 17:00)` |
| **`REQUEST_STANDARD_ACCESS`** | Record access request submitted by doctor | `Standard 24-hour record access requested for patient Maria Clara. Reason: "Cardiology pre-op consultation"` |
| **`APPROVE_ACCESS_REQUEST`** | Administrator approved record access request | `Administrator approved 24-hour access request for Dr. Gregory House to patient Maria Clara` |
| **`REJECT_ACCESS_REQUEST`** | Administrator rejected record access request | `Administrator rejected emergency record access request. Reason: "Insufficient justification"` |
| **`ACKNOWLEDGE_AUDIT_FLAG`** | Administrator reviewed emergency break-glass event | `Administrator reviewed and acknowledged emergency Break-Glass access by Dr. Stephen Strange` |
| **`ARCHIVE` / `RESTORE` / `PURGE`** | Clear explanation of lifecycle change | `Record moved to Central Archive (soft-deleted)` or `Record permanently purged from database` |

## On-Demand Technical Details Toggle
To support technical audits and software debugging without cluttering the interface for hospital staff, rows containing raw JSON diffs include an unobtrusive, collapsible toggle:
- Clicking **"View technical details"** expands a small code preview showing the original before-and-after JSON diff.
- Closed by default to keep the interface readable, clean, and accessible.

## Backend Enrichment (`api/audit_log_controller.php`)
The server controller enriches the paginated audit records before returning them to the client:
- **Schema Normalization Agnostic:** Accurately resolves doctor identities by joining `doctors` to `users` on `user_id` (`COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Doctor')`), completely preventing SQL column mismatch errors on normalized database schemas.
- **Consultation Entity Resolution:** Automatically maps `consultation` entity IDs to their associated appointment, patient, and doctor records, ensuring target labels such as `CONSULTATION #12` display the patient's name and attending doctor.
- **Appointment Entity Resolution:** Looks up patient names (`target_patient_name`) and doctor names (`target_doctor_name`) associated with appointments and medical records.
- **Fallback Resilience:** Gracefully falls back to generic labels (`the patient`, `the doctor`) if a record was permanently purged from the database.
- **Native JSON Serialization:** Parses JSON strings in `old_values` and `new_values` into native PHP arrays for clean frontend processing.

## Security & Immutability
- **Strict Role Boundary:** Only users authenticated with the **Administrator** role can view audit trails (`require_role('Administrator')`). Doctors and Receptionists receive `403 Forbidden`.
- **Append-Only Immutability:** Audit records are write-once and can never be edited or deleted through the API. Non-GET requests (`POST`, `PUT`, `DELETE`) are rejected with `405 Method Not Allowed`.
- **Resilient Logging:** The `log_audit()` helper in `includes/audit.php` catches exceptions gracefully so a logging failure never interrupts critical patient care or booking workflows.
