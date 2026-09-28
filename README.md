# Hospital Billing & Patient Information System

A web application built for hospitals and clinics to manage patient records, doctor profiles, medical consultations, hospital services, clinical specialties, billing discounts, staff accounts, and archived records in one place.

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
  - **Administrator:** Full control over the hospital's core records (**Master Files**: Users, Patients, Doctors, Services, Specialties, and Discounts) and the **Central Archive**.
  - **Doctor:** A dedicated clinical workspace with daily appointment counts, an appointment queue, a consultation charting screen (clinical notes, diagnoses, prescriptions, and lab requests), patient medical histories, and personal profile settings.
  - **Receptionist:** A dedicated front-desk portal protected by login session checks.
- **Master Files Management (Administrator):**
  - **Users:** Create, view, edit, and archive staff login accounts. Creating a Doctor user automatically creates a matching clinical profile.
  - **Patients:** Store patient personal details, birth dates, phone numbers, and home addresses.
  - **Doctors:** Manage doctor profiles, contact numbers, and one or more assigned medical specialties.
  - **Services:** Maintain a price list of hospital procedures, consultations, lab tests, and imaging services.
  - **Specialties:** Organize medical departments and clinical specialties (such as Cardiology or Pediatrics).
  - **Discounts:** Set up percentage discounts (such as Senior Citizen, PWD, or PhilHealth).
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

### Option A: Using phpMyAdmin (Recommended for Beginners)
1. Open the **XAMPP Control Panel** and click **Start** next to both **Apache** and **MySQL**.
2. Open your web browser and go to: [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
3. In the left sidebar, click **New** and create a database named:
   ```text
   hospital_db
   ```
   *(Choose `utf8mb4_unicode_ci` or `utf8mb4_general_ci` from the character formatting dropdown, then click **Create**)*.
4. Click `hospital_db` in the left sidebar to select it.
5. Click the **Import** tab along the top menu.
6. Click **Choose File** and select the SQL setup file inside the project folder:
   ```text
   migrations/hospital_db.sql
   ```
7. Scroll to the bottom and click **Import** (or **Go**). This automatically creates all tables and loads sample test accounts.

### Option B: Using the MySQL Command Line
If you prefer using a terminal or command prompt, run:

```bash
# Windows XAMPP path
C:\xampp\mysql\bin\mysql.exe -u root -p -e "CREATE DATABASE IF NOT EXISTS hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
C:\xampp\mysql\bin\mysql.exe -u root -p hospital_db < "migrations/hospital_db.sql"
```

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

The database comes pre-loaded with sample login accounts so you can test each staff role right away:

| Role | Username | Default Password |
| :--- | :--- | :--- |
| **Administrator** | `admin` | `AdminPass123!` |
| **Doctor** | `dr.smith` | `DoctorPass123!` |
| **Receptionist** | `recep.jane` | `RecepPass123!` |

*(Passwords are case-sensitive.)*

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
│   ├── discount_controller.php
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