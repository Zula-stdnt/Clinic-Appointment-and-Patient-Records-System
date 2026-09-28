---
tags: [database, setup]
---

# Database Migrations

**Rule:** every time the repo is synced (`git fetch` / `git pull` / fast-forward), **check `migrations/` for new or changed SQL files and apply them to the local `hospital_db` before running the app.** Schema drift is the cause of confusing runtime errors (example: saving a custom gender into an old `ENUM` column fails with a data-truncated error).

There is no migration-tracking table in the database, so "is my machine up to date?" is answered by comparing `information_schema` against the checklist below.

## Migration inventory

| File | What it does | Safe to re-run? |
| --- | --- | --- |
| `001_add_soft_delete.sql` | Adds `deleted_at` to users, patients, doctors, services, specialties, discounts | No |
| `002_seed_sample_data.sql` | Seeds demo users/patients/doctors/etc. | No |
| `003_link_doctors_users.sql` | Adds `doctors.user_id` (unique + FK to users), creates doctor login accounts | No |
| `004_update_user_name_fields.sql` | Adds `users.first_name/last_name/middle_initial/gender`, drops `users.full_name` | No |
| `005_normalize_doctors_users.sql` | Identity lives only on `users`; drops name/gender columns from `doctors` | No |
| `update_schema.sql` | Unique billing↔consultation, `medications.deleted_at`, `patients.middle_initial`, lowercase gender ENUM | No |
| `hospital_db.sql` | Full dump for **fresh installs only** — import into an empty `hospital_db`. Never run against an existing database. | n/a |

> [!warning] `hospital_db.sql` can lag behind the numbered migrations
> The owner's dump still lists `doctors.first_name` / `doctors.gender` (migration `005` was never applied there). The app code reads doctor names from `users` via `user_id`, so follow the numbered migrations and [[Database Schema]], not the dump.

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

Adjust the MySQL path to your installed version (`Get-ChildItem C:\wamp64\bin\mysql`).

```powershell
& "C:\wamp64\bin\mysql\mysql8.4.7\bin\mysql.exe" --host=127.0.0.1 --port=3306 --user=root --database=hospital_db --batch --execute="SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='hospital_db' AND TABLE_NAME IN ('users','doctors','patients','medications','billing') ORDER BY TABLE_NAME, ORDINAL_POSITION;"
```

Spot checks:

| Check | Expected at latest |
| --- | --- |
| `users.gender` | `varchar(50) NOT NULL DEFAULT 'unknown'` |
| `patients.gender` | `varchar(50) NOT NULL DEFAULT 'unknown'` |
| `patients.middle_initial` | present |
| `doctors` | has `user_id` + `contact_no` only (no name/gender columns) |
| `deleted_at` | present on users, patients, doctors, services, specialties, discounts, medications |
| `billing.fk_billing_consultation` | unique (`Non_unique = 0`) |
| tables | includes `doctor_specialty`, `roles`, `vital_signs`, … |

Handy one-liners:

```sql
SHOW COLUMNS FROM users    LIKE 'gender';
SHOW COLUMNS FROM patients LIKE 'gender';
SHOW COLUMNS FROM doctors  LIKE 'first_name';   -- expect empty (migration 005)
SHOW INDEX  FROM billing   WHERE Key_name = 'fk_billing_consultation';
```

## Step 3 — apply what's missing

Run migrations in numeric order, then `update_schema.sql`. Pipe the file through the MySQL client (works for both DDL and `USE`/multi-statement files):

```powershell
Get-Content .\migrations\005_normalize_doctors_users.sql | & "C:\wamp64\bin\mysql\mysql8.4.7\bin\mysql.exe" --host=127.0.0.1 --port=3306 --user=root --database=hospital_db
```

One-off schema fixes that are not yet a numbered file (apply manually, then record them below):

Example — gender widened to `VARCHAR(50)` (from commit `70757ae`):

```sql
ALTER TABLE users    MODIFY COLUMN gender VARCHAR(50) NOT NULL DEFAULT 'unknown';
ALTER TABLE patients MODIFY COLUMN gender VARCHAR(50) NOT NULL DEFAULT 'unknown';
```

After applying, re-run the Step 2 query to confirm.

## Applied-migration log

| Date | Action | Result |
| --- | --- | --- |
| 2026-09-28 | Verified local `hospital_db` against repo | 001–005 + `update_schema.sql` already applied |
| 2026-09-28 | Applied `70757ae` gender widening to `users` + `patients` | Both now `varchar(50) NOT NULL DEFAULT 'unknown'` |

## Related

- [[Database Schema]] — current tables, conventions, and relationships.
- [[Team Sync]] — daily pull/commit/rebase/push workflow for both developers.
- [[Setup (WAMP)]] — fresh install of WAMP + import of `hospital_db.sql`.
- [[Changelog]] — where schema-affecting changes are described.
