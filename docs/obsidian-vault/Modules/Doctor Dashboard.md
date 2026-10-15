---
tags: [module]
---

# Doctor Dashboard

**Route:** `#doctor_overview` (default) · **Shell:** `doctor_dashboard.html` · **Router:** `assets/js/doctor_main.js` · **Module:** `assets/js/modules/doctor_overview.js` · **Role:** Doctor

## Purpose
The main workspace shell and daily home screen for signed-in doctors, built as a **Single-Page Application (SPA)** so doctors can move between their daily summary, appointment queue, consultation chart, patient medical records, and profile without full page reloads.

## Shell & Router (`doctor_main.js`)
- **Login & Role Check (Session Guard):** Calls `requireSession(['Doctor'])` (`assets/js/session-guard.js`) before showing the workspace; visitors who are not signed in as a Doctor are automatically redirected.
- **Parameterized Hash Routing:** Supports both simple screen links (such as `#doctor_appointments`) and links that carry an ID parameter (such as `#doctor_consultation/1`), passing the trailing ID (`1`) as `param` to `module.init(container, param)`.
- **Global Navigation Helper:** Provides `window.navigateTo(route)` so buttons inside one screen can open another screen directly (for example, clicking **Start Consult** in Appointments opens that specific visit in the Consultation screen).
- **Responsive Sidebar & Top Bar:** Includes a slide-out mobile menu (`#sidebar-toggle`, `#sidebar-backdrop`, and `Escape` key closing) and live top-bar displays for the doctor's name (`#user-name`), initial avatar (`#user-avatar-initial`), and today's date (`#current-date`).

## Overview Module (`doctor_overview.js`)
- Fetches the signed-in doctor's appointments from `api/appointment_controller.php` (`res.data.items`).
- Calculates live **KPI (Key Performance Indicator)** counter cards:
  - **Total Appointments Today** — All appointments scheduled for the doctor today.
  - **Pending Consultations** — Today's appointments that are still marked `scheduled` or `confirmed`.
  - **Completed Consultations** — Today's finished encounters.
- **Interactive Daily Queue Table:**
  - **Columns:** Time, Patient Name, Triage Vitals (BP, Temp, SpO2 stacked badges), Chief Complaint (clamped with tooltip), Status, Action.
  - **Quick Action Button:** Launches consultation (`#doctor_consultation/:id`) directly for confirmed visits.
- **Filtering & Date Range Controls:**
  - **Period Quick Pills:** `All Time`, `Today`, `This Week`, `This Month`.
  - **Custom Date Range Picker:** Interactive Start Date and End Date inputs with an "Apply" button to filter queue across any custom date interval.
  - **Pagination & Page Sizing:** Rows per page selector (10, 25, 50) and responsive page controls.
- **Live Multi-Tab State Synchronization:**
  - Subscribes to `cprms:sync` broadcast from `live-sync.js` to automatically re-fetch the queue in real-time when the receptionist confirms or schedules visits in another tab.

## Doctor Portal Modules
- [[Doctor Appointments]] — `#doctor_appointments`
- [[Doctor Consultation]] — `#doctor_consultation/{appointment_id}`
- [[Doctor Patient Records]] — `#doctor_patients`
- [[Doctor Profile]] — `#doctor_profile`
