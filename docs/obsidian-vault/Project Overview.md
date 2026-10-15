---
tags: [overview]
---

# Project Overview

The **Clinic Patient Records Management System (CPRMS)** is a specialized web application engineered for outpatient clinical care and health records governance. It helps clinic staff manage patient medical charts, physician duty rotas, clinical encounters, diagnostic coding, appointments, user accounts, and archived records in one centralized, real-time environment.

## Clinic Operational Profile & 3-Doctor Rotation Model
The system is tailored for a boutique multi-specialty outpatient facility (*"Healing for Everyone"*), operating under specific operational boundaries:
- **Three (3) Multi-Specialty Attending Physicians:** The clinic is staffed by three doctors with dual specialties operating on fixed, non-overlapping weekly schedules:
  - **Dr. Gregory House:** *Internal Medicine* & *Cardiology* &bull; **Mondays & Tuesdays** (08:00 AM – 05:00 PM)
  - **Dr. Meredith Grey:** *General Surgery* & *Pediatrics* &bull; **Wednesdays & Thursdays** (08:00 AM – 05:00 PM)
  - **Dr. Stephen Strange:** *Neurology* & *Dermatology* &bull; **Fridays & Saturdays** (08:00 AM – 05:00 PM)
  - *Sundays:* **Closed** clinic-wide for sanitization and facility maintenance.
- **Operating Hours & Lunch Break:** Consultations take place strictly between 08:00 AM and 05:00 PM. A mandatory lunch pause is enforced from 12:00 PM to 01:00 PM.
- **Daily Capacity Ceiling:** Clinic intake is capped at `MAX_DAILY_CAPACITY = 10` appointments per day across all physicians to ensure thorough patient evaluations and eliminate physician burnout.
- **Pure Clinical Scope:** Decoupled from financial cashiering and POS transactions (removed via Migration 006) to maintain an uncompromising focus on clinical charting, diagnostic accuracy, and patient privacy.

## Roles
The system separates screens and permissions by staff role (**Role-Based Access Control**):
- **Administrator** — Has full access to all core records (**Master Files**), doctor weekly rota schedules, access request approvals, the **Central Archive**, and the **Compliance & Audit Logs** viewer (`admin_dashboard.html`). See [[Compliance & Audit Logs]].
- **Doctor** — Uses a dedicated clinical workspace (`doctor_dashboard.html`) featuring daily appointment counters, an interactive appointment queue with date range filtering, a consultation charting screen (**SOAP notes**, ICD-10 diagnoses, prescriptions, and lab requests), a directory of assigned patients with their medical histories, hybrid access requests, and personal profile settings. See [[Doctor Dashboard]].
- **Receptionist** — Uses a front-desk workspace (`receptionist_dashboard.html`) featuring an operational overview dashboard with KPI counters, a 10-patient capacity gauge, interactive lobby queue, and the appointment booking engine with real-time doctor duty validation and zero-retype form preservation. See [[Receptionist Overview]] and [[Receptionist Appointments]].

## Patient Records System (Core Clinical Workflow)
The system powers the complete clinical care sequence from patient arrival to long-term health tracking:
1. **Appointment Creation & Duty Validation:** Receptionists schedule patient appointments with available doctors, register walk-in patients on the spot, record triage vital signs, and monitor daily clinic capacity (maximum 10 appointments daily). The booking form proactively validates doctor duty days, clinic hours, and Sunday closures before submission. See [[Receptionist Appointments]].
2. **Consultation Recording:** When appointments are confirmed, doctors open the consultation workspace to document examination observations, vital signs, and SOAP clinical notes. See [[Doctor Consultation]].
3. **Diagnosis Recording:** Doctors record medical diagnoses with international ICD-10 disease codes directly within the consultation encounter, alongside prescriptions and lab requests.
4. **Medical History Generation:** Doctors review an accumulated, chronological timeline of every previous consultation, diagnosis, vital sign reading, and medical treatment for any patient under their care. See [[Doctor Patient Records]].

## Feature summary
- **Master file management (Create, Read, Update, Archive):** Full management of Users, Patients, Doctors, Services, and Specialties.
- **Weekly Doctor Schedule Rota:** Administrators configure 7-day availability rotas with start/end hours and 1-click rotation presets matching clinic doctors. See [[Manage Doctors]].
- **Proactive Form UX & Zero-Retype Protection:** The booking form warns receptionists instantly when an off-duty doctor, Sunday, or out-of-bounds time is selected, while preventing any input wipes or data retyping. See [[Receptionist Appointments]].
- **Hybrid Record Access Model:** Doctors can submit standard 24-hour access requests for admin approval or activate instant emergency break-glass overrides with automated audit tracking. See [[Doctor Patient Records]] and [[Compliance & Audit Logs]].
- **Live Multi-Tab State Synchronization:** Real-time revision polling broadcasts `cprms:sync` browser events, keeping appointment queues and dashboards automatically up-to-date across multiple workstations.
- **Clinical Encounter Workflow:** Doctors check their scheduled patients in [[Doctor Appointments]], record clinical notes, **ICD-10 diagnoses** (standard international medical codes), medication prescriptions, and lab orders in [[Doctor Consultation]], and review past visit timelines in [[Doctor Patient Records]].
- **Self-Service Doctor Profile:** Doctors can update their own name, gender, mobile number, username, and password in [[Doctor Profile]], which automatically updates both the `users` and `doctors` database tables at the same time.
- **Multiple Clinical Specialties:** A single doctor account can be assigned to **one or more clinical specialties** (for example, Internal Medicine and Cardiology).
- **Safe Archiving (Soft Deletes):** Removing a record from any main screen does not immediately erase it. Instead, the system marks it with a deletion timestamp (`deleted_at`) and moves it to [[Manage Archive]], where an Administrator can either restore it or permanently delete it.
- **Human-Readable Compliance & Audit Trail:** Records all security events, Break-Glass emergency overrides, demographic changes, and appointment status transitions. Features a human-readable administrator viewer that translates raw JSON diffs into plain, simple English with an on-demand collapsible technical details toggle. See [[Compliance & Audit Logs]].
- **Responsive Dashboard Layouts:** Clean, no-horizontal-scroll tables at 100% zoom with dedicated Chief Complaint columns, stacked Triage Vitals badges, date range pickers, and configurable rows-per-page (10, 25, 50). See [[Receptionist Overview]] and [[Doctor Dashboard]].
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
See [[Architecture#Folder map]] for an overview of every folder and the project `README.md` for installation steps. [[Setup (WAMP or XAMPP)]] explains how to set up the project on a WAMP or XAMPP workstation.
