param(
    [string]$Remote = 'upstream',
    [string]$Branch = 'zur-test',
    [string]$RepoPath = ''
)

if (-not $RepoPath) { $RepoPath = Split-Path -Parent $PSScriptRoot }

$log = Join-Path $RepoPath '.git\auto-sync-zur-test.log'

function Write-Log([string]$Message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -LiteralPath $log -Value $line
    Write-Output $line
}

git -C $RepoPath fetch $Remote --prune 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Log "fetch from '$Remote' failed"; exit 1 }

$current = git -C $RepoPath rev-parse --abbrev-ref HEAD
if ($current -ne $Branch) { Write-Log "on branch '$current', not '$Branch' - skipped"; exit 0 }

$old = git -C $RepoPath rev-parse HEAD
$target = "$Remote/$Branch"
git -C $RepoPath merge --ff-only $target 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Log "cannot fast-forward to $target (local commits or conflicting local edits) - resolve manually"
    exit 2
}

$new = git -C $RepoPath rev-parse HEAD
if ($old -eq $new) { Write-Log "already up to date ($($new.Substring(0,7)))"; exit 0 }

Write-Log "updated $($old.Substring(0,7)) -> $($new.Substring(0,7))"

$changedMigrations = git -C $RepoPath diff --name-only "$old..$new" -- migrations/
if ($changedMigrations) {
    Write-Log "MIGRATIONS CHANGED - apply to hospital_db: $($changedMigrations -join ', ')"
}
