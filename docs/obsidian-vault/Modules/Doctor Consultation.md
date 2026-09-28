---
tags: [module]
---

# Doctor Consultation

**Route:** `#doctor_consultation/{appointment_id}` · **File:** `assets/js/modules/doctor_consultation.js` · **Controllers:** `api/consultation_controller.php`, `api/medication_controller.php` · **Role:** Doctor

## Purpose
The clinical charting workspace where a doctor records or updates a patient visit tied to a specific appointment—including **SOAP clinical notes** (symptoms, exam findings, assessment, and plan), **ICD-10 diagnoses** (international medical codes), medication prescriptions, and lab test orders.

## Data flow
1. **Fresh State Reset:** Every time `init(container, param)` runs, the module clears its in-memory state before reading the new `appointmentId` so data from a previous patient visit never carries over.
2. **Parallel Data Load:**
   - `GET api/medication_controller.php` — Loads active medicines (`deleted_at IS NULL`) into `state.medications` to populate the prescription dropdown list.
   - `GET api/consultation_controller.php?appointment_id={id}` — Confirms that the appointment belongs to the signed-in doctor (returning `403 Forbidden` if not) and returns:
     - `appointment` — Patient personal info (`patient_first`, `patient_last`, `gender`, `date_of_birth`, calculated `age`), `chief_complaint`, and current `status`.
     - `vitals` — Triage vital signs from the `vital_signs` table (`blood_pressure`, `temperature`, `oxygen_saturation`).
     - `consultation` — Any existing main consultation record (`consultation_id`, `notes`, `consultation_date`).
     - `diagnoses`, `prescriptions`, and `lab_requests` — Existing item rows linked to that `consultation_id`.
   - If the appointment has no saved consultation yet, the screen starts with one blank row in each section using small **factory functions** (`createEmptyDiagnosis()`, `createEmptyPrescription()`, `createEmptyLabRequest()` — `01 JavaScript Foundations/javascript_objects_and_arrays`).

## UI sections
- **Patient & Triage Banner:** Shows the patient's name, age, gender, `PAT-XXXX` badge, highlighted **Chief Complaint**, and **Triage Vitals** (blood pressure in mmHg, temperature in °C, and blood oxygen SpO2 in %).
- **Clinical Notes:** Multi-line text area (`#cons-notes`) for writing clinical SOAP notes.
- **Diagnosis (`#diagnoses-container`):** Dynamic list of rows built with `create('div')` containing `diagnosis_name`, optional `icd10_code`, optional `notes`, and a remove-row button. Clicking **+ Add Diagnosis** adds a fresh row via `createEmptyDiagnosis()`.
- **Prescriptions (`#prescriptions-container`):** Dynamic list of rows built with `create('div')` containing a medicine dropdown `<select>` (using `medication_id` as the saved value, the medicine's brand/generic name as the label, and a disabled, unselectable `"Select Medication..."` prompt at the top), `dosage`, `frequency`, and a remove-row button. Clicking **+ Add Prescription** adds a fresh row via `createEmptyPrescription()`.
- **Lab Requests (`#labs-container`):** Dynamic list of rows built with `create('div')` containing `test_name` and a remove-row button. Clicking **+ Add Lab** adds a fresh row via `createEmptyLabRequest()`.

## Saving an encounter (`POST api/consultation_controller.php`)
Follows the **Header-Detail Form** and **Master-Detail Transaction** pattern (`03 APIs and Database Operations/header_detail_forms` & `04 Database Design/database_master_detail_design_part_2`), where one main consultation header owns multiple diagnosis, prescription, and lab rows. Clicking **Save & Complete Encounter** sends `{ appointment_id, notes, diagnoses, prescriptions, lab_requests }`:
1. Confirms the appointment belongs to the signed-in doctor.
2. Starts an all-or-nothing **database transaction** (`$pdo->beginTransaction()`).
3. Inserts a new `consultation` header row (capturing its ID with `$pdo->lastInsertId()`) or locks and updates the existing row (`SELECT ... FOR UPDATE`).
4. Replaces the linked child rows in `diagnosis`, `prescriptions` (setting `start_date` to today by default), and `lab_requests` (with status `'requested'`) using `consultation_id`.
5. Updates `appointments.status` to `'completed'`.
6. Commits all changes together (`$pdo->commit()`)—or undoes everything (`$pdo->rollBack()`) if any step fails—and returns the doctor to [[Doctor Appointments]].
