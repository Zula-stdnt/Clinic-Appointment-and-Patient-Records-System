---
tags: [overview]
---

# Project Overview

The **Hospital Billing & Patient Information System** is a web application for hospital administration and clinical care. It helps hospital staff manage patient records, doctor profiles, medical consultations, hospital services, clinical specialties, billing discounts, user accounts, and archived records in one central system.

## Roles
The system separates screens and permissions by staff role (**Role-Based Access Control**):
- **Administrator** — Has full access to all core hospital records (**Master Files**) and the **Central Archive** (`admin_dashboard.html` / `admin_dashboard.php`).
- **Doctor** — Uses a dedicated clinical workspace (`doctor_dashboard.html`) featuring daily appointment counters (**KPIs** — Key Performance Indicators), an appointment queue, a consultation charting screen (**SOAP notes**, diagnoses, prescriptions, and lab requests), a directory of assigned patients with their medical histories, and a personal profile settings screen. See [[Doctor Dashboard]].
- **Receptionist** — Signs in to a dedicated front-desk portal (`receptionist_dashboard.html`, currently a placeholder view for upcoming scheduling and intake features).

## Feature summary
- **Master file management (Create, Read, Update, Archive):** Full management of Users, Patients, Doctors, Services, Specialties, and Discounts.
- **Clinical Encounter Workflow:** Doctors check their scheduled patients in [[Doctor Appointments]], record clinical notes, **ICD-10 diagnoses** (standard international medical codes), medication prescriptions, and lab orders in [[Doctor Consultation]], and review past visit timelines in [[Doctor Patient Records]].
- **Self-Service Doctor Profile:** Doctors can update their own name, gender, mobile number, username, and password in [[Doctor Profile]], which automatically updates both the `users` and `doctors` database tables at the same time.
- **Multiple Clinical Specialties:** A single doctor account can be assigned to **one or more clinical specialties** (for example, Internal Medicine and Cardiology).
- **Safe Archiving (Soft Deletes):** Removing a record from any main screen does not immediately erase it. Instead, the system marks it with a deletion timestamp (`deleted_at`) and moves it to [[Manage Archive]], where an Administrator can either restore it or permanently delete it.
- **Clear Form Validation:** Both the browser and the server check form inputs and display helpful error messages directly underneath any field that needs attention.
- **Built-In Security:** Role-based access checks, doctor-only data privacy, **CSRF tokens** (security badges that verify form submissions came from the real app), and login rate-limiting protect the system — see [[Security]].

## Technology stack
| Layer | Choice | What It Does in Plain English |
| --- | --- | --- |
| Backend | PHP 8.x, PDO prepared statements | Runs on the server, checks permissions, and talks safely to the database |
| Database | MySQL 5.7+ / MariaDB 10.4+ (`hospital_db`) | Stores all hospital tables, relationships, and medical records |
| Frontend | Vanilla JS ES modules (hash SPA), Axios | Updates the screen smoothly without full page reloads and sends requests to PHP |
| Styling | Custom CSS design system (hospital green) | Controls the visual theme, colors, pop-up modals, and mobile-friendly layouts |
| Server | Apache via XAMPP / WAMP | Local web server software that hosts the PHP files and MySQL database |

## Repository layout
See [[Architecture#Folder map]] for an overview of every folder and the project `README.md` for installation steps. [[Setup (WAMP)]] explains how to set up the project on a WAMP workstation.
