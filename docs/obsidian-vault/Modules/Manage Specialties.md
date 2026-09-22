---
tags: [module]
---

# Manage Specialties

**Route:** `#specialties` · **File:** `assets/js/modules/specialties.js` · **Controller:** `api/specialty_controller.php`

## Purpose
Maintain clinical departments/specialties used to classify doctors.

## UI
- Search, pagination.
- Add/Edit modal: specialty name.
- View modal, archive confirmation.

## Integration
Referenced by [[Manage Doctors]] and [[Manage Users]] through the specialty dropdowns; only active specialties (`deleted_at IS NULL`) are offered. Archived specialties remain attached to existing doctors until edited.
