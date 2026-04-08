@echo off
:: repowise-dashboard.bat — Launch Repowise Dashboard (web UI)
:: Double-click or run from cmd/powershell
:: Press any key in this window to gracefully shut down

title Repowise Dashboard

cd /d "%~dp0"

set PYTHONUTF8=1
set REPOWISE=C:\Users\anujd\miniconda3\envs\repowise\Scripts\repowise.exe
set API_PORT=8000
set UI_PORT=8001

echo ============================================
echo   Repowise Dashboard
echo ============================================
echo.
echo   API:       http://localhost:%API_PORT%
echo   Dashboard: http://localhost:%UI_PORT%
echo   Project:   %cd%
echo.
echo   First launch downloads ~50 MB web UI (one-time).
echo.
echo ============================================
echo   Press Ctrl+C or close this window to stop.
echo ============================================
echo.

:: Check repowise is initialized
if not exist ".repowise\wiki.db" (
    echo [ERROR] Repowise not initialized. Run first:
    echo   %REPOWISE% init --index-only
    echo.
    pause
    exit /b 1
)

:: Auto-select embedder: skip (option 3) to avoid interactive prompt
:: Chat/search in dashboard won't work without embedder, but all other features do
:: To enable chat/search: change "3" to "2" (requires OPENAI_API_KEY) or "1" (requires GEMINI_API_KEY)
echo 3| "%REPOWISE%" serve --port %API_PORT% --ui-port %UI_PORT% --host localhost

:: Cleanup after exit (Ctrl+C or window close)
echo.
echo Shutting down...

:: Kill any orphaned uvicorn/repowise processes on our ports
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%API_PORT% " ^| findstr "LISTENING"') do (
    echo Killing process on port %API_PORT% (PID: %%p)
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%UI_PORT% " ^| findstr "LISTENING"') do (
    echo Killing process on port %UI_PORT% (PID: %%p)
    taskkill /PID %%p /F >nul 2>&1
)

echo.
echo Dashboard stopped. Ports %API_PORT% and %UI_PORT% freed.
