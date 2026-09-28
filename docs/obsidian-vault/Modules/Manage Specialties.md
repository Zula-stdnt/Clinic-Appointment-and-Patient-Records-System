---
tags: [module]
---

# Manage Specialties

**Route:** `#specialties` · **File:** `assets/js/modules/specialties.js` · **Controller:** `api/specialty_controller.php`

## Purpose
Allows Administrators to maintain the list of medical departments and clinical specialties (such as Cardiology, Pediatrics, or Orthopedics) used to classify doctors.

## UI
- **Table controls:** Search bar and page navigation buttons.
- **Add/Edit pop-up form (modal):** Specialty Name (required, unique).
- **View & Archive modals:** Read-only specialty details pop-up and a confirmation box for moving a specialty to the Archive.

## Integration
Both [[Manage Doctors]] and [[Manage Users]] load their specialty selection lists from this module. Only active specialties (`deleted_at IS NULL`) are offered when assigning specialties to a new or edited doctor. If a specialty is archived later, doctors who already hold that specialty keep it on their profile until their specialty list is edited.
