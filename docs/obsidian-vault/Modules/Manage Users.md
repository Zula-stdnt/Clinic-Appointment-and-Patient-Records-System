---
tags: [module]
---

# Manage Users

**Route:** `#users` · **File:** `assets/js/modules/users.js` · **Controller:** `api/user_controller.php`

## Purpose
Manage staff login accounts (Doctor and Receptionist). Doctors created here also get a linked `doctors` profile row.

## UI
- Search (debounced), role filter, page-size selector, sortable columns, pagination.
- **Add/Edit modal**:
  - First Name, Last Name, Middle Initial (optional, max 5 characters).
  - **Gender** — "Select Gender" disabled placeholder. Selecting "Other" dynamically reveals a text input for custom gender entry; changing away clears and hides it.
  - Role selection; Doctor role reveals:
    - **Clinical Specialties** — `<select multiple size="6">` with a Ctrl/Cmd hint. At least one specialty is required.
    - **Contact Number** — formatted dynamically as `09XX XXX XXXX` (4-3-4 grouping) with smart cursor tracking. Requires exactly 11 digits starting with `09` when provided.
  - Username & **Password**:
    - Password helper text detailing complexity requirements (uppercase, lowercase, number, special character, min 6 characters).
    - Accessible eye-icon button to toggle password visibility.
    - On Edit User, leaving password blank leaves the existing password unchanged.
- View modal, archive (soft delete) confirmation.

## Requests
- `?meta=roles` and `?meta=specialties` for dropdowns.
- Create/update payload includes `specialty_ids` (array), sanitized `gender`, and spaces-stripped `contact_no`. See [[API Endpoints#Specialty payloads]].
- Archive: `PUT ?action=soft_delete&id=…`.

## Behavior notes
- `toggleDoctorFields()` shows/hides the specialty and contact groups based on the role dropdown.
- Edit mode reads `specialty_ids` (comma-separated from `GROUP_CONCAT`) and preselects every matching option.
- Server validation errors are mapped back to fields (`specialty_id` → `#user-specialty-id`, `contact_no` → `#user-contact`, etc.).
- Contact number input supports standard keyboard interactions (Backspace, Delete, paste, select-all-and-type) without cursor jumping.
