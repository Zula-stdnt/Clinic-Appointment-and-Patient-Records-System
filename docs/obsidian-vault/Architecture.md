---
tags: [architecture]
---

# Architecture

The system is built without heavy external frameworks or complex build tools. Each portal loads a single HTML/PHP page shell and runs as a **Single-Page Application (SPA)**—meaning the browser stays on one page while JavaScript smoothly swaps screens and exchanges **JSON** data (a lightweight, structured text format) with PHP scripts on the server.

## Layers
1. **Page shells & session guard** (`admin_dashboard.html`, `doctor_dashboard.html`, `receptionist_dashboard.html`, `login.html`, plus `assets/js/session-guard.js`) — Before showing any dashboard screen, `session-guard.js` asks `api/auth_controller.php?action=me` (`requireSession()`) whether the visitor is signed in and has the right role. For login checks without console errors, `action=check` provides a safe probe. On the server side, every PHP controller also runs `require_login()` and `require_role()` so data stays protected even if someone calls an API URL directly.
2. **SPA routers** — `assets/js/main.js` (Administrator portal), `assets/js/doctor_main.js` (Doctor portal), and `assets/js/receptionist_main.js` (Receptionist portal). These scripts watch the `#hash` part of the browser address bar (such as `#patients`, `#doctor_appointments`, `#receptionist_overview`, or `#doctor_consultation/1` where `1` is the appointment ID), highlight the active menu item in the sidebar, load the matching screen module, and control the slide-out menu on mobile screens.
3. **Feature modules** — `assets/js/modules/*.js`. Each screen is a self-contained JavaScript file that exports `{ state, init(container, param) }`. When you switch screens, the router calls `init` to draw that screen inside the `#module-viewport` area of the page.
4. **UI toolkit & API helper** — `assets/js/ui.js` provides shared building blocks used by every screen: HTML/currency helpers (`create`, `gId`, `formatCurrency`), pop-up notifications (**toasts**), pop-up dialog boxes (**modals**) that keep keyboard focus inside the box, confirmation prompts, and `escapeHtml` (which turns special characters into safe text). `assets/js/api.js` wraps **Axios** (an HTTP request library) to automatically attach the user's **CSRF security token** on save/delete requests, unwrap server responses, and send the user back to the login page if their session expires (`401`).
5. **API controllers** — `api/*_controller.php`. Each PHP controller connects to the database via `config/db_connect.php`, checks that the user is logged in with the right role (`require_login()` / `require_role()`), verifies the security token on data changes (`verify_csrf_on_state_change()`), and runs the requested action based on the HTTP method (`GET` to read, `POST` to create, `PUT` to update, `DELETE` to remove).
6. **Audit & Compliance Layer** — `includes/audit.php` and `api/audit_log_controller.php`. Records immutable audit entries for Break-Glass chart views, demographic updates with old/new values, and appointment cancellations.
7. **Database** — MySQL accessed through **PDO** (PHP Data Objects). Uses soft-delete timestamps (`deleted_at`), linking tables (**junction tables**), and all-or-nothing **database transactions** for clinical encounters; see [[Database Schema]].

## Request lifecycle
This diagram shows what happens step-by-step when you click a button or load a table in the browser:

```mermaid
sequenceDiagram
    participant M as JS Module
    participant A as api.js
    participant C as api/*_controller.php
    participant AU as includes/auth.php
    participant DB as MySQL
    M->>A: api.get/post/put/delete
    A->>C: HTTP request (+ X-CSRF-Token on writes)
    C->>AU: require_login / require_role / verify_csrf
    AU-->>C: authorized
    C->>DB: PDO prepared statement
    DB-->>C: rows
    C-->>A: { success, message, data | errors }
    A-->>M: response payload
```

## Module flow
This diagram shows how the browser files connect to the server files:

```mermaid
flowchart LR
    subgraph Browser
        Shell[HTML/PHP shell]
        Router[main.js / doctor_main.js / receptionist_main.js]
        Mod[JS modules]
        T[ui.js]
        APIJS[api.js + axios]
    end
    subgraph Server
        Ctrl[api controllers]
        Auth[includes/auth.php]
        Audit[includes/audit.php]
        Resp[includes/response.php]
        DB[(hospital_db)]
    end
    Shell --> Router --> Mod
    Mod --> T
    Mod --> APIJS --> Ctrl
    Ctrl --> Auth
    Ctrl --> Audit
    Ctrl --> Resp
    Ctrl --> DB
```

## Folder map
```text
api/                     Server-side PHP controllers (master files, clinical endpoints, audit logs)
assets/css/style.css     Visual design system, semantic status badge tokens, and responsive layout rules
assets/js/api.js         Axios network helper (attaches CSRF tokens, handles expired logins)
assets/js/main.js        Administrator SPA router + sidebar navigation
assets/js/doctor_main.js Doctor SPA router (supports #module/param routes) + sidebar
assets/js/receptionist_main.js Receptionist SPA router + navigation
assets/js/session-guard.js Browser-side login & role checker
assets/js/ui.js          DOM/currency helpers, toasts, modals, escapeHtml
assets/js/components/    Reusable components (patient-record-view, patient-register, print forms)
assets/js/modules/       Individual screen modules across Admin, Doctor, and Receptionist portals
config/db_connect.php    PDO database connection setup
includes/audit.php       System-wide audit logging helper
includes/auth.php        Session checks, CSRF protection, role checks, login rate-limiting
includes/response.php    Standard JSON reply helpers (send_success / send_error / get_json_input)
migrations/              Database migration SQL history files
setup/                   Clean baseline schema.sql, seeds.sql, and bootstrap_admin.php
tests/                   Automated PHP and Playwright verification scripts
```

## Conventions & ITE 387 Lesson Alignment
- **ES Modules & Helper Aliases (`01 JavaScript Foundations`):** Screen modules export `{ state, init(container, param) }`, wait for the page to finish loading (`DOMContentLoaded`), use small **factory functions** to create blank form row objects, process lists with `.filter()`, `.map()`, and `.forEach()`, and share helper functions (`create`, `gId`, `formatCurrency`) from `assets/js/ui.js`.
- **DOM & Styling (`02 DOM and UI`):** Dynamic rows are built using the *Create → Configure → Listen → Append* pattern (`create()`, template strings, and row-scoped `row.querySelector()`). Event delegation is used on table containers to avoid listener duplication during re-renders. Visual states switch using semantic CSS classes (`.badge-status-*`, `classList.add()` / `classList.remove()`).
- **APIs & PDO Transactions (`03 APIs and Database Operations`):** Server replies use `send_success(string $message, $data, int $statusCode)` and `send_error(string $message, array $errors, int $statusCode)`. Actions that save across multiple tables at once (such as [[Doctor Consultation]] and [[Manage Doctors]]) use **PDO database transactions** (`beginTransaction()`, `lastInsertId()`, `commit()`, `rollBack()`) so partial data is never saved if an error occurs.
- **Normalization & Master-Detail (`04 Database Design`):** Database tables are organized in **Third Normal Form (3NF)** (separating login accounts in `users` from clinical details in `doctors` to avoid duplicate data), use a **junction table** (`doctor_specialty`) for many-to-many links, and use **Master-Detail foreign keys** where one `consultation` header links to many `diagnosis`, `prescriptions`, and `lab_requests` rows.
- **Cache-busting:** Page shells and JavaScript module imports include synchronized `?v=X` query parameters so browsers immediately fetch the latest code after updates.
