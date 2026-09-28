---
tags: [module]
---

# Doctor Profile

**Route:** `#doctor_profile` · **File:** `assets/js/modules/doctor_profile.js` · **Controller:** `api/doctor_profile_controller.php` · **Role:** Doctor

## Purpose
Allows the signed-in doctor to view their professional summary and update their personal details, mobile number, username, and password without needing an Administrator.

## UI
- **Profile Banner Card:**
  - Shows the doctor's initial avatar, formatted full name (`Dr. First M. Last`), zero-padded doctor ID badge (`DOC-0001`), role badge (`Doctor`), and the date their account was created.
  - Displays the doctor's assigned **Clinical Specialties** as read-only pill badges (official specialty assignments are managed by the Administrator in [[Manage Doctors]]).
- **Personal Information Card:**
  - **First Name** (required, up to 80 characters), **Last Name** (required, up to 80 characters), and **Middle Initial** (optional, up to 10 characters).
  - **Gender** — Dropdown offering `Male`, `Female`, `Unknown`, and `Other` (choosing `"Other"` reveals the custom gender text box `#prof-custom-gender`).
  - **Contact Number** — Automatically formats mobile numbers as `09XX XXX XXXX` (4-3-4 grouping) while preserving the cursor position during typing or deleting.
- **Account & Security Card:**
  - **Username** (required; checked to make sure no other active user already has the same username).
  - **Change Password (Optional):** Includes **Current Password**, **New Password**, and **Confirm New Password** boxes, each with an eye-icon button (`.btn-toggle-password`) to show or hide the typed password.

## Validation & Synchronization (`PUT api/doctor_profile_controller.php`)
- **Validation (`422 Unprocessable Entity`):**
  - `contact_no`: Optional; when filled in, spaces are removed and the number must be 11 digits starting with `09`.
  - **Password changes:** If `new_password` is filled in, the server checks that `current_password` matches the saved `users.password_hash` via `password_verify()`, confirms `new_password` matches `confirm_password`, and verifies that the new password meets the complexity rule (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`).
- **All-or-Nothing Save (Transactional Update):**
  - Updates both the `users` table and the `doctors` table inside a single database transaction so the doctor's name, gender, and contact details never get out of sync.
  - Refreshes `$_SESSION['full_name']` and `$_SESSION['username']` on the server and returns the updated profile to the browser, which immediately updates the top bar (`#user-name`, `#user-avatar-initial`) and the profile banner without requiring the doctor to log out and sign back in.
