---
tags: [changelog]
---

# Changelog

## Recent — Admin Dashboard UX Modernization, Validation, and Bug Fixes
### Manage Users & Doctors
- Added optional Middle Initial across user and doctor modal forms.
- Replaced static gender dropdowns with disabled "Select Gender" placeholders and integrated a dynamic text input when "Other" is chosen.
- Implemented real-time Philippine mobile number formatting (`09XX XXX XXXX` 4-3-4 pattern) with cursor-tracking logic for Backspace, Delete, and pasting without jumping.
- Added password complexity requirements helper text and enforced validation (min 6 chars, uppercase, lowercase, number, special char).
- Integrated accessible eye-icon buttons for toggling password visibility.
- Improved Doctors table layout by rendering multiple clinical specialties as compact, stacked wrapping badges constrained to 250px.
- Synchronized server-side validation in `user_controller.php` and `doctor_controller.php`.

### Manage Patients
- Added optional Middle Initial to Add/Edit Patient modal forms.
- Integrated "Other" custom gender input while retaining "Unknown" for emergency triage / HL7 standards.
- Formatted contact numbers as `09XX XXX XXXX` with smart cursor tracking and 11-digit server validation.
- Standardized database column `patients.gender` to `VARCHAR(50) DEFAULT 'unknown'`.

### Manage Archive Fixes
- Fixed `doctor_controller.php` default sorting fallback from `'d.doctor_id'` to `'doctor_id'`, resolving SQL 1054 `d.d.doctor_id` column errors.
- Added `LEFT JOIN users u` to the doctor count query so name searches in the archive execute cleanly.

### Authentication & Shell
- Added an accessible eye-icon toggle button to `login.php` with dynamic `aria-label` updates.
- Incremented client cache-busting to `?v=13`.

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
