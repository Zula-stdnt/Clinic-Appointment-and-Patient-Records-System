# Hospital Patient Information System

A web application built for hospitals and clinics to manage patient records, doctor profiles, medical consultations, hospital services, clinical specialties, staff accounts, and archived records in one place.

It is built with **PHP** (for server-side logic), **MySQL** via **PDO** (a secure database connector), **vanilla JavaScript** organized as a **Single-Page Application (SPA)** (a web app that switches screens smoothly without reloading the whole browser page), and custom **CSS**.

---

## Table of Contents
- [Patient Records System (Core Clinical Workflow)](#patient-records-system-core-clinical-workflow)
- [Two-Stage Patient Allergy Workflow](#two-stage-patient-allergy-workflow)
- [System Features by Role](#system-features-by-role)
- [Table Sorting and Filtering](#table-sorting-and-filtering)
- [Technologies Used](#technologies-used)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Default User Accounts](#default-user-accounts)
- [Project Structure](#project-structure)

---

## Patient Records System (Core Clinical Workflow)

The core purpose of this system is to manage a patient's complete journey through the clinic:
$$\text{Patient Appointment} \longrightarrow \text{Medical Consultation} \longrightarrow \text{Diagnosis} \longrightarrow \text{Medical History}$$

Below is an overview of how hospital staff use these features in plain, everyday language.

### 1. Creating Patient Appointments
* **Who uses it:** Receptionist
* **When they use it:** When a patient calls in advance or walks into the clinic to schedule an appointment with a doctor.
* **What they see:** The **Appointments** page with a live schedule list, an **Add Appointment** button, a **Register Walk-in** button, and quick search and status filters.
* **What they do:**
  1. Opens the Appointments page.
  2. Clicks the **New Appointment** button (or **Register Walk-in** to register a first-time patient on the spot).
  3. Selects the patient from the list.
  4. Selects an available doctor from the searchable doctor menu.
  5. Selects an appointment date and time between **08:00 AM and 05:00 PM** (the clinic is closed on Sundays and pauses for lunch between 12:00 PM and 12:59 PM).
  6. Types the patient's main health concern in the **Chief Complaint** box.
  7. Optionally records reported patient allergies in the **Allergies & Medical Alerts** field.
  8. Optionally records initial triage vital signs: blood pressure, temperature in °C, and blood oxygen level (SpO2).
  9. Clicks **Schedule Appointment**.
* **What happens:**
  - The system checks doctor availability to ensure double-booking never occurs.
  - The system checks clinic capacity (a maximum of **10 appointments per day** clinic-wide). If the clinic has reached 8 or 9 appointments, a helpful warning notes that the clinic is near capacity. If the day is fully booked (10 appointments), the system asks the receptionist to select another date.
  - The appointment is saved with status **Scheduled**. Once the receptionist sets the appointment to **Confirmed**, it is immediately unlocked for the doctor to start the medical consultation.

### 2. Recording Medical Consultations
* **Who uses it:** Doctor
* **When they use it:** During a patient's medical visit.
* **What they see:** The doctor's **My Appointments** screen showing today's queue, and the **Consultation** screen showing the patient's name, age, gender, triage vital signs, chief complaint, and an amber Allergy Alert Banner if allergies were reported.
* **What they do:**
  1. Opens the Appointments screen and locates the confirmed patient.
  2. Clicks the **Start Consult** button to open the consultation form.
  3. Reviews the patient's triage vital signs, primary complaint, and reported allergy notes.
  4. Types their clinical examination findings into the **Clinical Notes** area (SOAP notes covering symptoms, physical findings, clinical assessment, and care plan).
  5. Records the patient's diagnoses, medications, and any required lab tests.
  6. Clicks **Save & Complete Encounter**.
* **What happens:**
  - The system saves all clinical notes, diagnoses, and medical orders together safely.
  - Any unconfirmed allergy intake notes are automatically verified and promoted to **Doctor Confirmed**.
  - The appointment status updates to **Completed** and is permanently locked to prevent accidental overwriting. Any future clinical notes must be appended as dated addenda.
  - The completed visit becomes a permanent part of the patient's cumulative medical history.

### 3. Recording Diagnoses
* **Who uses it:** Doctor
* **When they use it:** While evaluating the patient's illness or health condition during the consultation.
* **What they see:** The **Diagnosis** section on the consultation screen with a **+ Add Diagnosis** button and input boxes for the diagnosis name, international disease code (ICD-10), and extra clinical notes.
* **What they do:**
  1. Clicks **+ Add Diagnosis** (a doctor can add multiple diagnoses if the patient has more than one condition).
  2. Types the name of the condition (for example, *Acute Bronchitis* or *Hypertension*).
  3. Optionally enters the standard medical classification code (for example, *J20.9* or *I10*).
  4. Optionally types specific instructions or notes for this diagnosis.
  5. If an item was added by mistake, clicks the red remove button to delete the row.
* **What happens:**
  - Every diagnosis is linked directly to this medical encounter.
  - The diagnoses are permanently saved and automatically appear in the patient's medical history for future reference.

### 4. Viewing Patient Medical History
* **Who uses it:** Doctor
* **When they use it:** Before or during an examination to review a patient's past health conditions, previous diagnoses, and treatment plans.
* **What they see:** The **Patient Records** directory showing registered patients with **Assigned** or **Unassigned** badges, and the **Medical Record** screen displaying the patient's personal profile card and an **Encounter History** timeline.
* **What they do:**
  1. Clicks **Patient Records** in the sidebar navigation.
  2. Finds the patient in the list or uses the search box and gender filter to filter records.
  3. For assigned patients, clicks **View Record** to open the chart. For unassigned patients, clicks **Break-Glass** to enter an audited emergency justification before viewing.
  4. Reads the complete timeline of past consultations and treatments.
  5. Clicks **Back to List** when finished.
* **What happens:**
  - The system presents a chronological timeline (most recent visits first) that accumulates **all previous consultations and diagnoses** for that patient.
  - For each past visit, the doctor can clearly see the visit date, chief complaint, recorded vital signs, doctor's notes, all diagnoses with ICD-10 codes, prescribed medicines, and lab orders.

---

## Two-Stage Patient Allergy Workflow

To ensure patient safety while maintaining clinical standards, the system employs a two-stage allergy verification architecture:

1. **Stage 1 (Front-Desk Intake):**
   - The Receptionist records reported allergies in the booking or walk-in registration form.
   - The allergy is saved with `allergies_confirmed_by_doctor = 0` and displays an amber **Unconfirmed Intake Note** badge.
   - Physical printed appointment slips prominently display an allergy alert box to notify attending staff.
2. **Stage 2 (Clinical Verification):**
   - When the Doctor opens the consultation, an amber allergy alert banner is displayed at the top of the chart.
   - Upon completing the consultation, the system automatically elevates the record to `allergies_confirmed_by_doctor = 1` with a green **Doctor Confirmed** badge.
   - If a receptionist updates the patient's demographics later, the allergy status safely resets to unconfirmed until a doctor re-verifies it.

---

## System Features by Role

- **Role-Based Access Control (RBAC — permissions based on a staff member's job role):**
  - **Clinical Access & Privacy Rule:** Clinical medical charts and encounter histories are strictly readable only by doctors who have an active treating relationship (a non-cancelled appointment) with the patient. All other doctor access requires an audited Break-Glass Emergency Override with a mandatory clinical justification. Administrators review access and compliance logs, not patient clinical contents. A patient-facing self-service portal is intentionally out of scope.
  - **Administrator:** Full administrative governance over staff accounts, doctors, services, clinical specialties, compliance audit logs, and the **Central Archive**. Administrators inspect access logs for compliance and do not directly register or edit patient clinical charts.
  - **Doctor:** A dedicated clinical workspace with appointment queue management, consultation charting (clinical notes, ICD-10 diagnoses, prescriptions, and lab requests), longitudinal medical history timelines, dated encounter addenda, and cancellation requests. Doctors request appointment cancellations with a clinical reason, while receptionists manage appointment statuses.
  - **Receptionist:** A dedicated front-desk portal that lands directly on the **Overview Dashboard** upon login. Features include registering walk-in and scheduled patients, updating demographic details with pre-populated forms, booking patient appointments, capturing allergy alerts, recording triage vital signs, and managing appointment lifecycle statuses. Clinical histories are blocked to protect patient privacy.
- **Master Files Management (Administrator):**
  - **Users:** Create, view, edit, and archive staff login accounts. Creating a Doctor user automatically creates a matching clinical profile.
  - **Patients (Governance):** View patient registration directory and manage archive status. Direct registration and demographic edits are handled by front-desk Receptionists.
  - **Compliance & Audit Logs:** Review immutable system audit logs presented in clear, human-readable English for non-coders and hospital administrators rather than raw technical code, tracking Break-Glass emergency access, patient demographic edits, appointment lifecycles, and staff logins, with an on-demand collapsible technical diff viewer.
  - **Doctors:** Manage doctor profiles, contact numbers, and one or more assigned medical specialties. Doctor legal names and genders remain administrator-managed.
  - **Services:** Maintain a catalog of hospital procedures, consultations, lab tests, and imaging services.
  - **Specialties:** Organize medical departments and clinical specialties (such as Cardiology or Pediatrics).
- **Doctor Clinical Portal:**
  - **Dashboard / Today:** Shows live counters for today's total appointments and pending consultations.
  - **Appointments & Cancellation Requests:** Doctors can view their scheduled appointments and triage vital signs. When a doctor cannot attend an appointment, they submit a cancellation request with a reason for the receptionist to process. Direct cancellation by doctors is blocked.
  - **Consultation & Dated Addenda:** Doctors record clinical SOAP notes, ICD-10 diagnoses, prescriptions, and lab test orders. Completed visits are locked to prevent tampering; any subsequent modifications must be recorded as dated, attributed clinical addenda.
  - **Patient Records & Break-Glass:** Browse patients with non-cancelled appointments. If an unassigned patient requires urgent care, the doctor can access the chart using an emergency **Break-Glass Override**, selecting a category and providing an audited clinical justification.
  - **My Profile:** View assigned specialty badges and update contact number, username, and password with current password verification. Legal identity remains admin-managed.
- **Centralized Archive ("Recycle Bin"):**
  - Deleting a record from any main table performs a **soft delete**—instead of erasing the data right away, the system hides it from active lists and moves it to **Manage Archive**.
  - From the Archive, an Administrator can **Restore** a record back to active use or **Hard Delete** it (permanently erase it from the database, as long as no medical or appointment history depends on it).
- **Security & Validation:**
  - **PDO Prepared Statements:** Keeps user input separate from database commands to block **SQL injection** (attempts to trick the database using specially crafted text).
  - **CSRF (Cross-Site Request Forgery) Protection:** Attaches a secret security token to every save or delete action to confirm the request came from the real hospital dashboard.
  - **XSS (Cross-Site Scripting) Protection:** Converts special characters into safe plain text (`escapeHtml`) so user-entered text can never run hidden scripts in the browser.
  - **Password Hashing:** Scrambles passwords into unreadable text using PHP's `PASSWORD_DEFAULT` (**bcrypt**) algorithm so plain-text passwords are never stored.

---

## Table Sorting and Filtering

Every data table across the Administrator, Doctor, and Receptionist portals supports comprehensive sorting and filtering:
- **Interactive Column Header Sorting:** Clicking a column header toggles sorting between ascending (A-Z, oldest first) and descending (Z-A, newest first) order with visual direction indicators (`▲` / `▼`).
- **4-Way Gender Filter:** Allows filtering by:
  - `All Genders` — Displays all records regardless of gender.
  - `Male` — Displays male records.
  - `Female` — Displays female records.
  - `Other` — Displays all custom gender entries (e.g. Transgender, Non-Binary, Queer) cleanly without returning empty tables.
  - `Unknown` — Displays intake records where gender was not specified during emergency admission.
- **Multi-Criteria Search:** Live search across names, phone numbers, specializations, complaints, and dates.
- **Configurable Page Size:** Standardized pagination dropdowns (5, 10, 25 rows per page) with proper visual spacing.

---

## Technologies Used

- **Backend (Server Logic):** PHP 8.x (compatible with PHP 7.4+)
- **Database (Data Storage):** MySQL / MariaDB (connected through **PDO** — PHP Data Objects)
- **Frontend (Browser Interface):** Modular Vanilla JavaScript (**ES6 Modules** — separate, reusable script files), **Axios** (a helper library for sending requests between the browser and the server)
- **Styling:** Custom Responsive CSS (Hospital Green Design System that adapts to desktop, tablet, and phone screens)
- **Environment (Local Web Server):** Apache / XAMPP (or WAMP) on Windows, macOS, or Linux

---

## Requirements

Before starting, make sure you have the following installed on your computer:
1. **XAMPP** (or WampServer / LAMP / MAMP) which bundles:
   - PHP 7.4 or higher (PHP 8.1+ recommended)
   - MySQL 5.7+ or MariaDB 10.4+
   - Apache Web Server
2. A modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, etc.)
3. **Git** (optional, for downloading and tracking code updates)

---

## Installation & Setup

### Step 1: Clone or Copy the Repository
Place the project folder inside your web server's public folder (`htdocs` in XAMPP, or `www` in WAMP):

```bash
# If using the default Windows XAMPP path:
cd "C:\xampp\htdocs"

# Download (clone) the project folder
git clone https://github.com/Zula-stdnt/Hospital-Billing-and-Patient-Information-System.git "Hospital Billing And Patient Information System"
```

---

## Database Setup

### Step 1: Database Import

You can use the XAMPP MySQL terminal to securely import the schema and required defaults.

```bash
# 1. Access the XAMPP Shell or your Windows terminal
# 2. Create a completely new, empty database (do NOT import into an existing database)
C:\xampp\mysql\bin\mysql.exe -u root -p -e "CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Import the exact structural baseline
C:\xampp\mysql\bin\mysql.exe -u root -p hospital_db < setup\schema.sql

# 4. Import the sanitized structural requirements (roles and specialties)
C:\xampp\mysql\bin\mysql.exe -u root -p hospital_db < setup\seeds.sql
```

> **Note:** This fresh-install procedure applies only to newly created databases. Do not import `schema.sql` into an existing working database. Legacy setups used `migrations/hospital_db.sql`, which is now structurally stale and must not be used.

---

## Configuration

Database connection settings are stored in [`config/db_connect.php`](config/db_connect.php).

By default, XAMPP uses the username `root` with a blank password. If your MySQL server uses a password or a different port number, open [`config/db_connect.php`](config/db_connect.php) and update these lines:

```php
// config/db_connect.php
$db_host = '127.0.0.1';
$db_port = '3306';
$db_name = 'hospital_db';
$db_user = 'root';     // Your MySQL username
$db_pass = '';         // Your MySQL password (leave blank for default XAMPP)
$db_charset = 'utf8mb4';
```

---

## Running the Application

1. Confirm that **Apache** and **MySQL** are both running in your XAMPP Control Panel.
2. Open your web browser and visit:
   ```text
   http://localhost/Hospital%20Billing%20And%20Patient%20Information%20System/
   ```
   *(If you placed the project inside a subfolder—such as `3rd Year/ITE 387/Hospital Billing And Patient Information System`—include that subfolder path in the URL).*
3. The browser will open the **Login** screen.

---

## Default User Accounts

The system no longer ships with hardcoded default credentials for security reasons. Instead, you must bootstrap your own Administrator account using the secure command-line tool.

From your terminal or XAMPP Shell, run the script. It will securely prompt for your chosen username and a hidden password:
```bash
php setup/bootstrap_admin.php
```
*(You can use this account to log in and create other Doctor or Receptionist accounts from the Admin Dashboard).*

---

## Project Structure

Here is how the files and folders are organized inside the project:

```text
├── api/                     # Server-side PHP scripts (API controllers) that process data requests
│   ├── appointment_controller.php
│   ├── appointment_patient_controller.php
│   ├── audit_log_controller.php
│   ├── auth_controller.php
│   ├── consultation_controller.php
│   ├── doctor_controller.php
│   ├── doctor_patients_controller.php
│   ├── doctor_profile_controller.php
│   ├── medication_controller.php
│   ├── patient_controller.php
│   ├── patient_record_controller.php
│   ├── service_controller.php
│   ├── specialty_controller.php
│   ├── user_controller.php
│   └── walkin_patient_controller.php
├── assets/                  # Browser files (styles, scripts, and images)
│   ├── css/
│   │   └── style.css        # Hospital Green visual theme and responsive layout rules
│   └── js/
│       ├── api.js           # Central helper that sends requests to api/ and attaches security tokens
│       ├── login.js         # Login page controller with 401-safe session probe
│       ├── main.js          # Administrator dashboard navigation router
│       ├── doctor_main.js   # Doctor portal navigation router
│       ├── receptionist_main.js # Receptionist portal navigation router
│       ├── session-guard.js # Checks that a user is logged in with the right role before showing a page
│       ├── ui.js            # Shared screen helpers (pop-up modals, toast alerts, confirm boxes, formatting)
│       ├── components/      # Reusable UI components (patient record view, walk-in register, appointment print)
│       └── modules/         # Screen modules for Admin, Doctor, and Receptionist portals
├── config/
│   └── db_connect.php       # Database connection setup (PDO)
├── docs/                    # Internal developer documentation vault (Obsidian vault)
│   └── obsidian-vault/      # Architectural guides, API specs, changelogs, and module manuals
├── includes/
│   ├── audit.php            # Audit logging helper for recording system actions
│   ├── auth.php             # Login session checks, role permissions, and CSRF token verification
│   ├── patient_validation.php # Unified patient input validation
│   └── response.php         # Standardized JSON response helpers
├── migrations/              # Database migration history SQL files
├── setup/                   # Fresh installation schema, seeds, and admin bootstrap script
│   ├── bootstrap_admin.php
│   ├── schema.sql
│   └── seeds.sql
├── tests/                   # Automated PHP and UI verification scripts
├── admin_dashboard.html     # Main Administrator workspace page
├── doctor_dashboard.html    # Main Doctor clinical portal page
├── receptionist_dashboard.html # Receptionist workspace page
├── login.html               # Sign-in page
├── index.html               # Entry page that forwards visitors to the login screen
├── logout.php               # Ends the user's login session
├── walkthrough.md           # Step-by-step history of features and fixes built in the project
└── README.md                # Main project guide (this file)
```

---

## License
Educational project developed for ITE 387. All rights reserved.