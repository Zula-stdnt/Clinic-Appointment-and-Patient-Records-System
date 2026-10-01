---
tags: [roadmap]
---

# Roadmap

This note tracks recently completed milestones and upcoming features planned for the system.

## Completed recently
- **Doctor portal** — Completed the full Single-Page Application workspace (`doctor_dashboard.html`, `assets/js/doctor_main.js`) including [[Doctor Dashboard]], [[Doctor Appointments]], [[Doctor Consultation]], [[Doctor Patient Records]], and [[Doctor Profile]].
- **Receptionist booking** — Replaced the "Coming Soon" placeholder with a working receptionist portal (`receptionist_dashboard.html`, `assets/js/receptionist_main.js`) that books patient appointments and records optional triage vital signs ([[Receptionist Appointments]]).

## In progress / next
- **Receptionist portal (rest)** — Registering new patients at the front desk and managing the waiting queue.

## UI backlog
- **Top navigation bar upgrades:** Global search bar, notification bell, user profile dropdown menu, and breadcrumb navigation links.
- **Login screen polish:** Show/hide password toggle (completed), Caps Lock warning hint, and "Remember me" option.
- **Table loading placeholders:** Animated shimmer rows for module tables while data loads (currently shown as text placeholders).
- **Image optimization:** Compress `logo.png` (currently around 200 KB) and add a browser tab icon (`favicon`).

## Security backlog
- **Database-backed login rate limiting:** Store failed login counts on the server database instead of the browser session so clearing cookies cannot reset the counter.
- **Session permission caching:** Optionally cache fine-grained permission rules inside `$_SESSION` with a version tag if future roles need more detailed permissions beyond `require_role()`.
