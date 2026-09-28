---
tags: [security]
---

# Security

Security protections are built directly into `includes/auth.php`, `includes/response.php`, `assets/js/session-guard.js`, `assets/js/ui.js`, and every controller inside `api/*_controller.php`.

## Authentication
- **Password Hashing:** Passwords are never saved in plain text. Instead, they are scrambled using `password_hash($password, PASSWORD_DEFAULT)` (**bcrypt**) and checked at sign-in with `password_verify()`.
- **Password Complexity Policy:** Every new account or updated password must be at least 6 characters long and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`). This rule is checked in both the browser form and the PHP server script.
- **Password Visibility Controls:** Accessible eye-icon buttons on `login.php` / `login.html` and inside pop-up forms let users switch between hidden dots and readable text, complete with keyboard support and screen-reader labels (`aria-label`).
- **Safe Login Error Messages:** If a login fails, the server returns a general `"Invalid username or password"` message for both unknown usernames and wrong passwords, so an attacker cannot guess which usernames exist.
- **Allowed Login Roles:** Only accounts with the role `Administrator`, `Doctor`, or `Receptionist` are allowed to sign in; any other role receives a `403 Forbidden` response.
- **Session ID Refresh:** Right after a successful sign-in, PHP runs `session_regenerate_id(true)` to issue a brand-new session ID, preventing **session fixation** (a trick where someone tries to hijack an old session ID).

## Session hardening
- **Secure Cookie Settings:** Session cookies use `HttpOnly` (blocking browser scripts from reading the cookie), `SameSite=Lax` (protecting against cross-site cookie misuse), and `secure` whenever an encrypted HTTPS connection is active.
- **Session Lifetime:** Set to `0`, meaning the login session ends when the browser is closed.

## RBAC (Role-Based Access Control)
- Every server controller calls `require_login()` (to confirm the user is signed in) and `require_role($roles)` (to confirm their job role is allowed to use that feature).
- Unauthorized page visits show a `403` access-denied screen, while unauthorized API requests return a JSON `403` error.
- Both the HTML page shells (`assets/js/session-guard.js`) and PHP dashboard shells (`admin_dashboard.php`) verify the user's role before showing any workspace content.

## CSRF (Cross-Site Request Forgery Protection)
- **What It Is:** A security measure that ensures save, edit, and delete actions genuinely come from the hospital dashboard and not from a malicious outside website.
- **How It Works:** A random 32-byte security badge (`csrf_token`) is created for each login session.
- `assets/js/api.js` automatically attaches this badge in the `X-CSRF-Token` request header whenever the app sends a `POST`, `PUT`, `DELETE`, or `PATCH` request.
- On the server, `verify_csrf_on_state_change()` checks the badge and rejects any missing or mismatched token with `403 Forbidden`.

## Brute-force throttling
- To stop automated password guessing (**brute-force attacks**), failed sign-in attempts are counted per IP address in the session. After 5 failed tries, the server adds a short pause; after 10 failed tries, sign-in is temporarily locked for 5 minutes.

## Other controls
- **SQL injection protection:** All database queries use **PDO prepared statements** (which keep user-typed values separate from SQL commands), and table sorting columns are checked against a strict allow-list.
- **XSS (Cross-Site Scripting) protection:** All user-supplied text inserted into dynamic HTML is passed through `escapeHtml()` in `assets/js/ui.js`, turning special characters into harmless text so hidden scripts can never run.
- **Soft delete by default:** Clicking **Archive** on any main screen hides the record instead of destroying it, and permanently deleting a record from the Archive requires typing `DELETE` to confirm.
