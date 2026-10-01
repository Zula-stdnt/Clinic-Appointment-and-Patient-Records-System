---
tags: [module]
---

# Manage Services

**Route:** `#services` · **File:** `assets/js/modules/services.js` · **Controller:** `api/service_controller.php`

## Purpose
Allows Administrators to maintain the hospital's catalog of billable medical services and their standard prices (such as consultations, lab tests, X-rays, and clinical procedures).

## UI
- **Table controls:** Search bar, sortable column headers, and page navigation buttons.
- **Add/Edit pop-up form (modal):** Service Name (required, unique) and Standard Price (must be zero or greater, formatted to two decimal places).
- **View & Archive modals:** Read-only service details pop-up and a confirmation box for moving a service to the Archive.

## Business use
Active rows in the `services` table provide the official catalog of medical services. (The underlying database supports price lists and itemized charges through the `billing` and `invoice_items` tables, though these features are no longer active in the user interface). See [[Database Schema]].
