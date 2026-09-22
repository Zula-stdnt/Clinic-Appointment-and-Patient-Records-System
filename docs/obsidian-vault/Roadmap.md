---
tags: [roadmap]
---

# Roadmap

## In progress / next
- **Doctor portal** — replace the `doctor_dashboard.php` placeholder with a real shell: appointment queue, consultation notes, diagnosis, prescriptions, lab requests.
- **Receptionist portal** — patient registration, appointment scheduling, queue management.
- **Appointments module** — the schema exists (`appointments`) but has no controller/UI yet.
- **Billing module** — invoices, invoice items, payments (schema exists).

## UI backlog
- Topbar upgrades: global search, notifications, user dropdown, breadcrumbs.
- Login polish: show/hide password, caps-lock hint, remember me.
- Print stylesheet for invoices/receipts (`@media print`).
- Skeleton loaders for all module tables (currently text placeholders).
- Optimize `logo.png` (≈200 KB) and add a favicon.

## Security backlog
- Move login throttling server-side (currently per-session, so it resets when cookies clear).
- Optional permission cache in `$_SESSION` with a rules version (see conversation notes) if finer-grained roles are needed beyond `require_role()`.
