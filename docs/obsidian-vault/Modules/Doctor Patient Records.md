---
tags: [module]
---

# Doctor Patient Records

**Route:** `#doctor_patients` · **File:** `assets/js/modules/doctor_patients.js` · **Controller:** `api/doctor_patients_controller.php` · **Role:** Doctor

## Purpose
Gives the signed-in doctor a read-only directory of their assigned patients and a chronological medical record timeline showing every past and upcoming visit.

## Access control & privacy
`api/doctor_patients_controller.php` requires the `Doctor` role (`require_role(['Doctor'])`) and restricts every database query to the signed-in doctor's `doctor_id` so a doctor can only view patients under their care:
- **List view (`?action=list`):** Joins `patients` with `appointments` (`INNER JOIN appointments a ON p.patient_id = a.patient_id WHERE a.doctor_id = :doctor_id` with `GROUP BY p.patient_id`) so only patients who have booked or completed an appointment with that doctor appear.
- **History view (`?action=history&patient_id=X`):** Checks `SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ?` before returning any medical history; if the patient is not linked to that doctor, the server blocks the request with `403 Forbidden`.

## UI views
### 1. Patient List View (`#patients-list-view`)
- **Search:** Live search box (`#patients-search`, debounced so it waits briefly while typing) that filters patients by first name, last name, phone number, or patient ID.
- **Table Columns:** Patient ID (`PAT-0001`), Name (with an `Archived` badge if `deleted_at` is set), Age/Gender, Contact No, and a **View Record** button.
- **Pagination:** Shows the current page count alongside Previous and Next page buttons (`#patients-pagination`).

### 2. Medical Record / Encounter Timeline View (`#patient-record-view`)
Clicking **View Record** switches the screen from the directory table to that patient's medical chart:
- **Demographics Header Card:** Displays a circular initial badge, full name, archived status badge (if archived), `PAT-XXXX` ID, calculated age, gender, and phone number.
- **Encounter History Timeline (`#timeline-container`):**
  - Lists all visits (`completed`, `scheduled`, `confirmed`) between this patient and doctor from newest to oldest (`appointment_date DESC, appointment_time DESC`).
  - **Completed visits** display:
    - **Vitals** (`blood_pressure`, `temperature`, `oxygen_saturation`).
    - **Clinical Notes** (formatted SOAP notes with line breaks preserved).
    - **Diagnosis badges** (including any ICD-10 code).
    - **Prescriptions list** (medicine name, dosage, and frequency).
    - **Lab Requests list** (ordered test names).
  - **Upcoming/pending visits** display a friendly note explaining that clinical notes and orders will appear once the visit is completed in [[Doctor Consultation]].
