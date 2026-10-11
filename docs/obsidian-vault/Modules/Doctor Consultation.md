---
tags: [module]
---

# Doctor Consultation

**Portal:** Doctor Portal (`doctor_dashboard.html`)  
**Role:** Doctor  
**File:** `assets/js/modules/doctor_consultation.js` · **Controllers:** `api/consultation_controller.php`, `api/medication_controller.php`

## Purpose
The clinical examination and charting screen. Doctors use this screen to review triage vitals and reported allergies, document examination findings via SOAP notes, record formal diagnoses with ICD-10 codes, issue prescriptions, order lab tests, officially verify allergies, and append dated addenda.

---

## User Workflow: What the Doctor Sees and Does

### 1. Reviewing Patient Information, Allergies & Triage Vitals
* **When to use:** At the start of the consultation.
* **What the doctor sees:** A patient banner at the top of the screen showing:
  - Patient's full name, calculated age, and gender (database primary keys are masked).
  - The patient's reported **Chief Complaint** (highlighted in red).
  - **Allergy Alert Banner:** Prominently alerts the physician to any allergies reported during intake, marked with an amber badge (`Unconfirmed Intake Note`) or green badge (`Doctor Confirmed`), complete with an instant **Set NKDA** (No Known Drug Allergies) button.
  - **Triage Vitals:** Blood Pressure (e.g., `120/80 mmHg`), Body Temperature in °C (e.g., `37.2 °C`), and Oxygen Level SpO2 (e.g., `98%`).

---

### 2. Entering Clinical Examination Notes
* **What the doctor does:**
  - Types medical findings into the **Clinical Notes** area following the standard SOAP structure:
    - **Subjective:** Symptoms reported by the patient.
    - **Objective:** Physical exam findings and vital sign observations.
    - **Assessment:** Clinical interpretation of the condition.
    - **Plan:** Recommended treatment, therapy, and follow-up guidance.

---

### 3. Adding Medical Diagnoses
* **What the doctor does:**
  1. In the **Diagnosis** card, clicks **+ Add Diagnosis** (supports multiple conditions).
  2. Types the diagnosed illness or condition (e.g., *Acute Bronchitis*, *Type 2 Diabetes*, or *Hypertension*).
  3. Optionally enters the international ICD-10 code (e.g., `J20.9`, `E11.9`, or `I10`).
  4. Optionally types special notes or clinical guidance for that diagnosis.
  5. Clicks the red remove icon if an item was added by mistake.

---

### 4. Prescribing Medications & Ordering Lab Tests
* **What the doctor does:**
  - **Prescriptions:** Clicks **+ Add Rx**, selects an approved medication from the menu, types dosage (e.g., `500 mg`), selects frequency (e.g., `Twice daily after meals`), and specifies dosing time instructions (`time_to_take`).
  - **Lab Requests:** Clicks **+ Add Lab** and types diagnostic tests or imaging required (e.g., `Complete Blood Count (CBC)` or `Chest X-ray`).

---

### 5. Completing the Medical Encounter & Allergy Verification
* **What the doctor does:**
  - Clicks **Save & Complete Encounter**.
* **What happens:**
  - The system saves clinical notes, diagnoses, prescriptions, and lab orders inside an all-or-nothing database transaction.
  - Any reported allergies are officially verified and promoted to **Doctor Confirmed** (`allergies_confirmed_by_doctor = 1`).
  - The appointment status updates to **Completed**.
  - The encounter is permanently locked against further edits to preserve medical integrity.

---

### 6. Appending Dated Consultation Addenda
* **When to use:** When new lab results arrive or additional observations must be documented for a completed visit.
* **What the doctor does:**
  1. Opens the completed visit chart via **View Encounter**.
  2. Clicks **+ Add Addendum**.
  3. Enters the follow-up note and clicks **Save Addendum**.
* **What happens:**
  - The note is saved to `consultation_addenda` with a permanent timestamp and the attending doctor's identity, preserving the original clinical record unaltered.
