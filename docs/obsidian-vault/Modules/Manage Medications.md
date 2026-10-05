---
tags: [module]
---

# Manage Medications

**Route:** `#medications` · **File:** `assets/js/modules/medications.js` · **Controller:** `api/medication_controller.php` · **Role:** Administrator

## Purpose
Maintains the hospital's medicine formulary — the records the [[Doctor Consultation]] prescription picker searches. The database is seeded with 57 common medicines (brand, generic name, and manufacturer) by `migrations/007_seed_medications.sql`, and this screen keeps it current.

## Screen layout
- **Table:** Medication name, generic name, manufacturer, status badge, and **View / Edit / Archive** actions.
- **Toolbar:** Debounced search across name, generic name, and manufacturer, plus rows-per-page selector.
- **Pagination:** Server-side paging (`data.items`, `data.total`, `data.pages`).
- **Add/Edit modal:** Name (required, unique), generic name, and manufacturer.
- **View modal:** Read-only summary including creation date.

## API usage
| Action | Request |
| --- | --- |
| List | `GET api/medication_controller.php?page&page_size&search&status&sort_by&sort_order` |
| Read one | `GET api/medication_controller.php?id` |
| Create | `POST api/medication_controller.php` |
| Update | `PUT api/medication_controller.php?id` |
| Archive | `PUT api/medication_controller.php?action=soft_delete&id` |
| Restore | `PUT api/medication_controller.php?action=restore&id` |
| Permanent delete | `DELETE api/medication_controller.php?id` |

Doctors may only read the catalog (`GET`) for the prescription picker; all writes require the Administrator role.

## Validation & lifecycle
- `name` is required, unique among medications, and up to 150 characters; `generic_name` and `manufacturer` are optional.
- Archiving sets `deleted_at`, hiding the medicine from new prescriptions while keeping historical prescription records intact.
- Permanent delete is blocked with `409` when the medicine is referenced by prescriptions — archive it instead.

## Related notes
- [[Doctor Consultation]] — where the formulary is consumed.
- [[Database Schema]] — `medications` table.
- [[API Endpoints]] — medication endpoint reference.
