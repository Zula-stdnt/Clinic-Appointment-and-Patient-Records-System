---
tags: [setup, workflow]
---

# Team Sync (2 Developers)

Both developers work directly in the same repository and branch:

- Repo: `Zula-stdnt/Hospital-Billing-and-Patient-Information-System` (remote name `upstream`)
- Branch: `zur-test`
- Each developer has their own local clone; both have push access.

> Forks are optional (backup only). There is no PR step for daily work.

## Daily protocol

### 1. Start of work — get the latest
```powershell
git pull --rebase
```
(If the one-time config is set, plain `git pull` already does this: `git config pull.rebase true`.)

### 2. Commit your changes
```powershell
git status
git add <files>
git commit -m "feat: short description"
```

### 3. Before pushing — replay your work on top of theirs
```powershell
git pull --rebase
git push
```
Your commit gets a **new SHA** while the content is kept; their commits end up underneath yours. The push is then a normal fast-forward — **never use `--force` on a shared branch**.

## What happens in each situation

| Situation                                   | `sync-zur-test.ps1`                                                    | You do                                           |
| ------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| They pushed, you have no local commits      | fast-forwards automatically                                            | nothing                                          |
| They pushed, you have local commits         | logs `cannot fast-forward`, changes nothing                            | `git pull --rebase` → fix conflicts → `git push` |
| You have local commits, they haven't pushed | `already up to date`                                                   | `git push`                                       |
| You are mid-edit (uncommitted)              | fast-forwards only if incoming files do not overlap; otherwise refuses | commit or stash, then rebase                     |

### Conflicts (both edited the same lines)
```powershell
# edit the files marked with <<<<<<< ======= >>>>>>>
git add <file>
git rebase --continue
git push
```

### Push rejected (`fetch first`)
```powershell
git pull --rebase
git push
```

## Event-driven sync (no background process)

Checks run only when a developer does something — nothing runs in the background.

### pre-push hook (the gate)

Install once per clone:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\wamp64\www\[1] hospital_billing\scripts\install-hooks.ps1"
```

On every `git push` while on `zur-test`:

| State vs `upstream/zur-test` | Hook action |
| --- | --- |
| up to date, or ahead | push continues normally |
| behind, no local commits | fast-forwards automatically, then asks you to run `git push` again |
| diverged (both sides have commits) | aborts; run `git pull --rebase`, then push |
| local edits block the update | aborts; commit or stash, then `git pull --rebase` |

It only ever fast-forwards — it never rewrites commits and never runs in the background. Offline pushes are allowed.

### VS Code folder-open

`.vscode/tasks.json` runs `sync-zur-test.ps1` once when the project folder is opened (approve "allow automatic tasks" the first time). This brings you up to date before you start editing.

### Manual sync

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\wamp64\www\[1] hospital_billing\scripts\sync-zur-test.ps1"
```
Logs to `.git/auto-sync-zur-test.log`; warns when `migrations/` changed so you can update `hospital_db` (see [[Database Migrations]]).

## Golden rules
- `git pull --rebase` → `git push`. Never `git push --force`, never `git reset --hard` on shared work.
- Commit small and push often — the smaller the gap, the smaller the chance of conflicts.
- After any pull, if `migrations/` changed, apply the SQL to your local `hospital_db` (see [[Database Migrations]]).

## Related
- [[Database Migrations]] — check/apply schema updates after each sync.
- [[Setup (WAMP)]] — local environment setup.
- [[Changelog]] — what changed and why.
