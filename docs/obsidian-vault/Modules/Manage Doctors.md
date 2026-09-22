---
tags: [module]
---

# Manage Doctors

**Route:** `#doctors` · **File:** `assets/js/modules/doctors.js` · **Controller:** `api/doctor_controller.php`

## Purpose
Manage doctor profiles, their login account, and clinical specialties.

## UI
- Search (name, specialty, contact), specialty filter, pagination.
- Add/Edit modal: name, middle initial, gender, **Clinical Specialties multi-select**, contact number, username/password.
- Create/Edit here also creates or updates the linked `users` row.
- Archive confirmation (soft deletes both doctor and linked user).

## Specialties
- Multiple selection (`specialty_ids` array); at least one required; all must be active.
- On update the junction rows are deleted and re-inserted.
- List/detail show the combined names (e.g. "Internal Medicine, Pediatrics").

## Notes
- `?meta=specialties` returns only active specialties.
- Hard delete is blocked when appointments reference the doctor (`409`).
