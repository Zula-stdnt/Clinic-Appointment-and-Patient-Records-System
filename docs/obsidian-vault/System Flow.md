---
tags: [architecture, workflow]
---

# System Flow

A whole-project flowchart: from staff login, through all three portals, across the patient journey, and down to the shared backend pipeline that every screen uses. The file-level structure lives in [[Architecture]].

Obsidian renders the diagram below natively (Mermaid) in Reading view — no plugin needed.

```mermaid
flowchart TD
    Start([Staff opens login.html]) --> Login[Enter username and password]
    Login --> Auth{auth_controller.php<br/>credentials valid?}
    Auth -- No --> Attempts{Too many failed attempts?}
    Attempts -- No --> Login
    Attempts -- Yes --> Locked{{Temporary login lockout}}
    Locked --> Login
    Auth -- Yes --> Role{Signed-in role?}

    subgraph AdminPortal [Administrator portal - main.js SPA router]
        AdminDash[Administrator dashboard shell] --> AdminMods[[Master files: users, patients, doctors,<br/>specialties, services, medications]]
        AdminDash --> AuditLog[[Compliance & Audit Trail viewer]]
        AdminMods --> Archive[(Archive: soft-delete, restore,<br/>or permanent hard-delete)]
    end

    subgraph RecPortal [Receptionist portal - receptionist_main.js]
        RecDash[Receptionist overview dashboard shell] --> Book[/Book appointment / walk-in & record<br/>triage vitals & unconfirmed allergy note/]
        Book --> ApptDB[(appointments + vital_signs<br/>allergies_confirmed_by_doctor = 0)]
        RecDash --> DemogCard[/Demographics-only patient profile card<br/>clinical history blocked/]
    end

    subgraph DocPortal [Doctor portal - doctor_main.js]
        DocDash[Doctor clinical dashboard shell] --> DocDirectory[/Universal Patient Directory/]
        DocDirectory --> BGCheck{Assigned patient?}
        BGCheck -- No --> BGModal[/Emergency Break-Glass Override modal<br/>requires clinical justification/]
        BGModal --> BGAudit[(Audit log write:<br/>BREAK_GLASS_ACCESS)]
        BGAudit --> ChartReview[/Audited emergency chart review/]
        BGCheck -- Yes --> DocAppts[View assigned appointments]
        DocAppts --> Consult[Clinical consultation: SOAP notes,<br/>diagnoses, prescriptions, lab orders<br/>+ allergy alert banner review]
        Consult --> SaveT{Save and complete encounter?}
        SaveT -- No --> Consult
        SaveT -- Yes --> Tx[(PDO transaction: consultation header<br/>plus child rows, status = completed,<br/>allergies_confirmed_by_doctor = 1)]
    end

    Role -- Administrator --> AdminDash
    Role -- Doctor --> DocDash
    Role -- Receptionist --> RecDash

    Tx --> Done([Encounter locked & stored in accumulated medical history])

    AdminMods & Book & Consult & BGModal --> APIJS[api.js + axios<br/>attaches CSRF token on writes]
    APIJS --> Ctrl[PHP API controllers]
    Ctrl --> Guard{require_login + require_role<br/>+ verify_csrf_on_state_change}
    Guard -- Fail --> Denied{{401 or 403 - access blocked}}
    Guard -- Pass --> PDOQ[(PDO prepared statements)]
    PDOQ --> MySQL[(MySQL hospital_db)]
    PDOQ --> AuditHelper[(includes/audit.php -> audit_logs)]
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
1. **Login & roles** — `login.html` checks credentials through `api/auth_controller.php`, applies failed-attempt rate limiting, then routes the user by role: Administrator, Doctor, or Receptionist. Session probe (`action=check`) prevents red console errors.
2. **Administrator portal** — maintains master files ([[Manage Users]], [[Manage Patients]], [[Manage Doctors]], [[Manage Specialties]], [[Manage Services]]), inspects the compliance audit log, and manages the [[Manage Archive]] recycle bin (soft-delete lifecycle in [[Database Schema]]).
3. **Receptionist portal** — lands directly on the Overview Dashboard, registers walk-in patients, books appointments with triage vitals and unconfirmed allergy intake alerts, prints appointment slips with allergy alerts, and views demographic-only profile cards with clinical history blocked ([[Receptionist Appointments]]).
4. **Doctor portal** — accesses daily appointments, browses the universal patient directory with an audited Break-Glass emergency override for unassigned patients, charts clinical encounters ([[Doctor Consultation]]), and saves them in an all-or-nothing transaction that marks the visit `completed` and elevates allergies to `Doctor Confirmed`. Completed visits are locked against post-consultation editing, allowing only dated addenda.
5. **Shared pipeline & audit trail** — every write action travels through `api.js` (attaching the CSRF token) → PHP controller → auth and permission guards → PDO prepared statements. Critical actions (break-glass overrides, demographic edits, allergy updates) are permanently recorded in `audit_logs` via `includes/audit.php`.
