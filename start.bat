@echo off
:: start.bat — Launch Chat Overlay Widget (dev mode)
:: Double-click or run from cmd/powershell

title Chat Overlay Widget

:: Change to script directory
cd /d "%~dp0"

echo ============================================
echo   Chat Overlay Widget - Dev Launcher
echo ============================================
echo.
echo Starting app... (first build may take 1-2 min)
echo Close the app window or press Ctrl+C to stop.
echo.

:: Launch via the existing bash script (Git Bash required)
bash scripts/tauri-dev.sh

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] App exited with errors. Running cleanup...
    bash scripts/kill-all.sh
    echo.
    pause
)
