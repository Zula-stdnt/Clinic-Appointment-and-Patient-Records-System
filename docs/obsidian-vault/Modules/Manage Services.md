---
tags: [admin, master-file]
---

# Manage Services

The **Manage Services** module allows **Administrators** to maintain an administrative catalog of hospital services.

## Overview
- **Navigation:** Accessible from the Admin Dashboard sidebar via the "Manage Services" button.
- **Frontend Module:** `assets/js/modules/services.js`
- **Backend API:** `api/service_controller.php`
- **Database Table:** `services`

## Features
1. **Catalog Maintenance:** Administrators can add, view, and edit service names (e.g., "Complete Blood Count", "X-Ray").
2. **Archiving:** Services can be soft-deleted. Once archived, they are hidden from the active list but can be restored via the [[Manage Archive]] module.
3. **Validation:** Prevents duplicate service names from being created or updated.

> [!NOTE] Non-Financial Catalog
> This catalog is purely administrative. It does not contain pricing, charges, discounts, or billing data. Clinical lab requests use a free-text test name entry rather than depending on this administrative catalog.
