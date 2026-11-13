param([string]$At = '06:00')
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) '.env.local')) -and
    (-not [Environment]::GetEnvironmentVariable('CDSE_CLIENT_ID', 'User') -or -not [Environment]::GetEnvironmentVariable('CDSE_CLIENT_SECRET', 'User'))) {
  throw 'Před registrací připravte .env.local nebo trvalé uživatelské proměnné CDSE_CLIENT_ID a CDSE_CLIENT_SECRET.'
}
$runner = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'run-sync.ps1')).Path
$node = if (Test-Path -LiteralPath 'C:\Program Files\nodejs\node.exe') { 'C:\Program Files\nodejs\node.exe' } else { (Get-Command node -ErrorAction Stop).Source }
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -NodePath `"$node`"" -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Daily -At $At
Register-ScheduledTask -TaskName 'KamVenCopernicusSync' -Action $action -Trigger $trigger -Description 'Denní kontrola Sentinel-2 a FSC; přijímá jen dostatečně kvalitní měření.' -Force | Out-Null
Write-Output "Naplánováno denně v $At. Úloha běží pod aktuálním uživatelem."
