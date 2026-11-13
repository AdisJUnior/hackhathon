$ErrorActionPreference = 'Stop'
$clientId = Read-Host 'Copernicus Client ID'
if ([string]::IsNullOrWhiteSpace($clientId)) { throw 'Client ID nesmí být prázdné.' }
$secureSecret = Read-Host 'Copernicus Client Secret (vstup je skrytý)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
try {
  $secretText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrWhiteSpace($secretText)) { throw 'Client Secret nesmí být prázdný.' }
  [Environment]::SetEnvironmentVariable('CDSE_CLIENT_ID', $clientId.Trim(), 'User')
  [Environment]::SetEnvironmentVariable('CDSE_CLIENT_SECRET', $secretText, 'User')
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Variable secretText -ErrorAction SilentlyContinue
}
$idSaved = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('CDSE_CLIENT_ID', 'User'))
$secretSaved = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('CDSE_CLIENT_SECRET', 'User'))
if (-not ($idSaved -and $secretSaved)) { throw 'Trvalý zápis uživatelských proměnných se nepodařil.' }
Write-Output 'Obě proměnné jsou uložené pro tento účet. Zavřete PowerShell a otevřete nový.'
