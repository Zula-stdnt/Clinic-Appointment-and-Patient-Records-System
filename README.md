# Hospital Billing & Patient Information System

A responsive web application designed for healthcare facilities to manage patient records, doctor profiles, medical services, specialties, discounts, user access control, and centralized record archiving.

Built with native PHP, MySQL (PDO), vanilla JavaScript (ES6+ modular SPA architecture), and CSS.

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

- **Role-Based Access Control (RBAC):**
  - **Administrator:** Full management over Master Files (Users, Patients, Doctors, Services, Specialties, Discounts) and the Central Archive.
  - **Doctor & Receptionist:** Dedicated portal views with strict session access enforcement.
- **Master Files Management:**
  - **Users:** Create, view, edit, and archive staff accounts with dynamic role assignment and doctor profile linkage.
  - **Patients:** Maintain patient demographic profiles, contact details, and emergency information.
  - **Doctors:** Manage clinical profiles with linked specialties and contact records.
  - **Services:** Catalog medical procedures, exams, and tests with pricing controls.
  - **Specialties:** Classify clinical departments and medical specialties.
  - **Discounts:** Configure standard and promotional discount percentages.
- **Centralized Archive ("Recycle Bin"):**
  - All deletions operate as non-destructive soft deletes (moving records to the **Manage Archive** section).
  - Archived records can be safely **Restored** to active status or permanently **Hard Deleted**.
- **Security & Validation:**
  - PDO prepared statements against SQL injection.
  - Token-based Cross-Site Request Forgery (CSRF) validation.
  - HTML entity escaping against Cross-Site Scripting (XSS).
  - Secure password hashing using `PASSWORD_DEFAULT` (bcrypt).

---

## Technologies Used

- **Backend:** PHP 8.x (compatible with PHP 7.4+)
- **Database:** MySQL / MariaDB (via PHP Data Objects - PDO)
- **Frontend:** Modular Vanilla JavaScript (ES6 Modules), Axios for HTTP requests
- **Styling:** Custom Responsive CSS (Hospital Green Design System)
- **Environment:** Apache / XAMPP on Windows, macOS, or Linux

---

## Requirements

Before starting, ensure you have the following installed on your computer:
1. **XAMPP** (or WampServer / LAMP / MAMP) with:
   - PHP 7.4 or higher (PHP 8.1+ recommended)
   - MySQL 5.7+ or MariaDB 10.4+
   - Apache Web Server
2. A modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, etc.)
3. Git (for cloning and version control)

---

## Installation & Setup

### Step 1: Clone or Copy the Repository
Place the project inside your web server's public root directory (`htdocs` in XAMPP):

```bash
# If using Windows default XAMPP path:
cd "C:\xampp\htdocs"

# Clone the repository
git clone https://github.com/Zula-stdnt/Hospital-Billing-and-Patient-Information-System.git "Hospital Billing And Patient Information System"
```

---

## Database Setup

### Option A: Using phpMyAdmin (Recommended for Beginners)
1. Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.
2. Open your web browser and navigate to: [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
3. In the left sidebar, click **New** and create a database named:
   ```text
   hospital_db
   ```
   *(Select `utf8mb4_unicode_ci` or `utf8mb4_general_ci` as collation, then click **Create**)*.
4. Select `hospital_db` from the list.
5. Click on the **Import** tab at the top.
6. Click **Choose File** and browse to:
   ```text
   migrations/hospital_db.sql
   ```
7. Scroll to the bottom and click **Import** (or **Go**).

### Option B: Using the MySQL Command Line
If you prefer the command line, run:

```bash
# Windows XAMPP path
C:\xampp\mysql\bin\mysql.exe -u root -p -e "CREATE DATABASE IF NOT EXISTS hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
C:\xampp\mysql\bin\mysql.exe -u root -p hospital_db < "migrations/hospital_db.sql"
```

---

## Configuration

Database credentials are concentrated in [`config/db_connect.php`](config/db_connect.php).

By default, XAMPP uses user `root` with an empty password. If your MySQL server has a password or runs on a different port, update the values accordingly:

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

1. Make sure **Apache** and **MySQL** are running in your XAMPP Control Panel.
2. Open your browser and visit:
   ```text
   http://localhost/Hospital%20Billing%20And%20Patient%20Information%20System/
   ```
   *(Or the folder name you chose under `htdocs`)*.
3. You will be greeted by the **Login** screen.

---

## Default User Accounts

The database comes pre-seeded with sample accounts for testing all user roles:

| Role | Username | Default Password |
| :--- | :--- | :--- |
| **Administrator** | `admin` | `AdminPass123!` |
| **Doctor** | `dr.smith` | `DoctorPass123!` |
| **Receptionist** | `recep.jane` | `RecepPass123!` |

*(Passphrases are case-sensitive)*.

---

## Project Structure

```text
├── api/                     # Backend REST API controllers
│   ├── auth_controller.php
│   ├── user_controller.php
│   ├── doctor_controller.php
│   ├── patient_controller.php
│   ├── service_controller.php
│   ├── specialty_controller.php
│   └── discount_controller.php
├── assets/                  # Frontend static assets
│   ├── css/
│   │   └── style.css        # Hospital Green design system
│   └── js/
│       ├── api.js           # Centralized Axios API wrapper
│       ├── main.js          # SPA Router & view controller
│       ├── session-guard.js # Client-side session/role guard for HTML shells
│       ├── ui.js            # Modals, toasts, and dialog handlers
│       └── modules/         # SPA feature modules (users, archive, etc.)
├── config/
│   └── db_connect.php       # PDO database connection
├── includes/
│   └── auth.php             # Session management & CSRF protection
├── migrations/              # SQL schema and seed files
│   └── hospital_db.sql      # Complete database export
├── tests/                   # Automated PHP test scripts
├── admin_dashboard.html     # Main Administrator panel view (static shell + JS)
├── doctor_dashboard.html    # Doctor portal view
├── receptionist_dashboard.html # Receptionist portal view
├── login.html               # Authentication page
├── index.html               # Redirects to the login page
├── logout.php               # Session termination handler
├── walkthrough.md           # Implementation notes & architecture log
└── README.md                # Project documentation
```

---

## License
Educational project developed for ITE 387. All rights reserved.
weh dinga
:D