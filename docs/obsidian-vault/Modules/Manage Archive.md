---
tags: [module]
---

# Manage Archive

**Route:** `#archive` · **File:** `assets/js/modules/archive.js` · **Role:** Administrator

## Purpose
Acts as the central recycle bin for every core hospital table (**Master Files**). Whenever an Administrator archives (soft-deletes) a record from a main screen, it lands here so it can either be restored to active use or permanently erased from the database.

## UI
- **Category (Entity) selector:** A dropdown menu that switches between archived Users, Patients, Doctors, Services, Specialties.
- **Table toolbar & controls:** Live search bar (**debounced** so it waits briefly while you finish typing), rows-per-page selector, and page navigation buttons.
- **Archived rows:** Styled with a muted background (`row-soft-deleted`) and two action buttons: **Restore** (returns the record to its main screen) and **Delete** (permanently erases it).

## Dynamic columns
Because each record type has different fields, the module's `CONFIG` settings define the `columns` and `renderRow` template for each category. Whenever you pick a different category from the dropdown, the table headers and row layout rebuild automatically on the spot.

## Request mapping
Instead of using a separate archive controller, Manage Archive calls the standard master-file controllers with `status=deleted`:
- **Restore** → Sends `PUT ?action=restore&id=…` (clears `deleted_at` back to `NULL`).
- **Hard delete (Permanent)** → Sends `DELETE ?id=…` after asking the Administrator to type `DELETE` in a confirmation box. If the record is still referenced by hospital activity (such as a patient or doctor tied to existing appointments), the database's **foreign key** safety check blocks the deletion and returns a `409 Conflict` message.

## Behavior notes
- Restoring an archived doctor automatically restores their linked user login account as well (and vice versa), handled inside the [[Manage Doctors]] and [[Manage Users]] controllers.
- Permanently deleting an archived doctor also deletes their linked user account and removes their specialty links from `doctor_specialty`.
- **Doctor controller integration:**
  - When no `sort_by` column is specified, `doctor_controller.php` defaults to `'doctor_id'` before adding the `'d.'` table prefix, preventing SQL `d.d.doctor_id` column errors.
  - The doctor total-count query includes `LEFT JOIN users u ON d.user_id = u.user_id` so searching archived doctors by first or last name works smoothly without SQL errors.

