param(
  [long] $NotifyChatId = 0
)

$ErrorActionPreference = "Stop"
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
  $PSNativeCommandUseErrorActionPreference = $false
}
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"
$webLog = Join-Path $root "web-start.out.log"
$webErr = Join-Path $root "web-start.err.log"
$apiLog = Join-Path $root "api-dev.out.log"
$apiErr = Join-Path $root "api-dev.err.log"
$tunnelLog = Join-Path $root "cloudflared.log"
$tunnelErr = Join-Path $root "cloudflared.err.log"

function Get-EnvValue([string] $name) {
  $line = Get-Content $envPath | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^$name=""?", "") -replace """$", ""
}

function Set-EnvValue([string] $name, [string] $value) {
  $content = Get-Content $envPath
  $next = $content | ForEach-Object {
    if ($_ -match "^$name=") { "$name=""$value""" } else { $_ }
  }
  Set-Content -Path $envPath -Value $next -Encoding UTF8
}

function Test-HttpOk([string] $url) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
    return [int] $response.StatusCode -ge 200 -and [int] $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-HttpOk([string] $url, [int] $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  do {
    if (Test-HttpOk $url) { return $true }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Ensure-Docker {
  cmd.exe /c "docker info >NUL 2>NUL"
  if ($LASTEXITCODE -ne 0) {
    Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
    $deadline = (Get-Date).AddMinutes(4)
    do {
      Start-Sleep -Seconds 5
      cmd.exe /c "docker info >NUL 2>NUL"
      if ($LASTEXITCODE -eq 0) { break }
    } while ((Get-Date) -lt $deadline)
  }
  docker compose up -d postgres redis
}

function Ensure-Port([int] $port, [string] $file, [string[]] $arguments, [string] $stdout, [string] $stderr) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) { return }
  Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}

function Start-NewTunnel {
  Get-Process | Where-Object { $_.ProcessName -match "cloudflared" } | Stop-Process -Force -ErrorAction SilentlyContinue
  Remove-Item $tunnelLog, $tunnelErr -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath "npx.cmd" -ArgumentList @("cloudflared", "tunnel", "--url", "http://localhost:3000", "--protocol", "http2", "--no-autoupdate") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $tunnelLog -RedirectStandardError $tunnelErr

  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 3
    $text = ""
    if (Test-Path $tunnelLog) { $text += Get-Content $tunnelLog -Raw }
    if (Test-Path $tunnelErr) { $text += Get-Content $tunnelErr -Raw }
    $matches = [regex]::Matches($text, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    if ($matches.Count -gt 0) {
      $candidate = $matches[$matches.Count - 1].Value
      if (Test-HttpOk $candidate) { return $candidate }
    }
  } while ((Get-Date) -lt $deadline)

  throw "Cloudflare tunnel did not become reachable. Check $tunnelLog and $tunnelErr."
}

function Update-Telegram([string] $url) {
  $token = Get-EnvValue "TELEGRAM_BOT_TOKEN"
  if (-not $token) { return }
  $menuBody = @{
    menu_button = @{
      type = "web_app";
      text = "Open AlphaTrace";
      web_app = @{ url = "${url}/" };
    }
  } | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setChatMenuButton" -ContentType "application/json" -Body $menuBody | Out-Null

  if ($NotifyChatId -gt 0) {
    $messageBody = @"
{
  "chat_id": $NotifyChatId,
  "text": "AlphaTrace 临时验收入口已更新，请点这个新按钮。正式产品不能依赖 trycloudflare。",
  "reply_markup": {
    "inline_keyboard": [[
      {
        "text": "Open AlphaTrace",
        "web_app": { "url": "${url}/?startapp=direct" }
      }
    ]]
  }
}
"@
    Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/sendMessage" -ContentType "application/json" -Body $messageBody | Out-Null
  }
}

Ensure-Docker
Ensure-Port 4000 "npm.cmd" @("run", "dev:api") $apiLog $apiErr
Ensure-Port 3000 "npm.cmd" @("run", "start", "--workspace", "@alphatrace/web") $webLog $webErr

if (-not (Wait-HttpOk "http://localhost:3000" 45)) { throw "Web is not reachable on localhost:3000." }

$currentUrl = Get-EnvValue "MINI_APP_URL"
if (-not $currentUrl -or -not (Test-HttpOk $currentUrl)) {
  $currentUrl = Start-NewTunnel
  Set-EnvValue "MINI_APP_URL" $currentUrl
  Update-Telegram $currentUrl
}

[pscustomobject]@{
  web = "http://localhost:3000"
  api = "http://localhost:4000"
  miniAppUrl = $currentUrl
} | ConvertTo-Json -Depth 4
