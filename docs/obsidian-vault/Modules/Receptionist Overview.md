---
tags: [module]
---

# Receptionist Overview

**Route:** `#receptionist_overview` (default landing route) · **Shell:** `receptionist_dashboard.html` · **Router:** `assets/js/receptionist_main.js` · **Module:** `assets/js/modules/receptionist_overview.js` · **Role:** Receptionist

## Purpose
The primary operational command center and landing screen for front-desk receptionists. Upon logging in, receptionists land directly on this dashboard to review daily clinic metrics, monitor the 10-patient daily capacity ceiling, manage the lobby arrival queue, confirm patient visits for attending doctors, and track clinic flow in real time.

---

## Screen Elements & Layout

### 1. Daily KPI Counter Cards
At the top of the dashboard, four responsive cards calculate real-time appointment metrics for the current date:
* **Total Today:** Total number of patient appointments scheduled clinic-wide for today.
* **Scheduled / Awaiting:** Patients who have not yet checked in at the front desk.
* **Confirmed / In Queue:** Checked-in patients waiting in the lobby or undergoing examination.
* **Completed:** Patient encounters finalized by attending physicians today.

### 2. Clinic Daily Capacity Gauge
A visual progress bar tracking daily clinic volume against the strict clinic-wide ceiling (`MAX_DAILY_CAPACITY = 10` appointments):
* **Normal Load (1–7 appointments):** Green progress bar indicating available appointment capacity.
* **Near Capacity Warning (8–9 appointments):** Amber alert indicator warning staff that clinic slots are nearly exhausted.
* **Capacity Reached (10 appointments):** Crimson indicator notifying staff that the clinic has reached full operational capacity for the day.

### 3. Lobby Queue Table
An interactive table displaying incoming patient visits, structured to eliminate horizontal scrolling at 100% zoom:
* **Time:** The scheduled visit time.
* **Patient:** Patient's full name.
* **Doctor:** Attending doctor assigned to the visit.
* **Triage Vitals:** Standardized vertical stacked badges (`.vital-badge`) displaying Blood Pressure, Temperature (°C), and Oxygen Saturation (SpO2) recorded during intake.
* **Chief Complaint:** Dedicated column displaying the primary reason for visit, styled with a 2-line clamp (`-webkit-line-clamp: 2`), `overflow: hidden`, and a native `title="..."` tooltip for inspecting long descriptions.
* **Status:** Color-coded status badge (`Scheduled`, `Confirmed`, `Completed`, `Cancelled`, `No Show`).
* **Action:**
  * **Confirm Arrival:** Quick one-click action to transition a visit from `Scheduled` to `Confirmed`, unlocking the **Start Consult** button in the Doctor Portal.
  * **Print Slip:** Launches a clean, printable intake slip with patient details, vitals, and allergy notes.

---

## Filtering, Search & Pagination Controls

* **Period Quick Filter Pills:** One-click pills to toggle timeframes:
  * `All Time`
  * `Today` (default)
  * `This Week`
  * `This Month`
* **Custom Date Range Picker:**
  * Start Date (`#overview-date-start`) and End Date (`#overview-date-end`) datepickers.
  * **Apply Range** button (`#overview-apply-range`) to query appointments across any arbitrary date window.
* **Search Box:** Instant client-side filtering by patient name, doctor name, or complaint keyword.
* **Status Filter:** Dropdown to filter by specific visit status.
* **Rows per Page Selector:** Configurable dropdown (`#overview-page-size`) with options for `10`, `25`, or `50` rows per page.
* **Pagination Controls:** Previous and Next buttons with dynamic page index indicators.

---

## Responsive Layout & Zero Horizontal Scroll Design

* **100% Zoom Responsive Layout:** The dashboard columns and queue tables are specifically engineered to fit standard desktop displays (1366px and 1920px widths) at 100% browser zoom without triggering horizontal scrollbars.
* **Desktop Grid Template:** Uses `minmax(0, 2.35fr) minmax(260px, 1fr)` to prevent table container blowout.
* **Compact Table Cells:** Applies compact padding (`0.55rem 0.65rem`) and optimized column width percentages (`12%` Time, `18%` Patient, `16%` Doctor, `14%` Vitals, `22%` Complaint, `10%` Status, `8%` Action).

---

## Live Multi-Tab State Synchronization

* Subscribes to the global `cprms:sync` custom DOM event emitted by `assets/js/live-sync.js`.
* When a doctor completes an encounter or an appointment is updated in another browser tab, `receptionist_overview.js` automatically re-fetches its data payload from `api/appointment_controller.php`, refreshing KPI cards and the lobby queue live without full page reloads.

---

## Related Notes
* [[Receptionist Appointments]] — Front-desk booking modal and doctor duty schedule validation.
* [[Doctor Dashboard]] — Attending physician workspace and queue.
* [[Architecture]] — Live sync and Single-Page Application router design.

