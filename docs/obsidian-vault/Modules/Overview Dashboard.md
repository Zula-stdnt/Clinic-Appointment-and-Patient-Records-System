---
tags: [module]
---

# Overview Dashboard

**Route:** `#overview` (default) · **File:** `assets/js/modules/overview.js` · **Role:** Administrator

## Purpose
Landing page summarising master-file records and recent patient activity.

## Data sources
Uses the existing list endpoints with `page_size=1` and reads `data.total`:
- `api/patient_controller.php`, `api/doctor_controller.php`, `api/user_controller.php`
- `api/service_controller.php`, `api/specialty_controller.php`, `api/discount_controller.php`

Recent patient registrations: `api/patient_controller.php?page=1&page_size=5&status=active&sort_by=created_at&sort_order=DESC`.

## UI
- **KPI cards** — six clickable cards that navigate to the matching module via hash links; shimmer placeholder while loading, em dash + tooltip on failure.
- **Recent Patient Registrations** — latest five active patients (name, gender badge, contact, registered date).
- **Quick Actions** — links to patients, users, doctors, services, and archive.

## Notes
- No dedicated backend endpoint; purely reads existing controllers (UI-only addition).
- Stat cards use `<a href="#module">`, so navigation flows through the router in [[Architecture]].
