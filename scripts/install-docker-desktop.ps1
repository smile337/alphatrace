$ErrorActionPreference = "Stop"
$logPath = "D:\work\1\docker-install.log"
Start-Transcript -Path $logPath -Append | Out-Null

try {

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  throw "Please run this script from an elevated PowerShell session."
}

Write-Step "Enabling Windows features required by Docker Desktop WSL2 backend"
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Step "Installing WSL kernel/platform if available"
try {
  wsl.exe --install --no-distribution
} catch {
  Write-Host "wsl --install --no-distribution did not complete. Continuing because DISM features were enabled." -ForegroundColor Yellow
}

Write-Step "Setting WSL default version to 2"
try {
  wsl.exe --set-default-version 2
} catch {
  Write-Host "WSL default version may require a reboot before this succeeds." -ForegroundColor Yellow
}

Write-Step "Installing Docker Desktop with winget"
winget install --exact --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements

Write-Step "Docker Desktop installation command completed"
Write-Host "If Docker is not available yet, reboot Windows, then open Docker Desktop once." -ForegroundColor Green
Write-Host "After reboot, verify with: docker --version; docker compose version" -ForegroundColor Green

Read-Host "Press Enter to close"
} finally {
  Stop-Transcript | Out-Null
}
