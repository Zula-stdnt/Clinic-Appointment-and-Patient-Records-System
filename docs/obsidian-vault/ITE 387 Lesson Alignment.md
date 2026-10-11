---
tags: [lessons, alignment]
---

# ITE 387 Lesson Alignment

How this project applies the **ITE 387** lesson topics. **Short answer:** folders 01–04 are required to build and understand this project; folder 05 (Next.js) is a different stack and is **not used** by this codebase.

The lesson files are studied separately (they are not part of this repository), so the topics are referenced by name here.

## 1. JavaScript Foundations
Lessons: `javascript_fundamentals.md`, `javascript_arrays.md`, `javascript_objects_and_arrays.md`, `javascript_modules.md`

Where it shows in the project:
- **ES Modules (ESM):** the dashboard shells load scripts with `type="module"` (`admin_dashboard.html`, `doctor_dashboard.html`, `receptionist_dashboard.html`), and every screen exports `{ state, init(container, param) }` — see `assets/js/modules/*.js`.
- **Arrays & Sorting Algorithms:** tables are rendered with `.filter()`, `.map()`, and `.forEach()` over API results, and interactive column header sorting dynamically re-sorts dataset arrays or coordinates with server-side sort parameters.
- **Objects & State:** small **factory functions** build blank rows — `createEmptyDiagnosis()`, `createEmptyPrescription()`, `createEmptyLabRequest()` in `assets/js/modules/doctor_consultation.js`.
- **Shared helpers:** `create`, `gId`, and `formatCurrency` are imported from `assets/js/ui.js`.

Docs: [[Architecture]] · [[Doctor Consultation]]

## 2. DOM and UI
Lessons: `dom_create_and_remove_elements.md`, `dom_apply_styles.md`, `bootstrap_responsive_design.md`

Where it shows in the project:
- **Create/remove elements:** dynamic rows follow the *Create → Configure → Listen → Append* pattern (diagnosis, prescription, and lab rows, plus remove-row buttons).
- **Event Delegation:** container-level listeners (`table.addEventListener('click', ...)`) in `assets/js/modules/doctor_patients.js` prevent duplicate listener accumulation across dynamic re-renders.
- **Apply styles & Design Tokens:** visual states switch with `classList.add()` / `classList.remove()` and centralized semantic tokens (`.badge-status-*`).
- **Responsive design:** the project does **not** include Bootstrap — the same concepts are hand-written in `assets/css/style.css` with media queries at `1024px`, `768px`, and `520px` (plus `prefers-reduced-motion`).

Docs: [[Architecture]] · [[Doctor Consultation]]

## 3. APIs and Database Operations
Lessons: `javascript_working_with_apis.md`, `mysql_retrieve_records.md`, `mysql_retrieve_specific_record.md`, `mysql_insert_records.md`, `mysql_update_records.md`, `header_detail_forms.md`

Where it shows in the project:
- **Working with APIs:** `assets/js/api.js` wraps **Axios**, attaches the `X-CSRF-Token` on writes, and handles expired logins. `action=check` implements a safe session probe.
- **Retrieve / insert / update:** server controllers in `api/` answer `GET` (lists and single records), `POST`, `PUT`, and `DELETE`; list endpoints return rows inside `data.items`.
- **Header-Detail Forms:** [[Doctor Consultation]] sends one header (`consultation`) plus child arrays (`diagnoses`, `prescriptions`, `lab_requests`) and saves them in a single all-or-nothing **PDO transaction**.
- **Audit Logging:** critical operations trigger database logging via `includes/audit.php` to maintain compliance.

Docs: [[API Endpoints]] · [[Security]] · [[Architecture]]

## 4. Database Design
Lessons: `database_design_process.md`, `entity_relationship_diagrams.md`, `database_conceptual_to_logical_design.md`, `database_normalization.md`, `database_master_detail_design_part_2.md`

Where it shows in the project:
- **Design process & ERD:** the Mermaid ERD in [[Database Schema]] was derived through the 6-step design process.
- **Conceptual → logical:** `setup/schema.sql` turns the design into real tables with primary keys, foreign keys, unique constraints, and check constraints.
- **Normalization (3NF):** login accounts in `users` are separated from clinical details in `doctors`, `roles` is a lookup table, and `doctor_specialty` is a **junction table** for the many-to-many link.
- **Master-Detail (Part 2):** `consultation` (header) with `diagnosis` / `prescriptions` / `lab_requests` / `consultation_addenda` (details).

Docs: [[Database Schema]] · [[Database Migrations]]

## 5. Next.js
Lessons: `nextjs_introduction_and_setup.md`, `nextjs_components_and_jsx.md`, `nextjs_app_router_basics.md`

**Not used in this project.** It runs on PHP + MySQL + a vanilla JavaScript SPA (no Node.js, React, or build tools). The Next.js lessons cover a separate, future web-development stack — useful to study, but not required to work on this codebase.

## Lesson-by-lesson checklist
| Lesson file                             | Status                        | Where it is applied                                     |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `javascript_fundamentals`               | Applied                       | Modules, events, functions across `assets/js/`          |
| `javascript_arrays`                     | Applied                       | `.filter()` / `.map()` / `.forEach()` table rendering   |
| `javascript_objects_and_arrays`         | Applied                       | Factory functions and `state` objects in screen modules |
| `javascript_modules`                    | Applied                       | `export { state, init }` + `type="module"` shells       |
| `dom_create_and_remove_elements`        | Applied                       | Dynamic master-detail rows and remove buttons           |
| `dom_apply_styles`                      | Applied                       | `classList.add()` / `classList.remove()` states         |
| `bootstrap_responsive_design`           | Concept applied, no Bootstrap | Hand-written media queries in `style.css`               |
| `javascript_working_with_apis`          | Applied                       | Axios wrapper with CSRF + JSON handling                 |
| `mysql_retrieve_records`                | Applied                       | `GET` list endpoints returning `data.items`             |
| `mysql_retrieve_specific_record`        | Applied                       | `GET` by id, e.g. `#doctor_consultation/1`              |
| `mysql_insert_records`                  | Applied                       | `POST` handlers using `lastInsertId()`                  |
| `mysql_update_records`                  | Applied                       | `PUT` handlers and `SELECT ... FOR UPDATE`              |
| `header_detail_forms`                   | Applied                       | Consultation save (header + detail rows)                |
| `database_design_process`               | Applied                       | Schema planning behind `hospital_db`                    |
| `entity_relationship_diagrams`          | Applied                       | Mermaid ERD in [[Database Schema]]                      |
| `database_conceptual_to_logical_design` | Applied                       | Physical tables, PKs, and FKs in migrations             |
| `database_normalization`                | Applied                       | 3NF layout, lookup and junction tables                  |
| `database_master_detail_design_part_2`  | Applied                       | Consultation header-detail tables                       |
| `nextjs_*` (all 3)                      | Not used                      | Different stack; studied separately                     |
