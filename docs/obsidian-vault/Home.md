---
tags: [moc]
---

# Hospital Patient Information System

Welcome to the documentation hub for the **ITE 387 Hospital Patient Information System**. The application is built with **PHP 8** (server-side logic), **MySQL / MariaDB** connected through **PDO** (secure database queries), and a **vanilla JavaScript Single-Page Application (SPA)** front end (which switches screens smoothly in the browser without full page reloads).

## Core notes
- [[New Developer Manual]] — Onboarding checklist for new team members setting up the project.
- [[Project Overview]] — What the system does, who uses it, and what technologies power it.
- [[Architecture]] — How the browser screens, JavaScript routers, PHP controllers, and database fit together.
- [[Database Schema]] — Every database table, relationship diagram, and how archiving works.
- [[Database Migrations]] — How to keep your local database tables in sync after pulling updates.
- [[Team Sync]] — Daily Git workflow for pulling, committing, rebasing, and pushing with the team.
- [[API Endpoints]] — All server URLs, request formats, validation rules, and access permissions.
- [[Security]] — How passwords, login sessions, role permissions, and forms are protected.
- [[Setup (WAMP or XAMPP)]] — Step-by-step instructions to run the project on a local WAMP or XAMPP computer.
- [[Changelog]] — Chronological history of features, improvements, and bug fixes.
- [[Development Log]] — Per-commit record of what changed, the commit IDs, and how to verify each change.
- [[Roadmap]] — Completed milestones and upcoming features.

## Administrator modules
- [[Overview Dashboard]] — Summary counts and recent patient registrations.
- [[Manage Users]] — Staff login accounts and role assignments.
- [[Manage Patients]] — Patient personal profiles and contact records.
- [[Manage Doctors]] — Doctor profiles, multiple medical specialties, and weekly duty schedule rota configuration.
- [[Manage Services]] — Administrative catalog of hospital services.
- [[Manage Specialties]] — Medical departments and clinical specialties.
- [[Manage Archive]] — Central recycle bin to restore or permanently delete archived records.
- [[Compliance & Audit Logs]] — Immutable security audit trail, emergency break-glass reviews, doctor schedule audits, and human-readable event details.

## Doctor portal modules
- [[Doctor Dashboard]] — Doctor portal shell, navigation router, interactive queue table, date range filters, and multi-tab live sync.
- [[Doctor Appointments]] — Assigned patient schedule, triage vitals display, and consultation launch screen.
- [[Doctor Consultation]] — Clinical charting screen for notes, diagnoses, prescriptions, and lab orders.
- [[Doctor Patient Records]] — Assigned patient directory, hybrid access requests, break-glass protocol, and chronological medical history timeline.
- [[Doctor Profile]] — Personal details, contact number, username, and password management.

## Core Clinical Flow (Patient Records System)
The system guides hospital staff through the complete clinical workflow:
`Appointment → Consultation → Diagnosis → Medical History`
- [[Receptionist Overview]] — Front-desk landing dashboard with KPI metrics, daily capacity gauge, lobby queue, and multi-tab live synchronization.
- [[Receptionist Appointments]] — Front-desk appointment scheduling, doctor schedule duty validation, walk-in patient registration, triage vital signs, and daily clinic capacity management.
- [[Doctor Appointments]] — Doctor schedule queue, confirmation gating, and consultation launching.
- [[Doctor Consultation]] — Clinical charting for SOAP examination notes, ICD-10 diagnoses, prescriptions, and lab orders.
- [[Doctor Patient Records]] — Patient directory and dynamic, accumulated medical history timeline.

## Receptionist portal modules
- [[Receptionist Overview]] — Front-desk landing dashboard with KPI metrics, daily capacity gauge, lobby queue, and date range filters.
- [[Receptionist Appointments]] — Front-desk appointment booking, live doctor schedule duty warnings, walk-in registration, and triage vital signs.
