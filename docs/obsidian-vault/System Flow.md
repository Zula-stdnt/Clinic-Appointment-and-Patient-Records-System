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
        AdminDash --> SchedMgr[[Doctor Weekly Schedule Rota Modal<br/>7-day editor + 1-click presets]]
        AdminDash --> AccessQueue[[Access Request Review Queue<br/>Approve 24h standard or audit break-glass]]
        AdminDash --> AuditLog[[Compliance & Audit Trail viewer]]
        AdminMods --> Archive[(Archive: soft-delete, restore,<br/>or permanent hard-delete)]
    end

    subgraph RecPortal [Receptionist portal - receptionist_main.js]
        RecDash[Receptionist overview dashboard shell<br/>KPIs, 10-patient capacity gauge, lobby queue] --> Book[/Book appointment / walk-in/]
        Book --> LiveDutyNotice{{Inline doctor duty days badge<br/>+ calendar date min / time bounds}}
        LiveDutyNotice --> SchedCheck{Doctor on duty?<br/>Time 08:00-17:00?<br/>Capacity < 10?}
        SchedCheck -- Invalid --> FormGuard{{Schedule warning banner<br/>Zero form loss / no retyping}}
        FormGuard --> Book
        SchedCheck -- Valid --> ApptDB[(appointments + vital_signs<br/>allergies_confirmed_by_doctor = 0)]
        RecDash --> DemogCard[/Demographics-only patient profile card<br/>clinical history blocked/]
    end

    subgraph DocPortal [Doctor portal - doctor_main.js]
        DocDash[Doctor clinical dashboard shell<br/>Queue table + date range picker] --> DocDirectory[/Universal Patient Directory/]
        DocDirectory --> BGCheck{Assigned patient?}
        BGCheck -- No --> ModeSelect{Access Request Mode?}
        ModeSelect -- Standard --> StdReq[/Submit 24h Access Request<br/>Requires reason >= 10 chars/]
        StdReq --> AdminReview[(Admin Access Review Queue)]
        ModeSelect -- Urgent Break-Glass --> BGModal[/Emergency Override modal<br/>Immediate access with red banner/]
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

    AdminMods & Book & Consult & BGModal & SchedMgr & StdReq --> APIJS[api.js + axios<br/>attaches CSRF token on writes]
    APIJS --> Ctrl[PHP API controllers]
    Ctrl --> Guard{require_login + require_role<br/>+ verify_csrf_on_state_change}
    Guard -- Fail --> Denied{{401 or 403 - access blocked}}
    Guard -- Pass --> PDOQ[(PDO prepared statements)]
    PDOQ --> MySQL[(MySQL hospital_db)]
    PDOQ --> AuditHelper[(includes/audit.php -> audit_logs)]

    MySQL --> LiveSync[live-sync.js polling ?action=sync_state]
    LiveSync --> SyncEvent{{Dispatches cprms:sync across all open browser tabs}}
    SyncEvent -.-> RecDash & DocDash
```

## Shape legend
- **Stadium `([ ])`** — start and end states.
- **Parallelogram `[/ /]`** — a person-facing action.
- **Rectangle `[ ]`** — a processing step or screen.
- **Cylinder `[( )]`** — a database table or transaction.
- **Diamond `{ }`** — a yes/no decision.
- **Subroutine `[[ ]]`** — a grouped set of screens.
- **Hexagon `{{ }}`** — a system alert or notice.
- **Dashed line `-.->`** — real-time asynchronous browser event broadcast.

## How to read it
1. **Login & roles** — `login.html` checks credentials through `api/auth_controller.php`, applies failed-attempt rate limiting, then routes the user by role: Administrator, Doctor, or Receptionist. Session probe (`action=check`) prevents red console errors.
2. **Administrator portal** — maintains master files ([[Manage Users]], [[Manage Patients]], [[Manage Doctors]], [[Manage Specialties]], [[Manage Services]]), manages weekly doctor schedules and presets (`doctor_schedules`), reviews and approves standard record access requests, inspects the compliance audit log, and manages the [[Manage Archive]] recycle bin (soft-delete lifecycle in [[Database Schema]]).
3. **Receptionist portal** — lands directly on the Receptionist Overview dashboard with KPI counters, 10-patient capacity gauge, and lobby queue table. Books appointments with live doctor duty day badges, calendar date `min` bounds, 08:00–17:00 operating time bounds, zero-retype draft preservation, triage vitals, and printable appointment slips ([[Receptionist Appointments]]).
4. **Doctor portal** — accesses daily appointments with date range pickers and stacked vitals, browses the universal patient directory with a two-tier access architecture (standard 24-hr approved request or audited Break-Glass emergency override for unassigned patients), charts clinical encounters ([[Doctor Consultation]]), and saves them in an all-or-nothing transaction that marks the visit `completed` and elevates allergies to `Doctor Confirmed`. Completed visits are locked against post-consultation editing, allowing only dated addenda.
5. **Shared pipeline & live sync** — every write action travels through `api.js` (attaching the CSRF token) → PHP controller → auth, permission, and schedule guards → PDO prepared statements. Critical actions (break-glass overrides, schedule edits, demographic changes, allergy confirmations) are permanently recorded in `audit_logs` via `includes/audit.php`. Behind the scenes, `live-sync.js` polls `sync_state` and fires `cprms:sync` custom events to auto-refresh queues in real-time across all open browser tabs.
