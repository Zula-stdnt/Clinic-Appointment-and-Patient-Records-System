# Hospital Patient Information System

A web application built for hospitals and clinics to manage patient records, doctor profiles, medical consultations, hospital services, clinical specialties, staff accounts, and archived records in one place.

It is built with **PHP** (for server-side logic), **MySQL** via **PDO** (a secure database connector), **vanilla JavaScript** organized as a **Single-Page Application (SPA)** (a web app that switches screens smoothly without reloading the whole browser page), and custom **CSS**.

---

## Table of Contents
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Default User Accounts](#default-user-accounts)
- [Project Structure](#project-structure)

---

## Features

- **Role-Based Access Control (RBAC — permissions based on a staff member's job role):**
  - **Administrator:** Full control over the hospital's core records (**Master Files**: Users, Patients, Doctors, Services, and Specialties) and the **Central Archive**.
  - **Doctor:** A dedicated clinical workspace with daily appointment counts, an appointment queue, a consultation charting screen (clinical notes, diagnoses, prescriptions, and lab requests), patient medical histories, and personal profile settings.
  - **Receptionist:** A dedicated front-desk portal for booking patient appointments, recording optional triage vital signs (blood pressure, temperature, oxygen level), and monitoring the visit queue.
- **Master Files Management (Administrator):**
  - **Users:** Create, view, edit, and archive staff login accounts. Creating a Doctor user automatically creates a matching clinical profile.
  - **Patients:** Store patient personal details, birth dates, phone numbers, and home addresses.
  - **Doctors:** Manage doctor profiles, contact numbers, and one or more assigned medical specialties.
  - **Services:** Maintain a catalog of hospital procedures, consultations, lab tests, and imaging services.
  - **Specialties:** Organize medical departments and clinical specialties (such as Cardiology or Pediatrics).
- **Doctor Clinical Portal:**
  - **Dashboard / Today:** Shows live counters for today's total appointments and pending consultations.
  - **Appointments & Consultation:** Doctors can view their scheduled patients, check triage vital signs (blood pressure, temperature, and oxygen level), and record **SOAP notes** (structured clinical notes covering a patient's symptoms, exam findings, assessment, and care plan), **ICD-10 diagnoses** (standard international medical codes), medication prescriptions, and lab test orders in a single all-or-nothing save operation (**database transaction**).
  - **Patient Records:** Browse assigned patients and read a timeline of their past visits, vitals, diagnoses, prescriptions, and lab requests.
  - **My Profile:** View assigned specialty badges and update personal details, phone number, username, and password.
- **Centralized Archive ("Recycle Bin"):**
  - Deleting a record from any main table performs a **soft delete**—instead of erasing the data right away, the system hides it from active lists and moves it to **Manage Archive**.
  - From the Archive, an Administrator can **Restore** a record back to active use or **Hard Delete** it (permanently erase it from the database, as long as no medical or appointment history depends on it).
- **Security & Validation:**
  - **PDO Prepared Statements:** Keeps user input separate from database commands to block **SQL injection** (attempts to trick the database using specially crafted text).
  - **CSRF (Cross-Site Request Forgery) Protection:** Attaches a secret security token to every save or delete action to confirm the request came from the real hospital dashboard.
  - **XSS (Cross-Site Scripting) Protection:** Converts special characters into safe plain text (`escapeHtml`) so user-entered text can never run hidden scripts in the browser.
  - **Password Hashing:** Scrambles passwords into unreadable text using PHP's `PASSWORD_DEFAULT` (**bcrypt**) algorithm so plain-text passwords are never stored.

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
│   ├── auth_controller.php
│   ├── user_controller.php
│   ├── doctor_controller.php
│   ├── patient_controller.php
│   ├── service_controller.php
│   ├── specialty_controller.php
│   ├── appointment_controller.php
│   ├── consultation_controller.php
│   ├── medication_controller.php
│   ├── doctor_patients_controller.php
│   └── doctor_profile_controller.php
├── assets/                  # Browser files (styles, scripts, and images)
│   ├── css/
│   │   └── style.css        # Hospital Green visual theme and responsive layout rules
│   └── js/
│       ├── api.js           # Central helper that sends requests to api/ and attaches security tokens
│       ├── main.js          # Administrator dashboard navigation router
│       ├── doctor_main.js   # Doctor portal navigation router
│       ├── receptionist_main.js # Receptionist portal navigation router
│       ├── session-guard.js # Checks that a user is logged in with the right role before showing a page
│       ├── ui.js            # Shared screen helpers (pop-up modals, toast alerts, confirm boxes, formatting)
│       └── modules/         # Individual screen modules for the Admin and Doctor portals
├── config/
│   └── db_connect.php       # Database connection setup (PDO)
├── includes/
│   └── auth.php             # Login session checks, role permissions, and CSRF token verification
├── migrations/              # Database structure and starter data
│   └── hospital_db.sql      # Complete SQL database file for importing
├── tests/                   # Automated PHP verification scripts
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