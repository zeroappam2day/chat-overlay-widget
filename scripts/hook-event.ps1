# scripts/hook-event.ps1
# Claude Code hook script -- forwards stdin JSON to Chat Overlay Widget sidecar.
# Usage in ~/.claude/settings.json hooks:
#   "command": "powershell -ExecutionPolicy Bypass -File C:/path/to/scripts/hook-event.ps1"
#
# Reads discovery file for port/token. Silently exits if sidecar is not running.
$discoveryPath = "$env:APPDATA\chat-overlay-widget\api.port"
if (-not (Test-Path $discoveryPath)) { exit 0 }
$discovery = Get-Content $discoveryPath -Raw | ConvertFrom-Json
$port = $discovery.port
$token = $discovery.token
$body = $input | Out-String
if (-not $body.Trim()) { exit 0 }
# Encode as UTF-8 without BOM — PowerShell defaults can corrupt JSON for Node.js
$utf8 = [System.Text.Encoding]::UTF8.GetBytes($body)
try {
  Invoke-RestMethod `
    -Uri "http://127.0.0.1:$port/hook-event" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json; charset=utf-8" `
    -Body $utf8 `
    -TimeoutSec 1 | Out-Null
} catch { }
exit 0
