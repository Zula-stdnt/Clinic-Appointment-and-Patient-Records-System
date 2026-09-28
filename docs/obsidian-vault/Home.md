---
tags: [moc]
---

# Hospital Billing & Patient Information System

Welcome to the documentation hub for the **ITE 387 Hospital Billing & Patient Information System**. The application is built with **PHP 8** (server-side logic), **MySQL / MariaDB** connected through **PDO** (secure database queries), and a **vanilla JavaScript Single-Page Application (SPA)** front end (which switches screens smoothly in the browser without full page reloads).

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
- [[Roadmap]] — Completed milestones and upcoming features.

## Administrator modules
- [[Overview Dashboard]] — Summary counts and recent patient registrations.
- [[Manage Users]] — Staff login accounts and role assignments.
- [[Manage Patients]] — Patient personal profiles and contact records.
- [[Manage Doctors]] — Doctor profiles and assigned medical specialties.
- [[Manage Services]] — Billable hospital procedures, tests, and prices.
- [[Manage Specialties]] — Medical departments and clinical specialties.
- [[Manage Discounts]] — Discount programs and percentage rates.
- [[Manage Archive]] — Central recycle bin to restore or permanently delete archived records.

## Doctor portal modules
- [[Doctor Dashboard]] — Doctor portal shell, navigation router, and today's appointment counters.
- [[Doctor Appointments]] — Assigned patient schedule and consultation launch screen.
- [[Doctor Consultation]] — Clinical charting screen for notes, diagnoses, prescriptions, and lab orders.
- [[Doctor Patient Records]] — Assigned patient directory and chronological medical history timeline.
- [[Doctor Profile]] — Personal details, contact number, username, and password management.
