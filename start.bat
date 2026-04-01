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

:: Resolve Git Bash — must use Git Bash, NOT WSL bash (C:\Windows\System32\bash.exe)
:: WSL bash uses /mnt/c/ mount points; all script paths assume Git Bash /c/ format.
set "GITBASH="
if exist "C:\Program Files\Git\bin\bash.exe" (
    set "GITBASH=C:\Program Files\Git\bin\bash.exe"
) else (
    :: Fallback: search PATH (may pick up WSL bash — script has a WSL guard)
    where bash.exe >nul 2>&1 && set "GITBASH=bash"
)
if not defined GITBASH (
    echo [ERROR] Git Bash not found. Install Git for Windows.
    pause
    exit /b 1
)

"%GITBASH%" scripts/tauri-dev.sh

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] App exited with errors. Running cleanup...
    "%GITBASH%" scripts/kill-all.sh
    echo.
    echo Diagnostic log: scripts\tauri-dev.log
    echo.
    pause
)
