---
tags: [module]
---

# Doctor Patient Records

**Portal:** Doctor Portal (`doctor_dashboard.html`)  
**Role:** Doctor  
**File:** `assets/js/modules/doctor_patients.js` · **Controller:** `api/doctor_patients_controller.php`

## Purpose
The patient health history directory. Doctors use this screen to browse patients registered in the hospital, filter by assignment status or gender, sort records interactively, and open a complete, accumulated medical history timeline showing all past visits, consultations, and diagnoses.

---

## User Workflow: What the Doctor Sees and Does

### 1. Searching & Filtering the Universal Patient Directory
* **When to use:** Before an appointment, when checking follow-ups, or during emergency admissions.
* **What the doctor sees:** The **Patient Records** directory displaying:
  - Search box (searches by first name, last name, phone number, or address).
  - **Gender Filter Dropdown:** `All Genders`, `Male`, `Female`, `Other` (matches all custom gender identities cleanly), and `Unknown`.
  - **Assignment Status Filter:** `All`, `Assigned` (active appointment), or `Unassigned [Break-Glass]`.
  - **Page Size Selector ("Rows:"):** 5, 10, or 25 records per page.
  - **Interactive Column Headers:** Clickable column headers (Name, Date of Birth, Age/Gender, Contact Number) with `▲`/`▼` caret indicators.
* **What the doctor does:**
  - Uses filters or clicks column headers to locate patients quickly.
  - Reviews each patient's Name, Age, Gender, Contact Number, and Assignment Status badge (`Assigned` or `Unassigned`).

---

### 2. Opening the Accumulated Medical History
* **For Assigned Patients:**
  1. The doctor clicks **View Record**.
  2. The medical chart opens immediately, showing the patient's demographics and reverse-chronological encounter timeline.
* **For Unassigned Patients (Break-Glass Protocol):**
  1. The doctor clicks the **Break-Glass** button.
  2. The emergency override dialog (`#break-glass-modal`) opens immediately without screen flicker or network errors.
  3. The doctor provides a mandatory clinical justification (at least 10 characters or selects preset tags such as *"Emergency Trauma / Unconscious Patient"*).
  4. Clicks **Confirm Break-Glass Access**.
  5. The medical chart unlocks with a prominent red emergency audit warning banner, and the action is permanently written to the compliance log (`audit_logs`).

---

### 3. What the Doctor Sees in the Medical History Timeline
For every past visit recorded for this patient, the timeline displays:
* **Visit Header:** The consultation date and primary **Chief Complaint**.
* **Status Badge:** Confirms whether the visit was `Completed` or is an upcoming visit.
* **Allergy Alerts:** Clear badges displaying verified allergies or unconfirmed intake notes.
* **Triage Vitals:** Blood pressure, temperature in °C, and blood oxygen percentage.
* **Clinical Notes:** The doctor's full SOAP notes (symptoms, physical findings, and care plan) from that visit.
* **Dated Addenda:** Any post-consultation addenda notes appended to completed visits.
* **Diagnoses:** Distinct badges showing every diagnosis recorded for that encounter, including the diagnosis name and international ICD-10 code.
* **Prescriptions:** Prescribed medications, dosages, frequencies, and specific times to take.
* **Lab Requests:** Any diagnostic lab tests or imaging ordered during that visit.

---

### 4. Returning to the Patient List
* When the doctor finishes reviewing the patient's history, they click the **Back to List** button to return to the search directory.
