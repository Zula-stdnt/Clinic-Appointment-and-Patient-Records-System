---
tags: [module]
---

# Patient Records

**Entry points:** `#doctor_patients` (Doctor) · `#receptionist_patients` (Receptionist) · **Record** button in `#patients` (Administrator)  
**Files:** `assets/js/components/patient-record-view.js`, `assets/js/modules/doctor_patients.js`, `assets/js/modules/receptionist_patients.js`, `assets/js/modules/patients.js`  
**Controller:** `api/patient_record_controller.php` · **Roles:** Administrator, Receptionist, Doctor

## Purpose
A unified patient record view component that provides role-tailored perspectives: front-desk administrative staff see a dedicated demographics card, administrators see governance information, and attending doctors access the full longitudinal clinical history.

## Access rules & role separation
- **Administrator** — Demographics profile with administrative governance notice; clinical encounter records are blocked.
- **Receptionist** — Strict Clinical Privacy. Receptionists only see the dedicated **Patient Demographics Profile** card (contact info, date of birth, home address, emergency contacts). Medical encounters, doctor notes, diagnoses, prescriptions, and lab orders are completely blocked on both client and server sides.
- **Doctor** — Full accumulated clinical encounter history for assigned patients. Unassigned patient charts are locked by default and require an audited Break-Glass emergency override to view.

## Screen layout
### Demographics Profile View (Receptionist & Administrator)
- **Identity Header:** Patient full name, active/archived status badge, date of birth, age, and gender. Database primary keys (`PAT-XXXX`) are masked from view.
- **Contact & Address Card:** Contact number formatted as `09XX XXX XXXX`, residential address, and emergency contact details.
- **Allergy Intake Note:** Displays allergy notes captured at front-desk registration along with confirmation status (`Unconfirmed Intake Note` vs `Doctor Confirmed`).
- **Quick Actions:** Front-desk staff can click **Edit Patient Info** to update demographics or return to the directory.

### Clinical Encounter Timeline View (Doctor)
- **Clinical Header:** Full patient identity and verified allergy alert banner.
- **Summary Cards:** Total visits, completed visits, upcoming appointments, last visit, and next visit dates.
- **In-Record Search:** Search across diagnosis names, ICD-10 codes, prescribed medicines, lab tests, and dates.
- **Status Filter Chips:** Filter encounters by All, Completed, Scheduled, or Cancelled.
- **Collapsible Cards:** Click visit headers or use **Collapse All / Expand All** to scan historical visits quickly.
- **Encounter Details:** Displays SOAP clinical notes, attributed dated addenda notes, ICD-10 diagnoses, prescriptions with dosing instructions and timing, and lab tests.

## Status colors & badge tokens
| Status | Badge Token | Appearance |
| --- | --- | --- |
| Scheduled | `.badge-status-scheduled` | Clinical Sky Blue |
| Confirmed | `.badge-status-confirmed` | Warm Amber |
| Completed | `.badge-status-completed` | Medical Forest Green |
| Cancelled / Archived | `.badge-status-cancelled` / `.badge-status-deleted` | Emergency Crimson |
| No-Show | `.badge-status-noshow` | Professional Slate Neutral |

## Printing
Attending doctors can print documents per completed encounter:
- **Print Prescription** — Completed visits with at least one prescription.
- **Print Lab Request** — Completed visits with at least one lab request.
- **Print Form** — Patient registration and encounter summary sheet.

## Related notes
- [[Doctor Patient Records]] — Doctor-scoped universal directory and break-glass protocol.
- [[Receptionist Appointments]] — Front-desk appointment and triage workflow.
- [[Doctor Consultation]] — Clinical consultation charting and allergy verification.
- [[API Endpoints]] — Complete API reference.
