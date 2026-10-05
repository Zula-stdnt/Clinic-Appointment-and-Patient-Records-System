---
tags: [module]
---

# Patient Records

**Entry points:** `#doctor_patients` (Doctor) · `#receptionist_patients` (Receptionist) · **Record** button in `#patients` (Administrator)
**Files:** `assets/js/components/patient-record-view.js`, `assets/js/modules/doctor_patients.js`, `assets/js/modules/receptionist_patients.js`, `assets/js/modules/patients.js`
**Controller:** `api/patient_record_controller.php` · **Roles:** Administrator, Receptionist, Doctor

## Purpose
A single read-only clinical record screen shared by all three portals. It shows the patient's demographics, a visit summary, and a color-coded timeline of every appointment with its vitals, diagnoses, prescriptions, and laboratory requests — plus printing per completed visit.

## Access rules
- **Administrator** — any patient.
- **Receptionist** — any patient. The doctor's clinical notes are omitted **server-side**; vitals, diagnoses, prescriptions, and laboratory requests remain visible so the front desk can assist patients.
- **Doctor** — only patients who have an appointment under that doctor. Any other patient returns `403` (privacy scope preserved from the original doctor records screen).

## Screen layout
- **Header card** — patient ID (`PAT-0000`), name, active/archived badge, age, gender, date of birth, contact, address.
- **Summary cards** — total visits, completed, upcoming, last visit, next visit.
- **Search** — free-text search inside the record: diagnosis name, ICD-10 code, medicine, lab test, doctor, chief complaint, notes, or date. A **Showing X of Y visits** count updates as you type.
- **Filter chips** — All Visits / Completed / Scheduled / Cancelled, usable together with the search.
- **Collapse / Expand** — every visit card collapses to a one-line summary (date, doctor, status, `2 diagnoses · 1 prescription · 2 lab requests`); **Collapse All / Expand All** toggles the whole timeline for quick scanning.
- **Encounter timeline** — newest first. Each card shows date, time, attending doctor, chief complaint, a status badge, and (for completed visits) vitals, notes, diagnoses with ICD-10 codes, prescriptions with dosage/frequency/time-to-take, and lab requests with status and date.

## Status colors
| Appointment status | Badge |
| --- | --- |
| Scheduled | blue (`badge-info`) |
| Confirmed | solid green (`badge-primary`) |
| Completed | green (`badge-success`) |
| Cancelled | red (`badge-deleted`) |
| No-show | orange (`badge-warning`) |

| Lab request status | Badge |
| --- | --- |
| Requested | orange (`badge-warning`) |
| In progress | blue (`badge-info`) |
| Completed | green (`badge-success`) |
| Cancelled | gray (`badge-secondary`) |

The encounter card's left border color matches the appointment status.

## Printing
Each visit card offers:
- **Print Prescription** — completed visits with at least one prescription.
- **Print Lab Request** — completed visits with at least one lab request.
- **Print Form** — the patient registration & appointment form for any visit.

Receptionists can print because `consultation_controller.php` allows `GET` for the Receptionist role; saving a consultation stays Doctor/Administrator only.

## API
| Action | Request |
| --- | --- |
| History | `GET api/patient_record_controller.php?action=history&patient_id` |

Response: `data.patient`, `data.summary` (total_visits, completed, upcoming, cancelled, last_visit, next_visit), `data.encounters[]` (status, doctor name, vitals, notes, diagnoses, prescriptions, lab_requests), `data.viewer_role`.

## Related notes
- [[Doctor Patient Records]] — the original doctor-scoped screen.
- [[Receptionist Appointments]] — how visits and vitals are booked.
- [[Doctor Consultation]] — where diagnoses, prescriptions, and labs are recorded.
- [[API Endpoints]] — endpoint reference.
