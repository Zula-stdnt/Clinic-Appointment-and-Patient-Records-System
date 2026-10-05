---
tags: [architecture, workflow]
---

# System Flow

A whole-project flowchart: from staff login, through all three portals, across the patient journey, and down to the shared backend pipeline that every screen uses. The detailed invoice path lives in [[Billing Workflow]]; the file-level structure lives in [[Architecture]].

Obsidian renders the diagram below natively (Mermaid) in Reading view — no plugin needed.

```mermaid
flowchart TD
    Start([Staff opens login.html]) --> Login[Enter username and password]
    Login --> Auth{login_controller.php<br/>credentials valid?}
    Auth -- No --> Attempts{Too many failed attempts?}
    Attempts -- No --> Login
    Attempts -- Yes --> Locked{{Temporary login lockout}}
    Locked --> Login
    Auth -- Yes --> Role{Signed-in role?}

    subgraph AdminPortal [Administrator portal - main.js SPA router]
        AdminDash[Administrator dashboard shell] --> AdminMods[[Master files: users, patients, doctors,<br/>specialties, services, discounts]]
        AdminMods --> Archive[(Archive: soft-delete, restore,<br/>or permanent hard-delete)]
    end

    subgraph RecPortal [Receptionist portal - receptionist_main.js]
        RecDash[Receptionist dashboard shell] --> Book[/Book appointment and record<br/>optional triage vital signs/]
        Book --> ApptDB[(appointments<br/>status = scheduled)]
    end

    subgraph DocPortal [Doctor portal - doctor_main.js]
        DocDash[Doctor dashboard shell] --> DocAppts[View assigned appointments]
        DocAppts --> Consult[Clinical charting: SOAP notes,<br/>diagnoses, prescriptions, lab orders]
        Consult --> SaveT{Save and complete encounter?}
        SaveT -- No --> Consult
        SaveT -- Yes --> Tx[(PDO transaction: consultation header<br/>plus child rows, status = completed)]
    end

    Role -- Administrator --> AdminDash
    Role -- Doctor --> DocDash
    Role -- Receptionist --> RecDash

    Tx --> Bill[/Cashier bills the completed visit/]
    Bill --> Pay{Payment received?}
    Pay -- Yes --> Paid([Invoice closed with receipt])
    Pay -- No --> Follow{{Follow-up statement}}
    Follow --> Open([Invoice stays open for later payment])

    AdminMods & Book & Consult --> APIJS[api.js + axios<br/>attaches CSRF token on writes]
    APIJS --> Ctrl[PHP API controllers]
    Ctrl --> Guard{require_login + require_role<br/>+ verify_csrf_on_state_change}
    Guard -- Fail --> Denied{{401 or 403 - return to login}}
    Guard -- Pass --> PDOQ[(PDO prepared statements)]
    PDOQ --> MySQL[(MySQL hospital_db)]
```

## Shape legend
- **Stadium `([ ])`** — start and end states.
- **Parallelogram `[/ /]`** — a person-facing action.
- **Rectangle `[ ]`** — a processing step or screen.
- **Cylinder `[( )]`** — a database table or transaction.
- **Diamond `{ }`** — a yes/no decision.
- **Subroutine `[[ ]]`** — a grouped set of screens.
- **Hexagon `{{ }}`** — a system alert or notice.

## How to read it
1. **Login & roles** — `login.html` checks credentials through `api/auth_controller.php`, applies failed-attempt rate limiting, then routes the user by role: Administrator, Doctor, or Receptionist.
2. **Administrator portal** — maintains the master files ([[Manage Users]], [[Manage Patients]], [[Manage Doctors]], [[Manage Specialties]], [[Manage Services]], [[Manage Discounts]]) and the [[Manage Archive]] recycle bin (soft-delete lifecycle in [[Database Schema]]).
3. **Receptionist portal** — books the appointment and optionally records triage vital signs ([[Receptionist Appointments]]).
4. **Doctor portal** — views assigned appointments, charts the encounter ([[Doctor Consultation]]), and saves it as one all-or-nothing transaction that sets the appointment to `completed`.
5. **Billing** — the completed visit becomes an invoice, then payment decides whether it closes or stays open (full flow in [[Billing Workflow]]).
6. **Shared pipeline** — every screen action travels the same path: JS module → `api.js` (adds the CSRF token) → PHP controller → login/role/CSRF guard → PDO prepared statements → MySQL. Failed guards return `401`/`403` and send the user back to login (details in [[Security]]).
