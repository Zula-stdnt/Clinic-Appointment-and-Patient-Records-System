---
tags: [roadmap]
---

# Roadmap

This note tracks recently completed milestones and upcoming features planned for the system.

## Completed recently
- **Receptionist Overview & Lobby Queue:** Operational landing dashboard (`receptionist_overview.js`) featuring real-time KPI counters, 10-patient daily capacity gauge, interactive lobby queue table, date range pickers, and multi-tab live sync.
- **Proactive Form UX & Zero-Retype Schedule Protection:** Receptionist booking form with live duty notice badge, calendar date `min` boundary, 08:00–17:00 operating time bounds, live schedule validation warning banner, and zero form reset on validation errors.
- **Admin Doctor Weekly Schedule Rota:** Weekly Schedule column in Manage Doctors table, 7-day schedule configuration modal, and 1-click presets for Dr. House, Dr. Grey, Dr. Strange, and Full Week rotas (`doctor_schedule_controller.php`).
- **Hybrid Access Requests & Break-Glass Protocol:** Two-tier record access system (`access_request_controller.php`, migration 013) supporting planned 24-hour approved access windows and immediate emergency overrides flagged for audit.
- **Multi-Tab Live State Synchronization:** `live-sync.js` cross-tab revision polling broadcasting `cprms:sync` custom events to auto-refresh queues across workstations.
- **Modernized Responsive Dashboard Tables:** Dedicated clamped Chief Complaint column, standardized stacked Triage Vitals badges, 100% zoom layout without horizontal scrolling, and Rows per page selector (10, 25, 50).
- **Receptionist Walk-In Registration & Triage:** Embedded walk-in registration modal, triage vitals capture, and printable appointment slips.
- **Doctor Clinical Workspace:** Full Single-Page Application (`doctor_dashboard.html`, `doctor_main.js`) with SOAP consultation charting, ICD-10 diagnoses, prescriptions, lab requests, and attributed consultation addenda.
- **Human-Readable Compliance & Audit Trail:** Enriched audit logging with natural English translations and technical JSON diff toggles.

## In progress / next
- **Automated Verification Parity:** Maintained 75/75 automated test pass rate across 5 test suites.
- **Documentation Synchronization:** Complete documentation and Obsidian vault sync reflecting all recent features.

## UI backlog
- **Top navigation bar upgrades:** Global search bar, notification bell, user profile dropdown menu, and breadcrumb navigation links.
- **Table loading placeholders:** Animated shimmer rows for module tables while data loads (currently shown as text placeholders).
- **Image optimization:** Compress `logo.png` and add a browser tab icon (`favicon`).

## Security backlog
- **Database-backed login rate limiting:** Store failed login counts on the server database instead of the browser session so clearing cookies cannot reset the counter.
- **Session permission caching:** Optionally cache fine-grained permission rules inside `$_SESSION` with a version tag if future roles need more detailed permissions beyond `require_role()`.
