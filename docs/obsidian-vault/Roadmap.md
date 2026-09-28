---
tags: [roadmap]
---

# Roadmap

This note tracks recently completed milestones and upcoming features planned for the system.

## Completed recently
- **Doctor portal** — Completed the full Single-Page Application workspace (`doctor_dashboard.html`, `assets/js/doctor_main.js`) including [[Doctor Dashboard]], [[Doctor Appointments]], [[Doctor Consultation]], [[Doctor Patient Records]], and [[Doctor Profile]].

## In progress / next
- **Receptionist portal** — Front-desk screens for registering patients, booking appointments, recording triage vital signs, and managing the waiting queue.
- **Billing module** — Screens for generating patient invoices, adding billable service items, applying discounts, and recording payments (the `billing` and `invoice_items` database tables are already in place).

## UI backlog
- **Top navigation bar upgrades:** Global search bar, notification bell, user profile dropdown menu, and breadcrumb navigation links.
- **Login screen polish:** Show/hide password toggle (completed), Caps Lock warning hint, and "Remember me" option.
- **Print-friendly invoices:** Dedicated print layout rules (`@media print`) for clean paper and PDF receipts.
- **Table loading placeholders:** Animated shimmer rows for module tables while data loads (currently shown as text placeholders).
- **Image optimization:** Compress `logo.png` (currently around 200 KB) and add a browser tab icon (`favicon`).

## Security backlog
- **Database-backed login rate limiting:** Store failed login counts on the server database instead of the browser session so clearing cookies cannot reset the counter.
- **Session permission caching:** Optionally cache fine-grained permission rules inside `$_SESSION` with a version tag if future roles need more detailed permissions beyond `require_role()`.
