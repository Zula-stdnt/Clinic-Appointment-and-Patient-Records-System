---
tags: [changelog]
---

# Changelog

## `4d9045a` — Add admin overview dashboard, responsive UI, multi-select doctor specialties, and remove ID columns from tables
### Dashboard
- New [[Overview Dashboard]] module (`assets/js/modules/overview.js`) registered in the SPA router and set as the default route.
- KPI cards (patients, doctors, staff, services, specialties, discounts) loaded from existing list endpoints, with shimmer loading states.
- Quick actions and a "Recent Patient Registrations" table.

### Responsive shell
- Off-canvas sidebar with hamburger toggle, backdrop, Escape handling, and auto-close on navigation.
- Breakpoints at 1024px / 768px / 520px; tightened tables/toolbars on phones.
- Global `:focus-visible` outlines and `prefers-reduced-motion` support.

### Doctors & users
- Clinical Specialty is now a true **multi-select** (Ctrl/Cmd) in [[Manage Users]] and [[Manage Doctors]]; the junction table stores all selected specialties.
- `user_controller.php` / `doctor_controller.php` accept `specialty_ids[]` (legacy `specialty_id` still supported) with active-specialty validation.

### Tables
- ID columns removed from every list table, the archive table, and all detail modals.
- Asset cache-busting raised to `?v=7`, including ES-module imports.

## `775979f` — test
## `0904117` — Initial commit: Hospital Billing and Patient Information System with Master Files, RBAC, and Centralized Archive
