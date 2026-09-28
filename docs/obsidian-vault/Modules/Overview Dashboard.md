---
tags: [module]
---

# Overview Dashboard

**Route:** `#overview` (default) · **File:** `assets/js/modules/overview.js` · **Role:** Administrator

## Purpose
The default home screen for Administrators, giving an at-a-glance summary of all core hospital records (**Master Files**) and the newest patient registrations.

## Data sources
To get total counts quickly without downloading every row, this screen calls the existing list endpoints with `page_size=1` and reads the `data.total` number returned by each controller:
- `api/patient_controller.php`, `api/doctor_controller.php`, `api/user_controller.php`
- `api/service_controller.php`, `api/specialty_controller.php`, `api/discount_controller.php`

For the recent patients table, it requests the five newest active patient records:
`api/patient_controller.php?page=1&page_size=5&status=active&sort_by=created_at&sort_order=DESC`.

## UI
- **KPI summary cards** — Six clickable counter cards (Patients, Doctors, Staff Users, Services, Specialties, and Discounts) that open the matching management screen when clicked. While numbers are loading, a gentle shimmer animation appears; if a request fails, an em dash (`—`) with a hover note is shown.
- **Recent Patient Registrations** — Shows the five most recently added active patients (full name, gender badge, phone number, and registration date).
- **Quick Actions** — Shortcut buttons to jump straight to Patients, Users, Doctors, Services, and Manage Archive.

## Notes
- This module does not need its own separate PHP controller; it reads directly from the existing master-file controllers.
- Summary cards use standard hash links (`<a href="#module">`), so clicking a card smoothly switches screens through the navigation router described in [[Architecture]].
