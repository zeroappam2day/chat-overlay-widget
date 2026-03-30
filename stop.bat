@echo off
:: stop.bat — Kill all Chat Overlay Widget processes
:: Use when the app is stuck or you need a clean restart

title Chat Overlay Widget - Stop

cd /d "%~dp0"

echo ============================================
echo   Chat Overlay Widget - Stopping All
echo ============================================
echo.

bash scripts/kill-all.sh

echo.
echo All processes stopped. Safe to restart.
pause
