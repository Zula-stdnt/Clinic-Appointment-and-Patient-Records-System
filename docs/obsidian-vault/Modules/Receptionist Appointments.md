---
tags: [module]
---

# Receptionist Appointments

**Route:** `#receptionist_appointments` · **File:** `assets/js/modules/receptionist_appointments.js` · **Controller:** `api/appointment_controller.php` · **Role:** Receptionist

## Purpose
The front-desk booking screen. A receptionist picks an active patient and doctor, sets the visit date and time, writes the chief complaint, and can optionally record triage vital signs (blood pressure, temperature, oxygen saturation) while creating the appointment.

## Data loading
On open, the module requests three endpoints in parallel:
- `GET api/appointment_controller.php?meta=patients` — active patients for the patient dropdown.
- `GET api/appointment_controller.php?meta=doctors` — active doctors (with their specialty names) for the doctor dropdown.
- `GET api/appointment_controller.php` — the full appointment queue, newest first, including any saved triage vitals.

The search box and the status dropdown filter the loaded rows instantly in the browser (no extra server calls).

## Booking flow (header + detail)
1. Clicking **New Appointment** opens the booking form (`#appointment-form-modal`) with the date box limited to today or later.
2. Submitting sends `{ patient_id, doctor_id, appointment_date, appointment_time, chief_complaint, blood_pressure, temperature, oxygen_saturation }` to `POST api/appointment_controller.php`.
3. The server validates the fields, checks that the patient and doctor are active, and rejects a duplicate active booking for the same doctor, date, and time (`409 Conflict`).
4. Inside one all-or-nothing database transaction, it inserts the `appointments` row (`status = 'scheduled'`, `created_by` = signed-in user) and — when any triage value was typed — a linked `vital_signs` row, following the header-detail pattern (`03 APIs and Database Operations/header_detail_forms` and `04 Database Design/database_master_detail_design_part_2`).
5. On success the modal closes, the queue refreshes, and the new visit appears with its triage vitals; the doctor later sees those vitals in [[Doctor Consultation]] and [[Doctor Patient Records]].

## UI notes
- Table columns: Date & Time, Patient (`PAT-XXXX`), Doctor, Chief Complaint, Triage Vitals, and a color-coded status badge (`scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`).
- Field errors returned by the server (`422`) are shown under the matching input with a red `is-invalid` outline; other failures raise a toast notification.
- Rows are built with the *Create → Configure → Listen → Append* pattern (`01 JavaScript Foundations/javascript_modules` and `02 DOM and UI/dom_create_and_remove_elements`), and all user text is escaped with `escapeHtml`.
