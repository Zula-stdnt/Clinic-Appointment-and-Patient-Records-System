---
tags: [setup, onboarding]
---

# New Developer Manual

One-page onboarding for joining the Hospital Billing project. Details live in [[Setup (WAMP or XAMPP)]], [[Team Sync]], and [[Database Migrations]].

## 0. Before you start
- Ask the owner (`Zula-stdnt`) to add your GitHub account as a **collaborator** on:
  `https://github.com/Zula-stdnt/Hospital-Billing-and-Patient-Information-System.git`
- Install **WAMP** or **XAMPP** (Apache + MySQL + PHP 8), **Git for Windows**, optionally **VS Code**.
- Accept the GitHub invitation (email or repo page → **Accept invitation**).

## 1. Clone the repo with the right remote

The shared repo must be your remote named **`upstream`** — scripts and hooks assume that name.

```powershell
cd C:\wamp64\www                       # WAMP; XAMPP uses C:\xampp\htdocs
git clone https://github.com/Zula-stdnt/Hospital-Billing-and-Patient-Information-System.git hospital_billing
cd hospital_billing
git remote rename origin upstream
git fetch upstream --prune
git checkout zur-test
git remote -v
```

Already cloned a fork? Use **Option B** in [[Setup (WAMP or XAMPP)]] section 1 instead.

## 2. One-time git setup

```powershell
git config pull.rebase true
git config rebase.autoStash true
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\install-hooks.ps1"
```

- Plain `git pull` becomes a rebase (no surprise merge commits).
- The `pre-push` hook auto-syncs you with `upstream/zur-test` before every push — details in [[Team Sync]].

## 3. Environment (WAMP or XAMPP + database)

Web root and MySQL client differ per stack — adjust commands to yours:

| | WAMP | XAMPP |
| --- | --- | --- |
| Web root | `C:\wamp64\www\` | `C:\xampp\htdocs\` |
| MySQL client | `C:\wamp64\bin\mysql\mysql8.4.7\bin\mysql.exe` | `C:\xampp\mysql\bin\mysql.exe` |
| Start services | WAMP tray icon | XAMPP Control Panel |

1. Start **Apache** and **MySQL**.
2. Open `http://localhost/phpmyadmin` → create database `hospital_db`, collation `utf8mb4_unicode_ci`.
3. Select it → **Import** → choose `migrations/hospital_db.sql` → **Go**.
4. Apply any newer migrations listed in [[Database Migrations]].
5. Open the app (`http://localhost/<folder>/login.html`) and sign in with a seeded account (see `README.md`).

Credentials are in `config/db_connect.php` (defaults on both: `root`, empty password, port 3306).

## 4. Daily workflow

```powershell
git pull --rebase                      # 1. start of work
# ... edit files ...
git status                             # 2. review changes
git add -A                             #    stage everything (see note)
git commit -m "feat: short description"
git pull --rebase                      # 3. fold in their work
git push                               # 4. push to upstream/zur-test
```

- `git add -A` stages all changes; if a file must be excluded, stage by name (`git add path/to/file`).
- Never `git push --force` and never `git reset --hard` on shared work.
- Conflicts, rejected pushes, and the situation table: [[Team Sync]].

## 5. After every sync

Check `migrations/` for new/changed SQL and apply it to your local `hospital_db` before running the app — full checklist in [[Database Migrations]].

## Onboarding checklist

- [ ] Added as collaborator on `Zula-stdnt/Hospital-Billing-and-Patient-Information-System`
- [ ] Repo cloned, `origin` renamed to `upstream`
- [ ] On branch `zur-test`, tracking `upstream/zur-test`
- [ ] `pull.rebase` + `rebase.autoStash` configured
- [ ] `install-hooks.ps1` run (pre-push hook active)
- [ ] `hospital_db` created, dump imported, latest migrations applied
- [ ] Login works with a seeded account
- [ ] Test push passed the pre-push hook

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Hook says diverged | `git pull --rebase`, resolve, then `git push` again |
| Push rejected (`fetch first`) | Same: `git pull --rebase` then push |
| VS Code asks "allow automatic tasks" | Allow it (runs the folder-open sync once) |
| 500 on API calls | Check Apache/PHP error log and `config/db_connect.php` |
| Login always fails | Verify `users.password_hash` was made with PHP `password_hash()` |
| Tables empty in UI | API needs an authenticated session with the right role |

## Related
- [[Setup (WAMP or XAMPP)]] — local environment details.
- [[Team Sync]] — daily pull / commit / rebase / push protocol.
- [[Database Migrations]] — schema updates after syncing.
- [[Database Schema]] — tables and relationships.
