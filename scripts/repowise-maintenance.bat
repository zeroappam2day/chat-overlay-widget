@echo off
setlocal
set PYTHONUTF8=1
set REPOWISE=C:\Users\anujd\miniconda3\envs\repowise\Scripts\repowise.exe

echo === Repowise Maintenance ===
echo.

echo [1/4] Updating index...
%REPOWISE% update || echo [WARN] Update failed — run "repowise doctor --repair" if persistent
echo.

echo [2/4] Running doctor...
%REPOWISE% doctor || echo [WARN] Doctor reported issues — review output above
echo.

echo [3/4] Checking dead code...
%REPOWISE% dead-code --safe-only 2>nul || echo [SKIP] Dead code check not available in --index-only mode
echo.

echo [4/4] Regenerating CLAUDE.md...
%REPOWISE% generate-claude-md || echo [WARN] CLAUDE.md generation failed — check .repowise/ integrity
echo.

echo === Maintenance complete ===
endlocal
