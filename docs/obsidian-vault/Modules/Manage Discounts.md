---
tags: [module]
---

# Manage Discounts

**Route:** `#discounts` · **File:** `assets/js/modules/discounts.js` · **Controller:** `api/discount_controller.php`

## Purpose
Allows Administrators to set up and manage hospital discount programs (such as Senior Citizen, PWD, Employee, PhilHealth, Indigent, or special promotions).

## UI
- **Table controls:** Search bar, sortable column headers, and page navigation buttons.
- **Add/Edit pop-up form (modal):** Discount Name (required, unique) and Percentage rate (from `0` to `100`, up to two decimal places).
- **View & Archive modals:** Read-only discount details pop-up and a confirmation box for moving a discount program to the Archive.

## Business use
Active discount rows in the `discounts` table connect to patient invoices (`billing.discount_id`) to calculate percentage deductions when the billing screen is used — see [[Roadmap]].
