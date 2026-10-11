---
tags: [module]
---

# Receptionist Appointments

**Portal:** Receptionist Portal (`receptionist_dashboard.html`)  
**Role:** Receptionist  
**File:** `assets/js/modules/receptionist_appointments.js` · **Controller:** `api/appointment_controller.php`

## Purpose
The front-desk appointment management screen. Receptionists use this screen to schedule patient visits with available doctors, register walk-in patients on the spot, record initial triage vital signs, capture patient allergy notes, and manage the clinic's daily appointment queue.

---

## User Workflow: What the Receptionist Sees and Does

### 1. Booking a Scheduled Appointment
* **When to use:** When a patient calls or visits the clinic to schedule an appointment.
* **What the receptionist sees:** The Appointments page with a list of appointments, search bar, date filters, status filter, and the **+ New Appointment** button.
* **What the receptionist does:**
  1. Clicks the **New Appointment** button to open the appointment booking form.
  2. Selects the patient from the searchable patient menu (which automatically pre-loads any existing recorded allergies and their verification status).
  3. Selects a doctor from the searchable doctor menu.
  4. Chooses an appointment date and selects an available time slot during operating hours (**08:00 AM to 05:00 PM**, excluding the **12:00 PM to 12:59 PM** lunch hour, Monday through Saturday).
  5. Types the patient's primary concern in the **Chief Complaint** box.
  6. Captures reported patient allergies in the **Allergies & Clinical Alerts** box (saved with an amber `Unconfirmed Intake Note` badge).
  7. Optionally enters initial triage vital signs: blood pressure (e.g., `120/80`), temperature in °C (e.g., `36.8`), and oxygen level percentage (e.g., `98%`).
  8. Clicks **Schedule Appointment**.
* **What happens:**
  - The system checks doctor availability to ensure double-booking never occurs.
  - The system checks daily clinic capacity (a maximum of **10 appointments per day** across all doctors). If the clinic has 8 or 9 appointments, a warning notes that the clinic is near capacity. If the day already has 10 appointments, the system prevents further bookings and asks the receptionist to select another date.
  - The appointment is added to the queue as **Scheduled**.

---

### 2. Registering a Walk-in Patient
* **When to use:** When a first-time patient arrives at the front desk without an existing patient profile.
* **What the receptionist sees:** The **+ Register Walk-in** button in the appointment toolbar and a registration pop-up dialog.
* **What the receptionist does:**
  1. Clicks **Register Walk-in**.
  2. Fills out the patient's basic details: First Name, Middle Initial (optional, exactly one letter), Last Name, Gender, Date of Birth, Phone Number, Home Address, and any reported **Allergies & Clinical Alerts**.
  3. Clicks **Register & Select**.
* **What happens:**
  - The patient profile is immediately created, and any entered allergies are saved as an unconfirmed intake note.
  - The patient is automatically selected in the appointment booking form so the receptionist can immediately complete scheduling without navigating away.

---

### 3. Confirming Appointments for Doctors
* **When to use:** When the patient checks in at the front desk and is ready to be examined by the doctor.
* **What the receptionist does:**
  1. Finds the patient's appointment in the queue.
  2. Clicks the status button to update it from **Scheduled** to **Confirmed**.
* **What happens:**
  - The status badge changes to **Confirmed**.
  - In the Doctor Portal, the appointment unlocks with a green **Start Consult** button so the doctor can open the patient's consultation chart.

---

### 4. Printing Patient Intake Slips
* **When to use:** When providing a printed appointment routing slip for the patient or clinical chart.
* **What the receptionist does:**
  - Clicks the **Print Form** icon button on the appointment row.
* **What happens:**
  - A clean, professional intake slip opens in print preview, prominently highlighting patient identity, appointment schedule, chief complaint, triage vital signs, and an alert box displaying any reported **Allergies & Clinical Alerts** with confirmation status.

---

### 5. Cancelling an Appointment
* **When to use:** When the patient cancels or the visit cannot push through.
* **What the receptionist does:**
  1. Finds the appointment in the queue (only **Scheduled** or **Confirmed** visits can be cancelled).
  2. Clicks the red **Cancel** icon button on that row.
  3. Confirms in the **Cancel Appointment** dialog.
* **What happens:**
  - The visit becomes **Cancelled** and stays in the queue with an emergency crimson status badge.
  - The doctor's time slot is released and can be rebooked for another patient.
  - An entry is permanently written to the compliance log (`audit_logs`).

---

## Screen Elements & Information

* **Appointments Queue Table:**
  * **Interactive Column Headers:** Clickable column headers (Date & Time, Patient, Doctor, Chief Complaint, Status) with `▲`/`▼` caret indicators.
  * **Compact Action Buttons:** Clean icon buttons (`.btn-icon`) for Print Form and Cancel with accessible hover tooltips.
* **Search & Filters:**
  * **Search Box:** Filter instantly by patient name, doctor name, or complaint.
  * **Date Range Filter:** `Today`, `Upcoming`, or `Past`.
  * **Status Dropdown:** Filter by visit status (`All`, `Scheduled`, `Confirmed`, `Completed`, `Cancelled`, `No Show`).
  * **Page Size Selector ("Rows:"):** 5, 10, or 25 records per page.
