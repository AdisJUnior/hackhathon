param([string]$NodePath = 'node')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not $env:CDSE_CLIENT_ID) { $env:CDSE_CLIENT_ID = [Environment]::GetEnvironmentVariable('CDSE_CLIENT_ID', 'User') }
if (-not $env:CDSE_CLIENT_SECRET) { $env:CDSE_CLIENT_SECRET = [Environment]::GetEnvironmentVariable('CDSE_CLIENT_SECRET', 'User') }
& $NodePath (Join-Path $PSScriptRoot 'copernicus-sync.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Synchronizace Copernicus selhala.' }
& $NodePath (Join-Path $projectRoot 'node_modules/typescript/bin/tsc')
if ($LASTEXITCODE -ne 0) { throw 'Kontrola TypeScriptu selhala.' }
& $NodePath (Join-Path $projectRoot 'node_modules/vite/bin/vite.js') build
if ($LASTEXITCODE -ne 0) { throw 'Sestavení aplikace selhalo.' }
