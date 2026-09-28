param(
    [string]$RepoPath = ''
)

if (-not $RepoPath) { $RepoPath = Split-Path -Parent $PSScriptRoot }

$source = Join-Path $RepoPath 'scripts\pre-push'
$target = Join-Path $RepoPath '.git\hooks\pre-push'

if (-not (Test-Path -LiteralPath $source)) {
    Write-Error "Hook source not found: $source"
    exit 1
}

Copy-Item -LiteralPath $source -Destination $target -Force
Write-Output "Installed pre-push hook -> $target"
