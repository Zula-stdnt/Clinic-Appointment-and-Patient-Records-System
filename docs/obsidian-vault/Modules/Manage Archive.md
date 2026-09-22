---
tags: [module]
---

# Manage Archive

**Route:** `#archive` · **File:** `assets/js/modules/archive.js` · **Role:** Administrator

## Purpose
Central recycle bin for every master file. Deleted records land here and can be restored or permanently purged.

## UI
- Entity selector: Users, Patients, Doctors, Services, Specialties, Discounts.
- Search (debounced), page-size selector, pagination.
- Rows are shaded (`row-soft-deleted`); actions: **Restore** and **Delete** (hard).

## Dynamic columns
Each entity defines `columns` + `renderRow` in the module's `CONFIG` object; headers and colspans are generated at runtime, including the Actions column.

## Request mapping
All entities reuse the standard controllers with `status=deleted`:
- Restore → `PUT ?action=restore&id=…`
- Hard delete → `DELETE ?id=…` (typed `DELETE` confirmation; blocked by FK references with `409`).

## Behavior notes
- Restoring a doctor also restores the linked user account, and vice versa (handled in [[Manage Doctors]] / [[Manage Users]] controllers).
- Hard-deleting a doctor removes the linked user; the join rows cascade.
