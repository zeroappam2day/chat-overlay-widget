#!/usr/bin/env bash
# tauri-dev.sh — Reliable `tauri dev` launcher for Windows + Defender environments
# 3-layer defense: Defender exclusion check → lock-polling wait → retry loop
# Usage: bash scripts/tauri-dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/tauri-dev.log"

cd "$PROJECT_DIR"

# ── Logging ──────────────────────────────────────────────────────────────────
log() {
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] $*" | tee -a "$LOG_FILE"
}

log_section() {
    echo "" >> "$LOG_FILE"
    log "━━━ $* ━━━"
}

# Rotate log if > 100KB
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)" -gt 102400 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.prev"
fi

log_section "tauri-dev.sh started"

export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_INCREMENTAL=0
export RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-C codegen-units=1"

SIDECAR_BIN="$PROJECT_DIR/src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe"

# ── Layer 0: Diagnostics ────────────────────────────────────────────────────
diagnose_environment() {
    log_section "DIAGNOSTICS"

    # Sidecar binary info
    if [ -f "$SIDECAR_BIN" ]; then
        local size mtime now age
        size=$(wc -c < "$SIDECAR_BIN" 2>/dev/null || echo "unknown")
        mtime=$(stat -c %Y "$SIDECAR_BIN" 2>/dev/null || powershell.exe -NoProfile -Command "(Get-Item (Resolve-Path '$SIDECAR_BIN' -ErrorAction SilentlyContinue).Path).LastWriteTimeUtc | Get-Date -UFormat '%s'" 2>/dev/null || echo 0)
        now=$(date +%s)
        age=$(( now - ${mtime%.*} ))
        log "Sidecar binary: exists, ${size} bytes, ${age}s old"
    else
        log "Sidecar binary: MISSING at $SIDECAR_BIN"
    fi

    # Defender exclusion check (non-admin, read-only)
    local exclusion_status
    exclusion_status=$(powershell.exe -NoProfile -Command "
        try {
            \$prefs = Get-MpPreference -ErrorAction Stop
            \$binDir = (Resolve-Path '$PROJECT_DIR/src-tauri/binaries' -ErrorAction SilentlyContinue).Path
            \$targetDir = (Resolve-Path '$PROJECT_DIR/src-tauri/target' -ErrorAction SilentlyContinue).Path
            \$paths = \$prefs.ExclusionPath
            if (-not \$paths) { 'NO_EXCLUSIONS'; exit 0 }
            \$binOk = \$false; \$tgtOk = \$false
            foreach (\$p in \$paths) {
                if (\$binDir -and \$p -eq \$binDir) { \$binOk = \$true }
                if (\$targetDir -and \$p -eq \$targetDir) { \$tgtOk = \$true }
            }
            \"binaries=\$binOk target=\$tgtOk\"
        } catch {
            'QUERY_FAILED: ' + \$_.Exception.Message
        }
    " 2>/dev/null || echo "PS_ERROR")
    log "Defender exclusions: $exclusion_status"

    # Check if Defender real-time protection is active
    local rt_status
    rt_status=$(powershell.exe -NoProfile -Command "
        try {
            \$mp = Get-MpComputerStatus -ErrorAction Stop
            'RealTimeProtection=' + \$mp.RealTimeProtectionEnabled.ToString() + ' AntivirusEnabled=' + \$mp.AntivirusEnabled.ToString()
        } catch { 'QUERY_FAILED: ' + \$_.Exception.Message }
    " 2>/dev/null || echo "PS_ERROR")
    log "Defender status: $rt_status"

    # Check for stale sidecar processes (the #1 cause of "Access Denied" on build)
    local stale_procs
    stale_procs=$(powershell.exe -NoProfile -Command "
        \$procs = @()
        \$procs += Get-Process -Name 'sidecar*' -ErrorAction SilentlyContinue | Select-Object Id,Name,Path
        \$procs += Get-Process -Name 'node' -ErrorAction SilentlyContinue | Where-Object { \$_.Path -like '*caxa*sidecar*' } | Select-Object Id,Name,Path
        if (\$procs.Count -gt 0) {
            \$procs | ForEach-Object { \"\$(\$_.Id) \$(\$_.Name) \$(\$_.Path)\" }
        } else { 'NONE' }
    " 2>/dev/null || echo "PS_ERROR")
    log "Stale sidecar processes: $stale_procs"

    # File lock test on source binary
    if [ -f "$SIDECAR_BIN" ]; then
        local win_path
        win_path=$(powershell.exe -NoProfile -Command "(Resolve-Path '${SIDECAR_BIN}' -ErrorAction SilentlyContinue).Path" 2>/dev/null || echo "$SIDECAR_BIN")
        local lock_result
        lock_result=$(powershell.exe -NoProfile -Command "
            try {
                \$f = [System.IO.File]::Open(
                    '${win_path}',
                    [System.IO.FileMode]::Open,
                    [System.IO.FileAccess]::Read,
                    [System.IO.FileShare]::Read)
                \$f.Close(); \$f.Dispose()
                'UNLOCKED'
            } catch {
                'LOCKED: ' + \$_.Exception.Message
            }
        " 2>/dev/null || echo "PS_ERROR")
        log "Sidecar source lock: $lock_result"
    fi

    # File lock test on target/debug/sidecar.exe (tauri-build destination — most common blocker)
    local dest_bin="$PROJECT_DIR/src-tauri/target/debug/sidecar.exe"
    if [ -f "$dest_bin" ]; then
        local dest_win
        dest_win=$(powershell.exe -NoProfile -Command "(Resolve-Path '${dest_bin}' -ErrorAction SilentlyContinue).Path" 2>/dev/null || echo "$dest_bin")
        local dest_lock
        dest_lock=$(powershell.exe -NoProfile -Command "
            try {
                \$f = [System.IO.File]::Open(
                    '${dest_win}',
                    [System.IO.FileMode]::Open,
                    [System.IO.FileAccess]::ReadWrite,
                    [System.IO.FileShare]::Delete)
                \$f.Close(); \$f.Dispose()
                'UNLOCKED'
            } catch {
                'LOCKED: ' + \$_.Exception.Message
            }
        " 2>/dev/null || echo "PS_ERROR")
        log "Sidecar dest lock (target/debug/sidecar.exe): $dest_lock"
    fi
}

diagnose_environment

# ── Layer 0b: Kill stale sidecar processes ───────────────────────────────────
# tauri-build calls remove_file() on target/debug/sidecar.exe before copying.
# Windows can't delete a running EXE → OS error 5 "Access is denied."
kill_stale_sidecars() {
    local killed=0
    # Kill sidecar.exe and sidecar-x86_64-pc-windows-msvc.exe by image name
    if taskkill //F //IM "sidecar.exe" >/dev/null 2>&1; then
        log "Killed stale sidecar.exe"
        killed=1
    fi
    if taskkill //F //IM "sidecar-x86_64-pc-windows-msvc.exe" >/dev/null 2>&1; then
        log "Killed stale sidecar-x86_64-pc-windows-msvc.exe"
        killed=1
    fi
    # Kill caxa-extracted node processes
    wmic process where "Name='node.exe' and CommandLine like '%caxa%sidecar%'" call terminate >/dev/null 2>&1 && {
        log "Killed caxa-extracted sidecar node"
        killed=1
    }
    if [ "$killed" -eq 1 ]; then
        echo "[tauri-dev] Killed stale sidecar processes from previous session"
        sleep 1  # brief pause for Windows to release file handles
    fi
}

kill_stale_sidecars

# ── Layer 1: Defender exclusion nudge ────────────────────────────────────────
check_defender_exclusion() {
    local has_exclusion
    has_exclusion=$(powershell.exe -NoProfile -Command "
        try {
            \$paths = (Get-MpPreference -ErrorAction Stop).ExclusionPath
            \$binDir = (Resolve-Path '$PROJECT_DIR/src-tauri/binaries' -ErrorAction SilentlyContinue).Path
            if (\$paths -and \$binDir -and (\$paths -contains \$binDir)) { 'yes' } else { 'no' }
        } catch { 'unknown' }
    " 2>/dev/null || echo "unknown")

    if [ "$has_exclusion" = "no" ]; then
        log "WARNING: Defender exclusion NOT set for src-tauri/binaries/"
        echo ""
        echo "┌──────────────────────────────────────────────────────────────┐"
        echo "│  ⚠  Defender exclusion missing for sidecar binaries         │"
        echo "│  Builds may fail with 'Access Denied' or 'os error 32'     │"
        echo "│                                                              │"
        echo "│  Fix permanently (run once, needs admin UAC prompt):         │"
        echo "│  powershell -ExecutionPolicy Bypass -File \\                 │"
        echo "│    scripts/setup-defender-exclusions.ps1                     │"
        echo "└──────────────────────────────────────────────────────────────┘"
        echo ""
    else
        log "Defender exclusion: OK (binaries/ excluded)"
    fi
}

check_defender_exclusion

# ── Layer 2: Lock-polling wait ───────────────────────────────────────────────
# Uses [System.IO.File]::Open() with FileShare.Read to match what cargo needs
wait_for_sidecar_unlock() {
    if [ ! -f "$SIDECAR_BIN" ]; then
        log "Lock check: skipped (binary does not exist)"
        return 0
    fi

    local mtime now age
    mtime=$(stat -c %Y "$SIDECAR_BIN" 2>/dev/null || powershell.exe -NoProfile -Command "(Get-Item (Resolve-Path '${SIDECAR_BIN}' -ErrorAction SilentlyContinue).Path).LastWriteTimeUtc | Get-Date -UFormat '%s'" 2>/dev/null || echo 0)
    now=$(date +%s)
    age=$(( now - ${mtime%.*} ))

    if [ "$age" -gt 120 ]; then
        log "Lock check: skipped (binary is ${age}s old, likely already scanned)"
        return 0
    fi

    log_section "LOCK POLLING (binary is ${age}s old)"
    local max_wait=60
    local interval=2
    local waited=0
    local win_path
    win_path=$(powershell.exe -NoProfile -Command "(Resolve-Path '${SIDECAR_BIN}' -ErrorAction SilentlyContinue).Path" 2>/dev/null || echo "$SIDECAR_BIN")

    while [ $waited -lt $max_wait ]; do
        local result
        result=$(powershell.exe -NoProfile -Command "
            try {
                \$f = [System.IO.File]::Open(
                    '${win_path}',
                    [System.IO.FileMode]::Open,
                    [System.IO.FileAccess]::Read,
                    [System.IO.FileShare]::Read)
                \$f.Close(); \$f.Dispose()
                'UNLOCKED'
            } catch {
                'LOCKED: ' + \$_.Exception.GetType().Name + ': ' + \$_.Exception.Message
            }
        " 2>/dev/null || echo "PS_ERROR")

        if [ "$result" = "UNLOCKED" ]; then
            log "Lock poll: UNLOCKED after ${waited}s"
            echo "[tauri-dev] Sidecar binary unlocked after ${waited}s"
            return 0
        fi

        log "Lock poll: ${waited}s — $result"
        sleep $interval
        waited=$((waited + interval))
    done

    log "Lock poll: TIMEOUT after ${max_wait}s"
    echo "[tauri-dev] WARNING: Sidecar binary may still be locked after ${max_wait}s"
    return 1
}

wait_for_sidecar_unlock

# ── Layer 3: Retry loop ─────────────────────────────────────────────────────
MAX_RETRIES=5
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
    log_section "BUILD ATTEMPT $i/$MAX_RETRIES"
    echo "[tauri-dev] Attempt $i/$MAX_RETRIES"

    # Capture stderr separately to detect specific errors
    TMPLOG=$(mktemp)
    if npx tauri dev "$@" 2>&1 | tee -a "$LOG_FILE" | tee "$TMPLOG"; then
        log "App closed cleanly"
        echo "[tauri-dev] App closed cleanly"
        rm -f "$TMPLOG"
        exit 0
    else
        EXIT_CODE=$?
        # Classify the failure
        failure_type="unknown"
        if grep -qi "os error 32\|os error 5\|Access is denied\|PermissionDenied\|being used by another process" "$TMPLOG" 2>/dev/null; then
            failure_type="defender_lock"
        elif grep -qi "error\[E" "$TMPLOG" 2>/dev/null; then
            failure_type="compile_error"
        elif grep -qi "SIGTERM\|SIGINT\|SIGKILL" "$TMPLOG" 2>/dev/null; then
            failure_type="signal"
        fi

        log "Build failed: exit=$EXIT_CODE type=$failure_type"

        if [ "$failure_type" = "compile_error" ]; then
            echo "[tauri-dev] Compile error detected (not a Defender lock). Check the log."
            echo "[tauri-dev] Log: $LOG_FILE"
            rm -f "$TMPLOG"
            exit $EXIT_CODE
        fi

        rm -f "$TMPLOG"

        if [ $i -lt $MAX_RETRIES ]; then
            echo "[tauri-dev] Build failed ($failure_type). Retrying in ${RETRY_DELAY}s..."
            log "Waiting ${RETRY_DELAY}s before retry..."
            sleep $RETRY_DELAY

            # Re-check lock before retrying
            if [ "$failure_type" = "defender_lock" ]; then
                wait_for_sidecar_unlock
            fi
        fi
    fi
done

log "FAILED after $MAX_RETRIES attempts"
echo ""
echo "[tauri-dev] Failed after $MAX_RETRIES attempts."
echo "[tauri-dev] Log: $LOG_FILE"
echo "[tauri-dev] Fix permanently: run as admin:"
echo "  powershell -ExecutionPolicy Bypass -File scripts/setup-defender-exclusions.ps1"
exit 1
