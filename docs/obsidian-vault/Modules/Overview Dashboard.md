---
tags: [module]
---

# Overview Dashboard

**Routes:** `#overview` (Administrator default) · `#receptionist_overview` (Receptionist default)  
**Files:** `assets/js/modules/overview.js` (Admin) · `assets/js/modules/receptionist_overview.js` (Receptionist)  
**Roles:** Administrator, Receptionist

## Purpose
The primary landing dashboard for staff upon logging into their portals, giving an immediate at-a-glance summary of hospital operations, capacity limits, and key metrics.

## Administrator Overview (`#overview`)
- **Data Sources:** Calls existing master-file endpoints with `page_size=1` to read `data.total`:
  - `api/patient_controller.php`, `api/doctor_controller.php`, `api/user_controller.php`, `api/service_controller.php`, `api/specialty_controller.php`.
  - Recent patients: `api/patient_controller.php?page=1&page_size=5&status=active&sort_by=created_at&sort_order=DESC`.
- **UI Elements:**
  - **KPI Summary Cards:** Five clickable counter cards (Patients, Doctors, Staff Users, Services, Specialties) that route to management screens.
  - **Recent Registrations:** Five most recent active patient registrations.
  - **Quick Action Buttons:** Direct shortcuts to master files and archive.

## Receptionist Overview (`#receptionist_overview`)
- **Default Landing:** Receptionists land directly on this overview after authentication to review the day's clinic load before taking scheduling actions.
- **Data Sources:**
  - Reads `api/appointment_controller.php` for appointment queues and capacity tracking.
  - Reads `api/doctor_controller.php` (read access granted to Receptionists) for doctor roster metrics.
- **UI Elements:**
  - **Clinic Capacity Monitor:** Tracks the 10-appointments daily clinic capacity model, alerting staff at normal, near-limit (8-9), and full capacity (10).
  - **Time-Horizon Selector:** Instant switching between `Today`, `This Week`, `This Month`, and `All-Time`.
  - **Lobby Board:** Live queue of arriving patients with arrival status, attending doctor, chief complaint, and triage vitals status.
  - **Doctors on Duty Widget:** Shows assigned doctors and patient counts waiting for each physician.
  - **Fast Actions:** Direct buttons for New Appointment, Walk-in Registration, and Printable Blank Intake Sheets.
