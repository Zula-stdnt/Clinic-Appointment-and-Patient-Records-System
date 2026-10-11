---
tags: [module]
---

# Doctor Appointments

**Portal:** Doctor Portal (`doctor_dashboard.html`)  
**Role:** Doctor  
**File:** `assets/js/modules/doctor_appointments.js` · **Controller:** `api/appointment_controller.php`

## Purpose
The primary appointment queue for doctors. Each doctor can see their own schedule of patients, check arrival and confirmation statuses, filter by date range or status, sort interactively by column, and start patient consultations.

---

## User Workflow: What the Doctor Sees and Does

### 1. Reviewing the Patient Schedule
* **When to use:** Throughout the clinic day to monitor patient visits.
* **What the doctor sees:** The **My Appointments** screen displaying:
  - **Date Range Filter:** `Upcoming` (default), `Today`, or `Past`.
  - **Status Filter:** `All`, `Scheduled`, `Confirmed`, `Completed`, `Cancelled`, or `No Show`.
  - **Search Box:** Filter by patient name or complaint.
  - **Interactive Column Headers:** Clickable column headers (Date & Time, Patient, Chief Complaint, Status) with `▲`/`▼` caret indicators.
  - **Neat Row Layout:** Fixed table cell alignment using `.actions-cell` to ensure uniform row heights.
* **What the doctor does:**
  - Views patient names, appointment times, reasons for visit, and visit statuses.
  - Clicks the **Refresh** button to update the queue.

---

### 2. Starting a Patient Consultation
* **When to use:** When a patient is confirmed by the front desk and is ready for examination.
* **What the doctor sees:**
  - If the appointment is marked **Scheduled**, the action column displays `Awaiting Confirmation` (protecting the doctor from beginning an encounter before the patient arrives and checks in).
  - Once the receptionist confirms the patient, the appointment displays a green **Start Consult** button.
* **What the doctor does:**
  1. Locates the confirmed patient.
  2. Clicks **Start Consult**.
* **What happens:**
  - The screen navigates directly to the [[Doctor Consultation]] screen with the patient's information, triage vitals, and examination form loaded.

---

### 3. Reviewing Completed Visits
* **When to use:** When a doctor needs to reference notes or diagnoses from an earlier visit.
* **What the doctor sees:** A blue **View Encounter** button in the action column for any appointment marked **Completed**.
* **What the doctor does:**
  - Clicks **View Encounter** to review the saved clinical notes, diagnoses, and orders in view-only mode.

---

### 4. Cancelling an Appointment
* **What the doctor does:**
  - Attending doctors can cancel their own scheduled appointments using the compact red cancel icon button, providing an audited clinical cancellation reason. Direct cancellation of another doctor's appointments is blocked (`403 Forbidden`).

---

## Table Columns & Information
* **Date & Time:** The appointment date and time (sortable).
* **Patient Name:** The patient's full name (sortable).
* **Chief Complaint:** The primary health issue reported by the patient (sortable).
* **Status:** Color-coded status badge (`Scheduled`, `Confirmed`, `Completed`, `Cancelled`, `No Show`) (sortable).
* **Action:**
  - `Awaiting Confirmation`: Patient has not yet checked in.
  - `Start Consult`: Patient is confirmed and ready for examination.
  - `View Encounter`: Examination is completed; opens view-only chart.
  - Compact Cancel button with confirmation modal.
