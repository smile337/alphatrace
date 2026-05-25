param(
  [long] $NotifyChatId = 0,
  [int] $IntervalSeconds = 60
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$ensure = Join-Path $PSScriptRoot "dev-ensure.ps1"
$log = Join-Path $root "dev-watch.log"

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $result = powershell -NoProfile -ExecutionPolicy Bypass -File $ensure -NotifyChatId $NotifyChatId 2>&1
  if ($LASTEXITCODE -eq 0) {
    Add-Content -Path $log -Value "[$stamp] OK $result"
  } else {
    Add-Content -Path $log -Value "[$stamp] ERROR $result"
  }
  Start-Sleep -Seconds $IntervalSeconds
}
