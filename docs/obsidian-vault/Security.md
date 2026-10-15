---
tags: [security]
---

# Security

Security protections are built directly into `includes/auth.php`, `includes/audit.php`, `includes/response.php`, `assets/js/session-guard.js`, `assets/js/ui.js`, and every controller inside `api/*_controller.php`.

## Authentication
- **Password Hashing:** Passwords are never saved in plain text. Instead, they are scrambled using `password_hash($password, PASSWORD_DEFAULT)` (**bcrypt**) and checked at sign-in with `password_verify()`.
- **Password Complexity Policy:** Every new account or updated password must be at least 6 characters long and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`). This rule is checked in both the browser form and the PHP server script.
- **Password Visibility Controls:** Accessible eye-icon buttons on `login.php` / `login.html` and inside pop-up forms let users switch between hidden dots and readable text, complete with keyboard support and screen-reader labels (`aria-label`).
- **Safe Login Error Messages:** If a login fails, the server returns a general `"Invalid username or password"` message for both unknown usernames and wrong passwords, so an attacker cannot guess which usernames exist.
- **Safe Session Probe:** `api/auth_controller.php?action=check` provides a 200 OK check (`{ logged_in: false }`) that avoids noisy 401 console errors on initial page visits while preserving strict security.
- **Allowed Login Roles:** Only accounts with the role `Administrator`, `Doctor`, or `Receptionist` are allowed to sign in; any other role receives a `403 Forbidden` response.
- **Session ID Refresh:** Right after a successful sign-in, PHP runs `session_regenerate_id(true)` to issue a brand-new session ID, preventing **session fixation** (a trick where someone tries to hijack an old session ID).

## Session hardening
- **Secure Cookie Settings:** Session cookies use `HttpOnly` (blocking browser scripts from reading the cookie), `SameSite=Lax` (protecting against cross-site cookie misuse), and `secure` whenever an encrypted HTTPS connection is active.
- **Session Lifetime:** Set to `0`, meaning the login session ends when the browser is closed.

## RBAC (Role-Based Access Control)
- Every server controller calls `require_login()` (to confirm the user is signed in) and `require_role($roles)` (to confirm their job role is allowed to use that feature).
- Unauthorized page visits show a `403` access-denied screen, while unauthorized API requests return a JSON `403` error.
- **Receptionist Clinical History Isolation:** Receptionists are strictly prevented from viewing medical consultation notes, encounter diagnoses, and prescriptions on both client and server sides. They are granted access exclusively to patient demographics and appointment scheduling queues.
- **Doctor Ownership Gating:** Doctors can only read medical histories for patients who have an active appointment under their care. Accessing any unassigned patient chart requires passing the Break-Glass emergency override barrier.

## Emergency Access & Hybrid Access Model
The system enforces a two-tier access request architecture (`record_access_requests`) governed by `api/access_request_controller.php`:
- **Standard Access Requests:** For planned coverage, second opinions, or multi-specialty referrals where there is no immediate life threat. An unassigned physician submits a request with clinical justification (minimum 10 characters). An Administrator reviews the request in the admin access review queue and approves it, granting a temporary 24-hour record access window (`expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)`).
- **Urgent Break-Glass Protocol:** For emergency trauma, resuscitation, or unconscious patients requiring instantaneous chart access. The physician selects Urgent mode with emergency justification, immediately unlocking the chart with a prominent red alert banner. The system instantly logs `BREAK_GLASS_ACCESS` to the immutable `audit_logs` and flags the request (`is_audit_flagged = 1`) for mandatory post-access administrative audit and sign-off.

## Immutable Compliance Audit Trail
- Critical security and administrative events are recorded in an immutable `audit_logs` database table via `includes/audit.php`.
- Tracked events include Break-Glass emergency overrides, patient demographic modifications (logging old and new values for accountability), user profile changes, doctor weekly schedule updates, staff logins, and appointment lifecycle changes.
- Administrators review these entries through a dedicated audit viewer (`assets/js/modules/audit_logs.js`) with date range, user, action, and keyword filters.
- **Human-Readable Presentation:** To make security logs accessible to non-coders and hospital administrators, technical JSON payloads and diffs are automatically converted into clear, natural English sentences (e.g., "Doctor logged in", "Appointment created for patient Jose Rizal and assigned to Dr. Gregory House", "Appointment status changed from Scheduled to Confirmed").
- **Audit Verification & Technical Diff:** For IT auditing and forensic verification, each row provides an on-demand collapsible `<details>` toggle to inspect original before-and-after JSON diffs without cluttering the clean administrative view.

## Clinical Integrity & Schedule Constraints
- **Encounter Locking:** Completed consultations are permanently locked to protect medical record integrity and prevent post-consultation tampering.
- **Attributed Addenda:** If a doctor needs to record additional observations after completing an encounter, they must append a timestamped, signed consultation addendum (`consultation_addenda`) rather than modifying past notes.
- **Two-Stage Allergy Verification:** Patient-reported allergies recorded at intake remain unconfirmed until explicitly reviewed and confirmed by an attending physician during consultation.
- **Double-Booking & Slot Constraints:** Unique database constraints prevent scheduling overlapping active appointments for the same doctor at the same time.
- **Doctor Duty Rota Enforcement:** Appointments can only be booked on days when the selected doctor has an active weekly schedule in `doctor_schedules`.
- **Operating Hours & Lunch Break Protection:** Clinic operating hours are strictly enforced between 08:00 AM and 05:00 PM. Appointments cannot be scheduled during the clinic's mandatory lunch break (12:00 PM – 01:00 PM) or on Sundays when the clinic is closed.
- **Daily Clinic Capacity Ceiling:** Appointment volume is bounded by `MAX_DAILY_CAPACITY = 10` appointments clinic-wide per day, ensuring patient safety and preventing staff overload.

## CSRF (Cross-Site Request Forgery Protection)
- A random 32-byte security badge (`csrf_token`) is created for each login session.
- `assets/js/api.js` automatically attaches this badge in the `X-CSRF-Token` request header whenever the app sends a `POST`, `PUT`, `DELETE`, or `PATCH` request.
- On the server, `verify_csrf_on_state_change()` checks the badge and rejects any missing or mismatched token with `403 Forbidden`.

## Brute-force throttling
- Failed sign-in attempts are counted per IP address in the session. After 5 failed tries, the server adds a short pause; after 10 failed tries, sign-in is temporarily locked for 5 minutes.

## Other controls
- **SQL injection protection:** All database queries use **PDO prepared statements**, and table sorting columns are checked against a strict allow-list.
- **XSS (Cross-Site Scripting) protection:** All user-supplied text inserted into dynamic HTML is passed through `escapeHtml()` in `assets/js/ui.js`.
- **Soft delete by default:** Records are archived with `deleted_at = NOW()` instead of destroyed, and permanent hard deletion requires typing `DELETE` to confirm.
