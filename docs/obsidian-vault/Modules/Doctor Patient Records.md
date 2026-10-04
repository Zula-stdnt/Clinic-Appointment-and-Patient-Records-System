---
tags: [module]
---

# Doctor Patient Records

**Portal:** Doctor Portal (`doctor_dashboard.html`)  
**Role:** Doctor

## Purpose
The patient health history directory. Doctors use this screen to browse patients under their care and open a complete, accumulated medical history timeline showing all past visits, consultations, and diagnoses.

---

## User Workflow: What the Doctor Sees and Does

### 1. Searching the Patient Directory
* **When to use:** Before an appointment or when following up on a patient's case.
* **What the doctor sees:** The **Patient Records** directory displaying a list of patients, quick search box, and page controls.
* **What the doctor does:**
  - Types in the search box to find a patient by first name, last name, phone number, or patient ID (`PAT-XXXX`).
  - Browses the list of patients showing their Name, Age, Gender, and Contact Number.

---

### 2. Opening the Accumulated Medical History
* **What the doctor does:**
  1. Finds the patient in the table.
  2. Clicks the **View Record** button next to their name.
* **What happens:**
  - The screen displays the patient's **Medical Record** chart.
  - At the top, a **Demographics Header** displays the patient's name, ID, age, gender, contact number, and address.
  - Below, the **Encounter History** timeline displays **all previous visits** accumulated in chronological order, with the newest visits at the top.

---

### 3. What the Doctor Sees in the Medical History Timeline
For every past visit recorded for this patient, the timeline displays:
* **Visit Header:** The consultation date and primary **Chief Complaint**.
* **Status Badge:** Confirms whether the visit was `Completed` or is an upcoming visit.
* **Triage Vitals:** Blood pressure, temperature in °C, and blood oxygen percentage.
* **Clinical Notes:** The doctor's full SOAP notes (symptoms, physical findings, and care plan) from that visit.
* **Diagnoses:** Distinct badges showing every diagnosis recorded for that encounter, including the diagnosis name and international ICD-10 code.
* **Prescriptions:** List of prescribed medications, dosages, and frequencies.
* **Lab Requests:** Any diagnostic lab tests or imaging ordered during that visit.

### 4. Returning to the Patient List
* When the doctor finishes reviewing the patient's history, they click the **Back to List** button to return to the search directory.
