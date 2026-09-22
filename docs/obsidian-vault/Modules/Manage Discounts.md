---
tags: [module]
---

# Manage Discounts

**Route:** `#discounts` · **File:** `assets/js/modules/discounts.js` · **Controller:** `api/discount_controller.php`

## Purpose
Configure discount programs (senior citizen, PWD, employee, PhilHealth, indigent, promotions).

## UI
- Search, pagination, sortable columns.
- Add/Edit modal: discount name, percentage (0–100, two decimals).
- View modal, archive confirmation.

## Business use
Discounts will be selectable on billing records (`billing.discount_id`) once the billing module ships — see [[Roadmap]].
