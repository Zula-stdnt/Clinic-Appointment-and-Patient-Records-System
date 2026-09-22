---
tags: [module]
---

# Manage Users

**Route:** `#users` · **File:** `assets/js/modules/users.js` · **Controller:** `api/user_controller.php`

## Purpose
Manage staff login accounts (Doctor and Receptionist). Doctors created here also get a linked `doctors` profile row.

## UI
- Search (debounced), role filter, page-size selector, sortable columns, pagination.
- **Add/Edit modal** with role selection; Doctor role reveals:
  - **Clinical Specialties** — `<select multiple size="6">` with a Ctrl/Cmd hint. At least one specialty is required.
  - **Contact Number**.
- View modal, archive (soft delete) confirmation.

## Requests
- `?meta=roles` and `?meta=specialties` for dropdowns.
- Create/update payload includes `specialty_ids` (array). See [[API Endpoints#Specialty payloads]].
- Archive: `PUT ?action=soft_delete&id=…`.

## Behavior notes
- `toggleDoctorFields()` shows/hides the specialty and contact groups based on the role dropdown.
- Edit mode reads `specialty_ids` (comma-separated from `GROUP_CONCAT`) and preselects every matching option.
- Server validation errors are mapped back to fields (`specialty_id` → `#user-specialty-id`).
