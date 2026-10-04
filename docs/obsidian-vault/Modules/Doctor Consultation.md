---
tags: [module]
---

# Doctor Consultation

**Portal:** Doctor Portal (`doctor_dashboard.html`)  
**Role:** Doctor

## Purpose
The clinical examination and charting screen. Doctors use this screen to document a patient's medical visit—including clinical examination notes, formal medical diagnoses with ICD-10 codes, prescriptions, and lab test orders.

---

## User Workflow: What the Doctor Sees and Does

### 1. Reviewing Patient Information & Triage Vitals
* **When to use:** At the start of the consultation.
* **What the doctor sees:** A patient banner at the top of the screen showing:
  - Patient's full name, calculated age, and gender.
  - The patient's reported **Chief Complaint** (highlighted in red).
  - **Triage Vitals** taken at the front desk: Blood Pressure (e.g., `120/80 mmHg`), Body Temperature (e.g., `37.2 °C`), and Oxygen Level SpO2 (e.g., `98%`).

---

### 2. Entering Clinical Examination Notes
* **What the doctor does:**
  - Types their medical findings and observations into the **Clinical Notes** area.
  - Doctors use standard SOAP structure:
    - **Subjective:** Symptoms reported by the patient.
    - **Objective:** Physical exam findings and vital sign observations.
    - **Assessment:** Clinical interpretation of the illness.
    - **Plan:** Recommended treatment, therapy, and follow-up advice.

---

### 3. Adding Medical Diagnoses
* **What the doctor does:**
  1. In the **Diagnosis** card, clicks **+ Add Diagnosis** (can be clicked multiple times for patients with multiple conditions).
  2. Types the diagnosed illness or condition (e.g., *Acute Bronchitis*, *Type 2 Diabetes*, or *Hypertension*).
  3. Optionally enters the international ICD-10 medical code (e.g., `J20.9`, `E11.9`, or `I10`).
  4. Optionally types special notes or guidance for that diagnosis.
  5. Clicks the red remove icon if an entry was added by mistake.
* **What happens:**
  - The diagnoses are permanently saved to this encounter and automatically appear in the patient's accumulated medical history.

---

### 4. Prescribing Medications & Ordering Lab Tests
* **What the doctor does:**
  - **Prescriptions:** Clicks **+ Add Rx**, selects an approved medication from the medicine menu, types the dosage (e.g., `500 mg`), and selects the frequency (e.g., `Twice daily after meals`).
  - **Lab Requests:** Clicks **+ Add Lab** and types the name of any required laboratory or imaging test (e.g., `Complete Blood Count (CBC)` or `Chest X-ray`).

---

### 5. Completing the Medical Encounter
* **What the doctor does:**
  - Clicks **Save & Complete Encounter**.
* **What happens:**
  - The system saves the clinical notes, diagnoses, prescriptions, and lab requests together safely.
  - The appointment status updates to **Completed**.
  - The visit is permanently locked to protect medical record integrity, and can be viewed anytime via **View Encounter** in the appointment queue or through the patient's medical history timeline.
