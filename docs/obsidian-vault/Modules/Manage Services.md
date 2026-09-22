---
tags: [module]
---

# Manage Services

**Route:** `#services` · **File:** `assets/js/modules/services.js` · **Controller:** `api/service_controller.php`

## Purpose
Catalog billable hospital services and prices (consultations, labs, imaging, procedures).

## UI
- Search, pagination, sortable columns.
- Add/Edit modal: service name, standard price (non-negative, two decimals).
- View modal, archive confirmation.

## Business use
Service rows feed future invoice items (`billing` / `invoice_items`), so prices should stay current. See [[Database Schema]].
