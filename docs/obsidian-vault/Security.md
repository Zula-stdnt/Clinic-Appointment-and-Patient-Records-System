---
tags: [security]
---

# Security

Implemented in `includes/auth.php`, `includes/response.php`, and the `api/*_controller.php` files.

## Authentication
- Passwords are stored with `password_hash($password, PASSWORD_DEFAULT)` (bcrypt) and checked with `password_verify()`.
- **Password Complexity Policy**: Required on account creation and password updates. Must contain at least 6 characters, including at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`). Enforced both client-side and server-side.
- **Password Visibility Controls**: Accessible eye-icon buttons on `login.php` and modal forms enable users to toggle between masked and plaintext input with keyboard accessibility and dynamic `aria-label` updates.
- Login failures return a generic "Invalid username or password" for both unknown users and wrong passwords.
- Only roles `Administrator`, `Doctor`, and `Receptionist` may log in; other roles get `403`.
- `session_regenerate_id(true)` after login prevents session fixation.

## Session hardening
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `secure` when HTTPS is detected.
- Session lifetime `0` (browser session).

## RBAC
- `require_login()` and `require_role($roles)` guard every controller.
- HTML pages render a 403 page; API requests return JSON `403`.
- Admin shell (`admin_dashboard.php`) calls `require_role('Administrator')` before any output.

## CSRF
- A 32-byte token (`csrf_token`) is generated per session and injected into the page as a `<meta name="csrf-token">`.
- `api.js` attaches it as `X-CSRF-Token` on POST/PUT/DELETE/PATCH.
- `verify_csrf_on_state_change()` rejects invalid/missing tokens with `403`.

## Brute-force throttling
- Failed logins are tracked per IP in the session; after 5 attempts a delay is applied, after 10 the login is blocked temporarily (reset after 5 minutes).

## Other controls
- **SQL injection:** PDO prepared statements everywhere; whitelisted sort columns.
- **XSS:** all dynamic HTML goes through `escapeHtml()` in `assets/js/ui.js`.
- **Soft delete by default:** destructive actions require explicit confirmation and typed confirmation for hard delete.
