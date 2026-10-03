---
tags: [database, setup]
---

# Database Migrations

**Rule:** every time the repo is synced (`git fetch` / `git pull` / fast-forward), **inspect `migrations/` for new or changed SQL files.** Schema drift is the cause of confusing runtime errors, but **do not apply destructive migrations automatically.** Always verify your local database matches the script's expected baseline, create a backup, and get explicit approval before executing structural teardowns like `006`.

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
| `006_remove_financial_schema.sql` | Pivots to pure Patient Information System by dropping `billing`, `invoice_items`, `discounts`, `medications.unit_price`, and `services.price` | No |
| `hospital_db.sql` | **DEPRECATED**: Legacy structural dump. **Do not use.** | n/a |

> [!warning] Fresh installs use `setup/schema.sql`
> The legacy `hospital_db.sql` and historical migrations `001`–`006` are strictly for updating existing legacy databases. **For all new installations, use the `setup/` directory instead.** `setup/schema.sql` already contains the finalized post-migration structures.

### Special Instructions for 006_remove_financial_schema.sql
- **Purpose:** Removes all financial workflows to establish a pure clinical and records system, preserving `services` and `medications` catalogs but dropping their pricing.
- **Baseline Requirements:** The script strictly enforces that `billing` (PK `invoice_id`), `invoice_items`, `discounts`, `users`, `roles`, `services.price`, and `medications.unit_price` precisely exist before running.
- **Backup Required:** **DO NOT** execute without a full `--single-transaction` logical backup (e.g. `mysqldump`). MySQL/MariaDB DDL implicitly auto-commits. If the script fails mid-execution, it leaves partial schema changes and is **not safe to rerun**.
- **Manual Application:** Execute via CLI precisely against the confirmed local target (e.g., `Get-Content migrations\006_remove_financial_schema.sql | mysql -h 127.0.0.1 -P 3306 -u root`). The script explicitly commands `USE hospital_db;` to select the schema, but this does not verify the server identity on its own. If the script aborts via a `SIGNAL SQLSTATE '45000'` due to baseline or dependency gates, fix the underlying issue and safely rerun it. If it crashes during the `DROP/ALTER` section, **do not drop the target database**. Stop application access immediately to preserve the failed database for investigation. Restore the verified backup to a completely separate recovery database, correct the script against the true baseline, and only promote the recovered database after verification and explicit approval.

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
- WAMP: `C:\wamp64\bin\mysql\<version>\bin\mysql.exe` (list versions with `Get-ChildItem C:\wamp64\bin\mysql`)
- XAMPP: `C:\xampp\mysql\bin\mysql.exe`

```powershell
$mysql = "C:\wamp64\bin\mysql\mysql8.4.7\bin\mysql.exe"   # XAMPP: "C:\xampp\mysql\bin\mysql.exe"

& $mysql --host=127.0.0.1 --port=3306 --user=root --database=hospital_db --batch --execute="SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='hospital_db' AND TABLE_NAME IN ('users','doctors','patients','medications','services') ORDER BY TABLE_NAME, ORDINAL_POSITION;"
```

Spot checks for the **Post-Migration Patient Records Schema**:

| Check | Expected at latest |
| --- | --- |
| `users.gender` | `varchar(50) NOT NULL DEFAULT 'unknown'` |
| `patients.gender` | `varchar(50) NOT NULL DEFAULT 'unknown'` |
| `patients.middle_initial` | present |
| `doctors` | has `user_id` + `contact_no` only (no name/gender columns) |
| `deleted_at` | present on users, patients, doctors, services, specialties, medications |
| `billing`, `invoice_items`, `discounts` tables | **Absent** |
| `services.price` | **Absent** |
| `medications.unit_price` | **Absent** |

Handy one-liners:

```sql
SHOW COLUMNS FROM users    LIKE 'gender';
SHOW COLUMNS FROM patients LIKE 'gender';
SHOW COLUMNS FROM doctors  LIKE 'first_name';   -- expect empty (migration 005)
SHOW TABLES LIKE 'billing';                     -- expect empty (migration 006)
SHOW COLUMNS FROM services LIKE 'price';        -- expect empty (migration 006)
```

## Step 3 — apply what's missing

**Important for Fresh Installs:** Do not run historical migrations. Fresh installations must exclusively use `setup/schema.sql`, `setup/seeds.sql`, and `setup/bootstrap_admin.php`, which already contain the final schema.

For **existing databases**, follow these strict rules:
1. **Determine what is needed:** Because there is no migration-tracking table, do not assume every developer's local database has the same baseline. The Step 2 checks only verify the *final* post-migration state—they do not identify which intermediate migration you might be missing. You must manually inspect your current schema and read the specific migration file to confirm your database meets its exact preconditions. If you cannot confidently identify your baseline, **stop and seek review**.
2. **Never replay blindly:** Do not blanket-apply files in numeric order, as this could unsafely replay destructive migrations against the wrong schema.
3. **Safety first:** Always back up your database before applying structural changes. Destructive migrations like `006_remove_financial_schema.sql` require explicit approval and precise baseline matching.

When you and the team have confirmed your database precisely matches a migration's required starting state, apply it via the MySQL client (e.g., `Get-Content .\migrations\the_specific_migration.sql | & $mysql --host=127.0.0.1 --port=3306 --user=root --database=hospital_db`).

One-off schema fixes that are not yet a numbered file (apply manually, then record them below):

Example — gender widened to `VARCHAR(50)` (from commit `70757ae`):

```sql
ALTER TABLE users    MODIFY COLUMN gender VARCHAR(50) NOT NULL DEFAULT 'unknown';
ALTER TABLE patients MODIFY COLUMN gender VARCHAR(50) NOT NULL DEFAULT 'unknown';
```

After applying, re-run the Step 2 query to confirm your database matches the current target.

## Applied-migration log

| Date | Action | Result |
| --- | --- | --- |
| 2026-09-28 | Verified local `hospital_db` against repo | 001–005 + `update_schema.sql` already applied |
| 2026-09-28 | Applied `70757ae` gender widening to `users` + `patients` | Both now `varchar(50) NOT NULL DEFAULT 'unknown'` |

## Related

- [[Database Schema]] — current tables, conventions, and relationships.
- [[Team Sync]] — daily pull/commit/rebase/push workflow for both developers.
- [[Setup (WAMP or XAMPP)]] — fresh install using `setup/schema.sql`.
- [[Changelog]] — where schema-affecting changes are described.
