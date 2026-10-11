---
tags: [api]
---

# API Endpoints

An **API (Application Programming Interface)** is the set of server URLs that the browser talks to behind the scenes to load or save data. All PHP controllers live in the `api/` folder and reply in **JSON** format with either `{ success, message, data }` when an action succeeds or `{ success, message, errors }` when something needs fixing (defined in `includes/response.php`).

## Authentication
These endpoints handle signing in, signing out, and checking who is currently logged in:

| Endpoint | Method | Action | Notes (Plain English) |
| --- | --- | --- | --- |
| `api/auth_controller.php?action=login` | POST | Login | Sends JSON `{ username, password }`; returns the dashboard `redirect` URL, staff `role`, and `csrf_token` security badge |
| `api/auth_controller.php?action=logout` | POST | Logout | Ends the current login session |
| `api/auth_controller.php?action=me` | GET | Session status | Returns the currently logged-in user's details and active CSRF token (returns 401 if not logged in) |
| `api/auth_controller.php?action=check` | GET | Safe session probe | Returns `{ logged_in: boolean }` with HTTP 200 OK to prevent red 401 console errors on login page |

## Master-file controllers
These controllers manage core record tables. `user_controller.php`, `service_controller.php`, and `specialty_controller.php` require **Administrator** login. `doctor_controller.php` allows **Receptionist** read access (`GET`) for dashboard doctor rosters:

| Controller | List | Read | Create | Update | Soft delete (Archive) | Restore | Hard delete (Permanent) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `user_controller.php` | `GET ?page&page_size&search&status&role&sort_by&sort_order` | `GET ?id` | `POST` | `PUT ?id` | `PUT/POST ?action=soft_delete&id` | `?action=restore&id` | `DELETE ?id` |
| `patient_controller.php` | `GET ?page&page_size&search&status&gender&sort_by&sort_order` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `doctor_controller.php` | `GET ?page&page_size&search&status&specialty_id&gender&sort_by&sort_order` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `service_controller.php` | `GET ?page&page_size&search&status&sort_by&sort_order` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `specialty_controller.php` | `GET ?page&page_size&search&status&sort_by&sort_order` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |

The `status` query option accepts `active` (default — only active records), `deleted` (only archived records, used by [[Manage Archive]]), or `all`.

## Doctor portal & clinical controllers
These endpoints power the Doctor clinical workspace and enforce strict privacy so a doctor only accesses their own appointments and authorized patients:

| Controller | Allowed Roles | Method & Query | Purpose |
| --- | --- | --- | --- |
| `appointment_controller.php` | `Administrator`, `Receptionist`, `Doctor` | `GET` / `GET ?id&date_filter&sort_by&sort_order` | Lists appointments (`data.items`) or fetches one appointment (`data.item`). When called by a `Doctor`, automatically filters rows to that doctor's `doctor_id`. Supports `allergies_alerts` and `allergies_confirmed_by_doctor`. |
| `appointment_controller.php` | `Administrator`, `Receptionist`, `Doctor` | `POST` | Books a patient appointment (`status = 'scheduled'`, `created_by` = logged-in user) and, when triage values are included, saves a linked `vital_signs` row and allergy note (`allergies_alerts`). Rejects a duplicate active booking for the same doctor, date, and time with `409`. |
| `appointment_controller.php` | `Administrator`, `Receptionist`, `Doctor` | `GET ?meta=patients` / `GET ?meta=doctors` | Dropdown options for the booking form: active patients (with allergy data) and active doctors (with specialty names). |
| `consultation_controller.php` | `Doctor`, `Administrator` | `GET ?appointment_id` | Loads patient info, triage vitals (`vital_signs`), and any saved consultation (`consultation`, `diagnosis`, `prescriptions`, `lab_requests`). Blocks access (`403`) if the appointment belongs to another doctor. |
| `consultation_controller.php` | `Doctor`, `Administrator` | `POST` | Saves or updates a consultation inside one all-or-nothing database transaction (`consultation`, `diagnosis`, `prescriptions`, `lab_requests`), marks `appointments.status = 'completed'`, and promotes `allergies_confirmed_by_doctor = 1`. |
| `consultation_controller.php` | `Doctor` | `POST ?action=addendum` | Appends a timestamped, signed addendum note to a completed consultation without modifying the original notes. |
| `medication_controller.php` | `Administrator`, `Doctor` | `GET` / `GET ?id` | Returns active medicines (`deleted_at IS NULL`) for the prescription dropdown (`data.items`). |
| `doctor_patients_controller.php` | `Doctor` | `GET ?action=list&page&page_size&search&assignment_status&gender&sort_by&sort_order` | Returns a paged list of all hospital patients with an `is_assigned` indicator (`data.items`, `data.total`). |
| `doctor_patients_controller.php` | `Doctor` | `POST ?action=break_glass&patient_id` | Grants emergency access to an unassigned patient chart upon submitting a verified clinical justification, logging the action to `audit_logs`. |
| `doctor_patients_controller.php` | `Doctor` | `GET ?action=history&patient_id` | Confirms the patient is linked to the logged-in doctor or has active emergency override (`403` otherwise) and returns `{ patient, encounters }` with their full medical visit timeline. |
| `doctor_profile_controller.php` | `Doctor` | `GET` / `PUT` / `POST` | Reads (`data.profile`) or updates the logged-in doctor's name, gender, mobile number, username, and password across `users` and `doctors`, and refreshes `$_SESSION['full_name']` and `$_SESSION['username']`. |

## Compliance & audit trail controllers
These endpoints allow administrators to inspect immutable security and access logs:

| Controller | Allowed Roles | Method & Query | Purpose |
| --- | --- | --- | --- |
| `audit_log_controller.php` | `Administrator` | `GET ?page&page_size&search&action&date_filter&sort_by&sort_order` | Returns paged immutable audit log entries (`data.items`, `data.total`). Tracks Break-Glass access, demographic edits with old/new values, and appointment cancellations. |

## Meta lookups
These helper requests return dropdown options for forms:

| Endpoint | Returns |
| --- | --- |
| `user_controller.php?meta=roles` | Available staff roles (Doctor and Receptionist) for user account forms |
| `user_controller.php?meta=specialties` | Active clinical specialties for user account forms |
| `doctor_controller.php?meta=specialties` | Active clinical specialties for doctor forms |
| `appointment_controller.php?meta=patients` | Active patients (with friendly identifiers and allergy data) for the booking form |
| `appointment_controller.php?meta=doctors` | Active doctors (with their specialty names) for the booking form |

## Input validation rules
To keep database records clean and consistent, create and update endpoints enforce these rules:
- **Names**: `first_name` and `last_name` are required (up to 80 characters). `middle_initial` is optional (up to 5 characters in Admin master files, up to 10 characters in Doctor Profile).
- **Gender**: Required text (up to 50 characters); supports `"Male"`, `"Female"`, `"Other"` (with custom text entered by the user), and `"Unknown"`. When filtering by `"Other"`, the backend safely matches all custom non-binary gender values.
- **Contact Number**: `contact_no` is optional. When provided, spaces are removed and the number must be exactly 11 digits starting with `09` (for example, `09171234567`).
- **Password**: Must be at least 6 characters and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`). When editing an existing account, leaving the password blank keeps the current password unchanged. In `doctor_profile_controller.php`, setting a new password also requires entering the correct `current_password` and a matching `confirm_password`.

## Specialty payloads
When creating or updating a doctor in `user_controller.php` or `doctor_controller.php`, the request sends **`specialty_ids`** as a list (array) of specialty IDs:
```json
{
  "first_name": "Gregory",
  "last_name": "House",
  "middle_initial": "R",
  "gender": "Male",
  "contact_no": "09171234567",
  "username": "dr.house",
  "password": "Password123!",
  "specialty_ids": [2, 7]
}
```
For backward compatibility, a single `specialty_id` value is still accepted. Every chosen specialty must be active, and the `doctor_specialty` linking table is refreshed whenever a doctor's specialties are updated.

## Access rules
- **Administrator Endpoints:** Master-file endpoints and `audit_log_controller.php` check `require_login()` and `require_role('Administrator')`.
- **Receptionist Endpoints:** Front-desk endpoints (`appointment_controller.php`) check `require_login()` and `require_role(['Administrator', 'Receptionist', 'Doctor'])`. A `Doctor` only sees their own appointments; a `Receptionist` sees the whole booking queue. Receptionists also have read access to `doctor_controller.php`.
- **Doctor Portal Endpoints:** Check `require_login()` and `require_role(['Doctor'])` (or `['Doctor', 'Administrator']`), and also verify that the record belongs to the logged-in doctor's `doctor_id` or that an authorized emergency break-glass override is active.
- **CSRF Protection on Changes:** Every request that creates, edits, or deletes data (`POST`, `PUT`, `DELETE`, `PATCH`) must include a valid `X-CSRF-Token` security header.
- **Foreign Key Protection:** If a record is linked to existing hospital activity (such as a doctor who has scheduled appointments), permanent deletion is blocked and the server responds with `409 Conflict`.
