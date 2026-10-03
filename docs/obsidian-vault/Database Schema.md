---
tags: [database]
---

# Database Schema

The system uses a MySQL / MariaDB database named `hospital_db` (configured with `utf8mb4` / `utf8mb4_unicode_ci` so international characters and symbols are stored cleanly). The full database structure and starter data are saved in `migrations/hospital_db.sql`.

## Conventions
- **Timestamps & Soft Deletes:** Every core record table (**Master File**) includes `created_at` (when the record was made), `updated_at` (when it was last changed), and `deleted_at` (when it was archived). When `deleted_at IS NULL` (empty), the record is **active**. When `deleted_at` has a date and time, the record is **archived (soft-deleted)** and hidden from active lists.
- **Role Lookup Table:** `roles` stores the staff job titles: `Administrator`, `Receptionist`, and `Doctor`.
- **Many-to-Many Specialties (`doctor_specialty`):** Because one doctor can practice multiple specialties and one specialty can belong to multiple doctors, the `doctor_specialty` **junction table** (linking table) pairs `doctor_id` with `specialty_id`.
- **Synchronized Doctor Identity:** Personal identity fields (`first_name`, `last_name`, `middle_initial`, `gender`) live on `users` and are kept in sync with `doctors` whenever an Administrator edits a doctor in [[Manage Doctors]] or a doctor updates their own info in [[Doctor Profile]].

## Core relationships
The **Entity-Relationship Diagram (ERD)** below shows how the database tables connect to one another:

```mermaid
erDiagram
    ROLES ||--o{ USERS : assigns
    USERS ||--o| DOCTORS : "profile link"
    DOCTORS ||--o{ DOCTOR_SPECIALTY : has
    SPECIALTIES ||--o{ DOCTOR_SPECIALTY : groups
    USERS ||--o{ APPOINTMENTS : creates
    PATIENTS ||--o{ APPOINTMENTS : books
    DOCTORS ||--o{ APPOINTMENTS : attends
    APPOINTMENTS ||--o| CONSULTATION : produces
    CONSULTATION ||--o{ DIAGNOSIS : records
    CONSULTATION ||--o{ PRESCRIPTIONS : issues
    CONSULTATION ||--o{ LAB_REQUESTS : requests
    MEDICATIONS ||--o{ PRESCRIPTIONS : prescribed
    APPOINTMENTS ||--o{ VITAL_SIGNS : records
```

## Tables
### Access control
| Table | Key columns | Notes (Plain English) |
| --- | --- | --- |
| `roles` | `role_id`, `role_name` (unique) | Pre-loaded staff roles: Administrator, Receptionist, Doctor |
| `users` | `user_id`, `role_id` → roles, `username` (unique), `password_hash`, `first_name`, `last_name`, `middle_initial`, `gender` (VARCHAR 50), `deleted_at` | Stores staff login accounts, scrambled (`bcrypt`) passwords, and custom gender text |

### Master files
| Table | Key columns | Notes (Plain English) |
| --- | --- | --- |
| `patients` | `patient_id`, `first_name`, `middle_initial`, `last_name`, `gender` (VARCHAR 50), `date_of_birth`, `contact_no`, `address`, `deleted_at` | Patient profiles; `gender` defaults to `'unknown'` for emergency intake and supports custom values |
| `doctors` | `doctor_id`, `user_id` → users (unique), `first_name`, `last_name`, `middle_initial`, `gender`, `contact_no`, `deleted_at` | Linked one-to-one with `users` (`user_id`); kept in sync when a doctor's profile changes |
| `specialties` | `specialty_id`, `specialty_name` (unique), `deleted_at` | List of hospital medical specialties / departments |
| `services` | `service_id`, `service_name` (unique), `deleted_at` | Administrative catalog of hospital services |
| `doctor_specialty` | `doctor_id` + `specialty_id` (composite PK) | Linking table that connects doctors to one or more specialties |
| `medications` | `medication_id`, `name`, `generic_name`, `manufacturer`, `deleted_at` | Active medicine catalog shown in the [[Doctor Consultation]] prescription dropdown |

### Clinical & transactional tables
| Table | Key columns | Notes (Plain English) |
| --- | --- | --- |
| `appointments` | `appointment_id`, `patient_id`, `doctor_id`, `created_by`, `appointment_date`, `appointment_time`, `chief_complaint`, `status` | Patient visits assigned to a doctor; status can be `'scheduled'`, `'confirmed'`, `'completed'`, `'cancelled'`, or `'no_show'` |
| `vital_signs` | `vital_sign_id`, `appointment_id`, `blood_pressure`, `temperature`, `oxygen_saturation` | Triage measurements shown during [[Doctor Consultation]] and inside [[Doctor Patient Records]] |
| `consultation` | `consultation_id`, `appointment_id` (unique), `consultation_date`, `notes` | Main clinical encounter record created or updated when a doctor saves a consultation |
| `diagnosis` | `diagnosis_id`, `consultation_id`, `icd10_code`, `diagnosis_name`, `notes` | Diagnosis items attached to a consultation; refreshed inside a transaction whenever the consultation is saved |
| `prescriptions` | `prescription_id`, `consultation_id`, `medication_id`, `dosage`, `frequency`, `start_date`, `end_date` | Prescribed medicines, dosage instructions, and dates attached to a consultation |
| `lab_requests` | `lab_request_id`, `consultation_id`, `test_name`, `status`, `request_date` | Lab tests ordered during a consultation (`'requested'`, `'in_progress'`, `'completed'`, `'cancelled'`) |

## Soft-delete / restore / hard-delete
Every master-file controller supports three lifecycle steps for removing or recovering records:
1. `soft_delete` — Sets `deleted_at = NOW()` (current date and time). The record is hidden from active screens and appears in [[Manage Archive]].
2. `restore` — Clears the timestamp (`deleted_at = NULL`), returning the record to active lists.
3. `hard_delete` — Permanently deletes the row from the database. If other records (such as patient appointments) still depend on that row, the database's **foreign key** safety rules block the deletion and the server returns a `409 Conflict` message explaining why it cannot be permanently removed.
