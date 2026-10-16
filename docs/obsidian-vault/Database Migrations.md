---
tags: [database, setup]
---

# Database Migrations

**Rule:** every time the repo is synced (`git fetch` / `git pull` / fast-forward), **inspect `migrations/` for new or changed SQL files.** Schema drift is the cause of confusing runtime errors, but **do not apply destructive migrations automatically.** Always verify your local database matches the script's expected baseline, create a backup, and get explicit approval before executing structural changes.

There is no migration-tracking table in the database, so "is my machine up to date?" is answered by comparing `information_schema` against the checklist below.

## Migration inventory

| File | What it does | Safe to re-run? |
| --- | --- | --- |
| `001_add_soft_delete.sql` | Adds `deleted_at` to users, patients, doctors, services, specialties, discounts | No |
| `002_seed_sample_data.sql` | Seeds demo users/patients/doctors/etc. | No |
| `003_link_doctors_users.sql` | Adds `doctors.user_id` (unique + FK to users), creates doctor login accounts | No |
| `004_update_user_name_fields.sql` | Adds `users.first_name/last_name/middle_initial/gender`, drops `users.full_name` | No |
| `005_normalize_doctors_users.sql` | Identity lives only on `users`; drops name/gender columns from `doctors` | No |
| `005a_drop_legacy_financial_remnants.sql` | Safely cleans up residual financial triggers and views | No |
| `update_schema.sql` | Unique billing↔consultation, `medications.deleted_at`, `patients.middle_initial`, lowercase gender ENUM | No |
| `006_remove_financial_schema.sql` | Pivots to pure Patient Information System by dropping `billing`, `invoice_items`, `discounts`, `medications.unit_price`, and `services.price` | No |
| `007_seed_medications.sql` | Seeds standard clinical medication catalog into `medications` | No |
| `008_icd10_catalog.sql` | Adds international ICD-10 medical catalog and lookup tables | No |
| `009_prescriptions_time_to_take.sql` | Adds `time_to_take` column to `prescriptions` table for dosing instructions | No |
| `010_enforce_vitals_cardinality.sql` | Enforces 1-to-1 cardinality and constraints on triage `vital_signs` | No |
| `011_create_audit_logs.sql` | Creates immutable `audit_logs` table for compliance and security tracking | No |
| `012_clinical_safety_and_constraints.sql` | Creates `consultation_addenda` table and unique active slot constraint on `appointments` | No |
| `013_doctor_schedules_and_hybrid_break_glass.sql` | Creates `doctor_schedules` and `record_access_requests` tables, seeds multi-specialties and fixed weekly doctor duty rotas | No |
| `hospital_db.sql` | **DEPRECATED**: Legacy structural dump. **Do not use.** | n/a |

> [!warning] Fresh installs use `setup/schema.sql`
> The legacy `hospital_db.sql` and historical migrations are strictly for updating existing legacy databases. **For all new installations, use the `setup/` directory instead.** `setup/schema.sql` already contains the finalized post-migration structures.

## Step 1 — check for recent migration changes

From the repo folder after syncing:

```powershell
# what changed in migrations since your last look
git log --oneline -10 -- migrations/
git log -p -2 -- migrations/          # show the latest diffs

# with a synced upstream ref, list only what you don't have yet
git fetch origin --prune
git log --oneline HEAD..origin/zur-test -- migrations/
git diff --stat HEAD..origin/zur-test -- migrations/
```

If any file is new or changed, identify what it expects (columns/tables) before touching the DB.

## Step 2 — compare against your machine (read-only)

Point `$mysql` at your stack's MySQL client:
- WAMP: `C:\wamp64\bin\mysql\<version>\bin\mysql.exe`
- XAMPP: `C:\xampp\mysql\bin\mysql.exe`

```powershell
$mysql = "C:\xampp\mysql\bin\mysql.exe"

& $mysql --host=127.0.0.1 --port=3306 --user=root --database=hospital_db --batch --execute="SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='hospital_db' AND TABLE_NAME IN ('users','doctors','patients','medications','services','audit_logs','consultation_addenda') ORDER BY TABLE_NAME, ORDINAL_POSITION;"
```

Spot checks for the **Post-Migration Patient Records Schema**:

| Check | Expected at latest |
| --- | --- |
| `users.gender` | `varchar(50) NOT NULL DEFAULT 'unknown'` |
| `patients.gender` | `varchar(50) NOT NULL DEFAULT 'unknown'` |
| `patients.allergies_alerts` | `text NULL` |
| `patients.allergies_confirmed_by_doctor` | `tinyint(1) NOT NULL DEFAULT '0'` |
| `prescriptions.time_to_take` | `varchar(100) NULL` |
| `prescriptions.strength, route, duration, instructions` | `varchar(100)`, `varchar(50)`, `varchar(50)`, `text` NULL |
| `audit_logs` table | present |
| `consultation_addenda` table | present |
| `doctor_schedules` table | present |
| `record_access_requests` table | present |
| `billing`, `invoice_items`, `discounts` tables | **Absent** |

Handy one-liners:

```sql
SHOW COLUMNS FROM users    LIKE 'gender';
SHOW COLUMNS FROM patients LIKE 'allergies%';
SHOW TABLES LIKE 'audit_logs';
SHOW TABLES LIKE 'consultation_addenda';
SHOW TABLES LIKE 'doctor_schedules';
SHOW TABLES LIKE 'record_access_requests';
SHOW TABLES LIKE 'billing';                     -- expect empty (migration 006)
```

## Step 3 — apply what's missing

**Important for Fresh Installs:** Do not run historical migrations. Fresh installations must exclusively use `setup/schema.sql`, `setup/seeds.sql`, and `setup/bootstrap_admin.php`, which already contain the final schema.

For **existing databases**, inspect the specific migration file to confirm your database meets its exact preconditions before running it via CLI.

## Applied-migration log

| Date | Action | Result |
| --- | --- | --- |
| 2026-09-28 | Verified local `hospital_db` against repo | 001–005 + `update_schema.sql` applied |
| 2026-09-28 | Applied gender widening to `users` + `patients` | Both now `varchar(50) NOT NULL DEFAULT 'unknown'` |
| 2026-10-05 | Applied `006_remove_financial_schema.sql` | Pivoted to pure clinical records system |
| 2026-10-08 | Applied `008_icd10_catalog.sql` + `009_prescriptions_time_to_take.sql` | Added ICD-10 catalog and prescription timing |
| 2026-10-10 | Applied `010_enforce_vitals_cardinality.sql` | Enforced vitals 1-to-1 cardinality |
| 2026-10-10 | Applied `011_create_audit_logs.sql` | Added immutable compliance audit trail |
| 2026-10-10 | Applied `012_clinical_safety_and_constraints.sql` | Added consultation addenda and unique appointment slot constraint |
| 2026-10-13 | Applied `013_doctor_schedules_and_hybrid_break_glass.sql` | Configured doctor schedules and hybrid break-glass / standard access requests |
| 2026-10-16 | Applied `014_structured_prescriptions.sql` | Added `strength`, `route`, `duration`, and `instructions` to `prescriptions` for structured medication orders |

## Related

- [[Database Schema]] — current tables, conventions, and relationships.
- [[Team Sync]] — daily pull/commit/rebase/push workflow for both developers.
- [[Setup (WAMP or XAMPP)]] — fresh install using `setup/schema.sql`.
- [[Changelog]] — where schema-affecting changes are described.
