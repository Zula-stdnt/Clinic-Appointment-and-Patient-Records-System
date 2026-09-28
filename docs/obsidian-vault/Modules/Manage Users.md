---
tags: [module]
---

# Manage Users

**Route:** `#users` · **File:** `assets/js/modules/users.js` · **Controller:** `api/user_controller.php`

## Purpose
Allows Administrators to create, view, edit, and archive staff login accounts (Doctors and Receptionists). Whenever a user account is created with the **Doctor** role, the system automatically creates a linked clinical profile in the `doctors` table at the same time.

## UI
- **Table toolbar & controls:** Live search bar (which waits briefly while you type before searching — **debounced search**), role filter dropdown, rows-per-page selector, clickable column headers for sorting, and page navigation buttons.
- **Add/Edit pop-up form (modal):**
  - **First Name**, **Last Name**, and **Middle Initial** (optional, up to 5 characters).
  - **Gender** — Starts with an unselectable `"Select Gender"` prompt. Choosing `"Other"` reveals a text box where a custom gender can be typed; choosing any other option clears and hides that box.
  - **Role selection** — Choosing the **Doctor** role reveals two extra doctor-specific fields:
    - **Clinical Specialties** — A multi-select box (`<select multiple size="6">`) where the Administrator can hold `Ctrl` (or `Cmd` on Mac) to pick one or more specialties. At least one specialty is required for a doctor.
    - **Contact Number** — Automatically formats mobile numbers with spaces as `09XX XXX XXXX` (4-3-4 grouping) while keeping the typing cursor in the right spot. Requires 11 digits starting with `09` when filled in.
  - **Username & Password:**
    - Includes helper text explaining the password rules (at least 6 characters, with an uppercase letter, lowercase letter, number, and special character).
    - Includes an accessible eye-icon button to show or hide the password.
    - When editing an existing user, leaving the password box blank keeps their current password unchanged.
- **View & Archive modals:** Read-only profile view pop-up and a confirmation box for moving a user to the Archive (**soft delete**).

## Requests
- Calls `?meta=roles` and `?meta=specialties` to load dropdown choices.
- Create (`POST`) and update (`PUT`) requests send `specialty_ids` (a list of selected specialty IDs), the chosen or custom `gender`, and `contact_no` with spaces removed. See [[API Endpoints#Specialty payloads]].
- Archiving a user sends `PUT ?action=soft_delete&id=…`.

## Behavior notes
- `toggleDoctorFields()` shows or hides the Clinical Specialties and Contact Number fields depending on whether the selected role is `Doctor`.
- In Edit mode, the form reads the doctor's saved `specialty_ids` (returned as a comma-separated list from MySQL's `GROUP_CONCAT`) and highlights each matching specialty in the list.
- Any validation errors returned by the server are matched to their specific form inputs (`specialty_id` → `#user-specialty-id`, `contact_no` → `#user-contact`, etc.) and shown directly below the field.
- The contact number box supports natural keyboard editing (Backspace, Delete, paste, and select-all-and-type) without the cursor jumping to the end.
