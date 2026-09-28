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
- Compares appointment dates against today's date (`YYYY-MM-DD`) and calculates two live **KPI (Key Performance Indicator)** counter cards:
  - **Total Appointments Today** — All appointments scheduled for the doctor today.
  - **Pending Consultations** — Today's appointments that are still marked `scheduled` or `confirmed`.
- Includes a quick-link prompt that takes the doctor straight to [[Doctor Appointments]].

## Doctor Portal Modules
- [[Doctor Appointments]] — `#doctor_appointments`
- [[Doctor Consultation]] — `#doctor_consultation/{appointment_id}`
- [[Doctor Patient Records]] — `#doctor_patients`
- [[Doctor Profile]] — `#doctor_profile`
