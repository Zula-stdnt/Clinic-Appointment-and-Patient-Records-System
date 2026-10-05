---
tags: [module]
---

# Receptionist Appointments

**Portal:** Receptionist Portal (`receptionist_dashboard.html`)  
**Role:** Receptionist

## Purpose
The front-desk appointment management screen. Receptionists use this screen to schedule patient visits with available doctors, register walk-in patients on the spot, record initial triage vital signs, and manage the clinic's daily appointment queue.

---

## User Workflow: What the Receptionist Sees and Does

### 1. Booking a Scheduled Appointment
* **When to use:** When a patient calls or visits the clinic to schedule an appointment.
* **What the receptionist sees:** The Appointments page with a list of upcoming appointments, search box, status filter, and the **+ New Appointment** button.
* **What the receptionist does:**
  1. Clicks the **New Appointment** button to open the appointment booking form.
  2. Selects the patient from the patient dropdown list.
  3. Selects a doctor from the searchable doctor list.
  4. Chooses an appointment date and selects an available time slot.
  5. Types the patient's primary concern in the **Chief Complaint** box.
  6. Optionally enters initial triage vital signs taken at the front desk: blood pressure (e.g., `120/80`), temperature in °C (e.g., `36.8`), and oxygen level percentage (e.g., `98%`).
  7. Clicks **Schedule Appointment**.
* **What happens:**
  - The system checks that the appointment is during clinic operating hours (**08:00 AM to 05:00 PM**, excluding the **12:00 PM to 12:59 PM** lunch hour, and not on a Sunday).
  - The system checks that the doctor is not already booked at that exact date and time.
  - The system checks daily clinic capacity (a maximum of **10 appointments per day** across all doctors). If the clinic has 8 or 9 appointments, a warning notes that the clinic is near capacity. If the day already has 10 appointments, the system prevents further bookings and asks the receptionist to select another date.
  - The appointment is added to the queue as **Scheduled**.

---

### 2. Registering a Walk-in Patient
* **When to use:** When a first-time patient arrives at the front desk without an existing patient profile.
* **What the receptionist sees:** The **+ Register Walk-in** button in the appointment toolbar and a clean registration pop-up form.
* **What the receptionist does:**
  1. Clicks **Register Walk-in**.
  2. Fills out the patient's basic details: First Name, Middle Initial (optional, exactly one letter), Last Name, Gender, Date of Birth, Phone Number, and Home Address.
  3. Clicks **Register & Select**.
* **What happens:**
  - The patient profile is immediately created and automatically selected in the appointment booking form.
  - The receptionist can immediately finish booking the appointment without leaving the screen.

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

### 4. Cancelling an Appointment
* **When to use:** When the patient changes their mind, decides not to wait, or the visit cannot push through.
* **What the receptionist does:**
  1. Finds the appointment in the queue (only **Scheduled** or **Confirmed** visits can be cancelled).
  2. Clicks the red **Cancel** button on that row.
  3. Confirms in the **Cancel Appointment** dialog.
* **What happens:**
  - The visit becomes **Cancelled** and stays in the queue/history with a red status badge.
  - The doctor's time slot is released and can be rebooked for another patient.
  - Completed visits cannot be cancelled, and cancelling an already-cancelled visit is rejected.
* **Doctors:** In the Doctor Portal → **My Appointments**, a doctor can cancel their **own** scheduled visits the same way, but cannot cancel another doctor's appointment.

---

## Screen Elements & Information

* **Appointments Queue Table:**
  * **Date & Time:** The scheduled date and 12-hour time of the visit.
  * **Patient Name:** Patient's full name.
  * **Doctor:** The attending physician and their medical specialty.
  * **Chief Complaint:** The main reason for the visit.
  * **Triage Vitals:** Displays initial blood pressure, temperature, and blood oxygen readings.
  * **Status:** Color-coded status badge showing `Scheduled`, `Confirmed`, `Completed`, `Cancelled`, or `No Show`.
  * **Actions:** **Print Form** for any visit and **Cancel** for scheduled/confirmed visits.
* **Search & Filters:**
  * **Search box:** Filter the schedule instantly by patient name, doctor name, or complaint.
  * **Status dropdown:** Filter by visit status (e.g., view only confirmed or completed appointments).
  * **Rows per page:** Easily navigate through pages of appointments.
