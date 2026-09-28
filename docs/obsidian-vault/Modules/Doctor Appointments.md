---
tags: [module]
---

# Doctor Appointments

**Route:** `#doctor_appointments` · **File:** `assets/js/modules/doctor_appointments.js` · **Controller:** `api/appointment_controller.php` · **Role:** Doctor

## Purpose
Displays a read-only schedule of patient appointments assigned to the signed-in doctor and serves as the starting point for opening a new or completed clinical consultation.

## Data source & access control
- Requests the doctor's schedule from `GET api/appointment_controller.php`.
- When the signed-in user has the `Doctor` role, `appointment_controller.php` looks up their `doctor_id` (`SELECT doctor_id FROM doctors WHERE user_id = ?`) and filters the `appointments` table strictly by `a.doctor_id = ?`, sorted newest first (`appointment_date DESC, appointment_time DESC`).
- Returns `{ items: [...] }` inside `res.data`.

## UI
- **Header:** Shows the screen title ("My Appointments") and a **Refresh** button (`#btn-refresh-appointments`) to reload the schedule at any time.
- **Appointments Table (`.data-table`):**
  - **Date & Time** — Formatted in a friendly local date (`MMM D, YYYY`) and 12-hour time (`H:MM AM/PM`).
  - **Patient Name** — Displays the patient's full name along with a formatted ID badge (`PAT-0001`).
  - **Chief Complaint** — Shows a single-line preview (`max-width: 250px`) of why the patient is visiting, with the full text visible when hovering over the cell (`title`).
  - **Status** — Color-coded status pill (`scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`).
  - **Actions** — A smart consultation button (`.btn-start-consult`):
    - Displays **Start Consult** (with an edit icon) for upcoming or active visits.
    - Displays **View Encounter** (with an eye icon) once `status === 'completed'`.
    - Clicking the button opens `#doctor_consultation/{appointment_id}` via `window.navigateTo()` (see [[Doctor Consultation]]).

## Implementation notes (ITE 387 patterns)
- **DOM Row Construction (`02 DOM and UI/dom_create_and_remove_elements`):** Each table row is built using the *Create → Configure → Listen → Append* pattern: create the row with `create('tr')` (`assets/js/ui.js`), fill its HTML cells using template strings, attach the click listener directly to that row's `.btn-start-consult` button (`tr.querySelector('.btn-start-consult').addEventListener('click', ...)`), and append all rows into a `DocumentFragment` before updating the table.
- **API Error Handling (`03 APIs and Database Operations/javascript_working_with_apis`):** Reads server error messages from `res.message` and `err.response?.data?.message` so any failure shows a clear pop-up toast alert.
