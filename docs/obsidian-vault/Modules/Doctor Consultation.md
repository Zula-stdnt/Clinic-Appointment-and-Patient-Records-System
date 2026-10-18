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

### 2. Entering Clinical Examination Notes (SOAP Format)
* **What the doctor does:**
  - Clinical Notes are organized into 4 distinct, color-coded clinical cards:
    - **S · Subjective:** Patient-reported history of present illness (HPI), chief symptoms, onset, aggravating/relieving factors, and pain scale.
    - **O · Objective:** Physical examination findings, clinical inspection, system reviews (HEENT, chest, abdomen, extremities), with triage vitals (BP, Temp, SpO2) displayed directly above for real-time reference.
    - **A · Assessment:** Clinical impression, differential/working diagnosis synthesis, disease severity, and clinical progress.
    - **P · Plan:** Comprehensive treatment strategy, counseling, diet/activity advice, return precautions, and follow-up timeline.
  - **Zero-Duplicate Plan Shortcut:**
    - Clicking the **⚡ Summarize Prescriptions in Plan** button automatically formats and syncs all prescribed medications (with strength, dosage, route, frequency, and instructions) into the Plan notes without requiring redundant typing.
    - Re-clicking updates the itemized medication block without overwriting custom clinical advice.

---

### 3. Adding Medical Diagnoses
* **What the doctor does:**
  1. In the **Diagnosis** card, clicks **+ Add Diagnosis** (supports multiple conditions).
  2. Types or searches the international ICD-10 code (e.g., `J20.9`, `E11.9`, or `I10`) using type-ahead catalog search. Selecting a code auto-fills the clinical diagnosis name.
  3. Optionally enters custom clinical notes or disease specifications for that diagnosis.
  4. Clicks the red remove icon if an item was added by mistake.

---

### 4. Prescribing Medications & Ordering Lab Tests

#### A. Structured Prescriptions (Rx)
* **What the doctor does:**
  - Clicks **+ Add Medication** to generate a structured prescription item.
  - Documents all 7 clinical prescription attributes:
    1. **Medication Name:** Type-ahead catalog lookup matching generic and brand names from `medications`.
    2. **Strength:** Specific drug strength (e.g., `500 mg`, `250 mg/5 mL`, `10 mg`).
    3. **Dosage:** Unit dosage (e.g., `1 tablet`, `5 mL`, `2 capsules`, `1 drop`).
    4. **Route:** Standard clinical route dropdown (`Oral (PO)`, `Sublingual`, `Topical`, `Inhalation`, `Intramuscular (IM)`, `Intravenous (IV)`, `Ophthalmic`, `Otic`, `Nasal`, `Rectal`, `Other`).
    5. **Frequency:** Standard clinical abbreviations and frequency intervals with instant datalist autocomplete (e.g., `Once daily (OD)`, `Twice daily (BID)`, `Three times daily (TID)`, `Every 8 hours (Q8H)`, `As needed (PRN)`).
    6. **Duration:** Duration of regimen (e.g., `7 days`, `14 days`, `30 days`, `Ongoing`).
    7. **Additional Instructions / Timing:** Patient instructions (e.g., `Take after meals with plenty of water`, `Do not crush`, `Take 30 mins before breakfast`).

#### B. Dedicated Laboratory & Diagnostic Requests
* **What the doctor does:**
  - In the separate **Laboratory & Diagnostic Requests** card, clicks **+ Add Lab Request**.
  - Enters the required diagnostic test or radiological procedure using datalist quick-picks (e.g., `Complete Blood Count (CBC) with Platelet`, `Fasting Blood Sugar (FBS)`, `Lipid Profile`, `Chest X-Ray (PA View)`, `Urinalysis (Routine)`, `12-Lead ECG`).
  - Lab orders are saved and can be printed on the official CAPRS Laboratory Request Slip for patient presentation at the diagnostic facility.

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
