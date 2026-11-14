param([string]$NodePath = 'node')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$contextPath = Join-Path $projectRoot '.neon'
if (-not (Test-Path -LiteralPath $contextPath)) { throw 'Chybí lokální propojení .neon; spusťte neon link.' }
$context = Get-Content -LiteralPath $contextPath -Raw | ConvertFrom-Json
if ($context.projectId -notmatch '^[a-z0-9-]+$' -or $context.branch -notmatch '^[a-zA-Z0-9_-]+$') {
  throw 'Neplatný projekt nebo větev v souboru .neon.'
}
$neonCli = Join-Path $env:APPDATA 'npm\neon.cmd'
if (-not (Test-Path -LiteralPath $neonCli)) { throw 'Chybí Neon CLI; nainstalujte jej pomocí npm i -g neon@latest.' }
$sqlPath = Join-Path $projectRoot 'data\neon-sync.sql'
& $NodePath (Join-Path $PSScriptRoot 'export-neon-sync.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Export pro Neon selhal.' }
& $neonCli psql $context.branch --project-id $context.projectId -- -v ON_ERROR_STOP=1 -f $sqlPath
if ($LASTEXITCODE -ne 0) { throw 'Přenos měření do Neonu selhal.' }
