# Development Walkthrough

## 1. Users & Doctors Synchronization
- **Backend Refactoring:** Refactored `user_controller.php` to securely wrap user creation and profile creation inside Database Transactions (`PDO::beginTransaction`). Whenever a User is created with the `Doctor` role, a linked clinical record is automatically created in the `doctors` and `doctor_specialty` tables.
- **Form Alignment:** Refactored the `users.js` modal to use the exact same modern, responsive 2-column CSS Grid layout as the `doctors.js` modal.

## 2. Modal Scrolling Fix
- **Root Cause Identified:** The main layout used CSS Flexbox inside the modals, but the nested `<form>` tag disrupted the flex chain. Additionally, the modal body lacked an absolute maximum height.
- **The Fix:** Updated `assets/css/style.css` to force the `<form>` inside `.modal-dialog` to adopt `display: flex; flex-direction: column`. Furthermore, gave `.modal-body` an explicit CSS calculation `max-height: calc(90vh - 160px)`. This ensures it mathematically cannot push the footer off-screen regardless of how large the form becomes.

## 3. Manage Archive System
- **Centralized Archive:** Created a new module called `Manage Archive` (`assets/js/modules/archive.js`). This acts as the universal recycle bin for the entire system.
- **Dropdown Entity Filter:** Inside the Archive module, administrators can select which table to view (Users, Doctors, Patients, Services, Specialties, Discounts) from a dropdown. The table columns and data dynamically rebuild themselves based on the selection.
- **Global UI Overhaul:**
  - Removed the `Status` filter dropdown from all main management pages. Main pages now *only* display active records natively.
  - Removed the `Soft Delete`, `Restore`, and `Hard Delete` buttons from all main pages.
  - Added a new, singular **Archive** button to all main pages. Clicking it safely hides the record and moves it to the Archive.
  - From the Archive, users can either **Restore** the record to return it to the main pages, or permanently **Hard Delete** it to purge it from the database.

## 4. Manage Archive Restore Confirmation Fix
- **Root Cause Identified:** The Restore button in `assets/js/modules/archive.js` previously invoked `confirmSoftDelete` from `ui.js`, which had hardcoded strings for deactivation ("Deactivate Record" button, warning alert).
- **The Fix:**
  - Added a dedicated `confirmRestore` modal utility function in `assets/js/ui.js` that displays `Restore Record` as the title, an informational notice about returning the record to active status, and a green `Restore` action button (`btn-success`).
  - Updated `handleRestore` in `assets/js/modules/archive.js` to call `confirmRestore`, ensuring the prompt and action button are clearly labeled "Restore".
  - Verified that clicking "Restore" dispatches the proper `PUT ...?action=restore` request, sets `deleted_at = NULL` in the database, removes the record from the archive table, and places it back in the active list.
  - Updated `confirmSoftDelete` in `assets/js/ui.js` to use "Confirm Archive" / "Archive Record" terminology as default.
  - Added cache busters (`?v=5`) in `admin_dashboard.php` for `main.js` and `style.css` to guarantee instant client update.

