#!/usr/bin/env bash
# tauri-dev.sh — Reliable `tauri dev` launcher for Windows + Defender environments
#
# DEV MODE (default): Starts sidecar as `node dist/server.js` directly.
#   No caxa .exe → no Defender scan → no lock polling → instant startup.
#   Tauri reads SIDECAR_PORT env var and skips spawning the bundled binary.
#
# PROD MODE (--prod): Uses the caxa-bundled .exe (for testing production behavior).
#   Full Defender defense layers apply.
#
# Usage: bash scripts/tauri-dev.sh [--prod]

set -eo pipefail
# Note: -u (nounset) deliberately omitted. Windows env vars (NVM_SYMLINK, NVM_HOME,
# LOCALAPPDATA, APPDATA) are unreliable in non-interactive Git Bash sessions.
# All optional vars use ${VAR:-} pattern but -u still causes issues with
# some bash built-ins and third-party scripts sourced during PATH resolution.

# ── WSL guard ───────────────────────────────────────────────────────────────
# This script requires Git Bash (MSYS2), not WSL bash. WSL uses /mnt/c/ paths
# and lacks cygpath — every path in this script would be wrong.
if grep -q Microsoft /proc/version 2>/dev/null || grep -q WSL /proc/version 2>/dev/null; then
    echo ""
    echo "ERROR: This script was invoked under WSL bash, not Git Bash."
    echo "Run via start.bat (which resolves Git Bash) or invoke directly:"
    echo "  \"C:\\Program Files\\Git\\usr\\bin\\bash.exe\" scripts/tauri-dev.sh"
    echo ""
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/tauri-dev.log"

cd "$PROJECT_DIR"

# Parse args
USE_PROD_SIDECAR=false
if [[ "${1:-}" == "--prod" ]]; then
    USE_PROD_SIDECAR=true
    shift
fi

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

# ── PATH resolution ─────────────────────────────────────────────────────────
# Non-interactive bash from start.bat may not have node or cargo on PATH.
# Strategy: check if commands exist first, then search common locations.

# Cargo
export PATH="$HOME/.cargo/bin:$PATH"

# Node: check if already available, if not search common Windows locations
if ! command -v node >/dev/null 2>&1; then
    NODE_SEARCH_PATHS=()

    # Priority 1: nvm4w active version (resolve symlink target to bypass MSYS2
    # SYMLINKD stat flakiness AND nvm4w delete-recreate race)
    if [ -n "${NVM_SYMLINK:-}" ]; then
        nvm_symlink_unix="$(cygpath -u "$NVM_SYMLINK" 2>/dev/null || echo "")"
        # readlink resolves the symlink to the actual versioned dir
        nvm_active="$(readlink -f "$nvm_symlink_unix" 2>/dev/null || echo "")"
        [ -n "$nvm_active" ] && [ -d "$nvm_active" ] && NODE_SEARCH_PATHS+=("$nvm_active")
        # Also add the symlink itself as fallback
        NODE_SEARCH_PATHS+=("$nvm_symlink_unix")
    fi

    # Priority 2: nvm4w versioned dirs (if symlink is broken, find any installed version)
    if [ -n "${NVM_HOME:-}" ]; then
        nvm_home_unix="$(cygpath -u "$NVM_HOME" 2>/dev/null || echo "")"
        if [ -n "$nvm_home_unix" ] && [ -d "$nvm_home_unix" ]; then
            # Sort reverse so newest version is tried first
            for vdir in $(ls -d "$nvm_home_unix"/v*/ 2>/dev/null | sort -rV); do
                [ -d "$vdir" ] && NODE_SEARCH_PATHS+=("${vdir%/}")
            done
        fi
    fi

    # Priority 3: common static install locations
    NODE_SEARCH_PATHS+=(
        "/c/nvm4w/nodejs"
        "/c/Program Files/nodejs"
        "$HOME/AppData/Local/Programs/nodejs"
    )

    # Use [ -f node.exe ] not [ -x node ] — MSYS2 -x test is unreliable on
    # Windows SYMLINKD in non-interactive mode (winsymlinks:deepcopy default)
    for np in "${NODE_SEARCH_PATHS[@]}"; do
        if [ -n "$np" ] && [ -f "$np/node.exe" ]; then
            export PATH="$np:$PATH"
            log "Found node at: $np"
            break
        fi
    done
fi

# Last resort: ask Windows where node is (works even when bash PATH is broken)
if ! command -v node >/dev/null 2>&1; then
    win_node=$(cmd.exe //c "where node.exe" 2>/dev/null | head -1 | tr -d '\r')
    if [ -n "$win_node" ]; then
        node_dir="$(cygpath -u "$(dirname "$win_node")" 2>/dev/null || echo "")"
        if [ -n "$node_dir" ]; then
            export PATH="$node_dir:$PATH"
            log "Found node via Windows PATH: $node_dir"
        fi
    fi
fi

# Validate node exists — fail fast with clear message
if ! command -v node >/dev/null 2>&1; then
    log "FATAL: node not found on PATH"
    echo ""
    echo "┌──────────────────────────────────────────────────────────────┐"
    echo "│  ERROR: node not found                                       │"
    echo "│                                                              │"
    echo "│  The sidecar requires Node.js. Ensure node is installed     │"
    echo "│  and on your PATH, or set NVM_SYMLINK / NVM_HOME.          │"
    echo "│                                                              │"
    echo "│  node --version should work in Git Bash.                    │"
    echo "└──────────────────────────────────────────────────────────────┘"
    echo ""
    exit 1
fi

log "node: $(command -v node) ($(node --version 2>/dev/null || echo 'unknown'))"

export CARGO_INCREMENTAL=0
export RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-C codegen-units=1"

SIDECAR_BIN="$PROJECT_DIR/src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe"
SIDECAR_NODE_PID=""

# ── APPDATA resolution ──────────────────────────────────────────────────────
# $APPDATA may be a Windows path (C:\Users\...) or unset in some bash contexts.
resolve_appdata() {
    if [ -n "${APPDATA:-}" ]; then
        if command -v cygpath >/dev/null 2>&1; then
            cygpath -u "$APPDATA"
        else
            echo "$APPDATA"
        fi
    else
        echo "$HOME/AppData/Roaming"
    fi
}
APPDATA_UNIX="$(resolve_appdata)"
DISCOVERY_DIR="$APPDATA_UNIX/chat-overlay-widget"
DISCOVERY_FILE="$DISCOVERY_DIR/api.port"

# ── Cleanup on exit ────────────────────────────────────────────────────────
cleanup() {
    if [ -n "$SIDECAR_NODE_PID" ]; then
        log "Cleaning up dev sidecar (PID: $SIDECAR_NODE_PID)"
        kill "$SIDECAR_NODE_PID" 2>/dev/null || true
        taskkill //T //F //PID "$SIDECAR_NODE_PID" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# ── Layer 0: Diagnostics ────────────────────────────────────────────────────
diagnose_environment() {
    log_section "DIAGNOSTICS"

    if [ "$USE_PROD_SIDECAR" = true ]; then
        log "Mode: PRODUCTION (caxa .exe)"
        if [ -f "$SIDECAR_BIN" ]; then
            local size age
            size=$(wc -c < "$SIDECAR_BIN" 2>/dev/null || echo "unknown")
            local mtime now
            mtime=$(stat -c %Y "$SIDECAR_BIN" 2>/dev/null || echo 0)
            now=$(date +%s)
            age=$(( now - ${mtime%.*} ))
            log "Sidecar binary: exists, ${size} bytes, ${age}s old"
        else
            log "Sidecar binary: MISSING at $SIDECAR_BIN"
        fi
    else
        log "Mode: DEV (node direct)"
        if [ -f "$PROJECT_DIR/sidecar/dist/server.js" ]; then
            log "Sidecar dist/server.js: exists"
        else
            log "Sidecar dist/server.js: MISSING — will compile"
        fi
    fi

    # Defender status (quick check)
    local rt_status
    rt_status=$(powershell.exe -NoProfile -Command "
        try {
            \$mp = Get-MpComputerStatus -ErrorAction Stop
            'RealTimeProtection=' + \$mp.RealTimeProtectionEnabled.ToString() + ' AntivirusEnabled=' + \$mp.AntivirusEnabled.ToString()
        } catch { 'QUERY_FAILED: ' + \$_.Exception.Message }
    " 2>/dev/null || echo "PS_ERROR")
    log "Defender status: $rt_status"

    # Check for stale sidecar processes
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
}

diagnose_environment

# ── Kill stale sidecar processes ───────────────────────────────────────────
kill_stale_sidecars() {
    local killed=0
    if taskkill //F //IM "sidecar.exe" >/dev/null 2>&1; then
        log "Killed stale sidecar.exe"
        killed=1
    fi
    if taskkill //F //IM "sidecar-x86_64-pc-windows-msvc.exe" >/dev/null 2>&1; then
        log "Killed stale sidecar-x86_64-pc-windows-msvc.exe"
        killed=1
    fi
    wmic process where "Name='node.exe' and CommandLine like '%caxa%sidecar%'" call terminate >/dev/null 2>&1 && {
        log "Killed caxa-extracted sidecar node"
        killed=1
    }
    if [ "$killed" -eq 1 ]; then
        echo "[tauri-dev] Killed stale sidecar processes from previous session"
        sleep 1
    fi
}

kill_stale_sidecars

# ══════════════════════════════════════════════════════════════════════════════
# DEV MODE: Start sidecar as `node dist/server.js` directly
# ══════════════════════════════════════════════════════════════════════════════
if [ "$USE_PROD_SIDECAR" = false ]; then

    # Ensure dist/ is compiled
    if [ ! -f "$PROJECT_DIR/sidecar/dist/server.js" ]; then
        log "Compiling sidecar TypeScript..."
        echo "[tauri-dev] Compiling sidecar (npm run build)..."
        (cd "$PROJECT_DIR/sidecar" && npm run build) 2>&1 | tee -a "$LOG_FILE"
    fi

    # Clean stale discovery file
    rm -f "$DISCOVERY_FILE" 2>/dev/null || true

    # Start sidecar as background node process (from sidecar/ dir for correct relative paths)
    log "Starting dev sidecar (node dist/server.js)..."
    (cd "$PROJECT_DIR/sidecar" && node dist/server.js) &
    SIDECAR_NODE_PID=$!
    log "Dev sidecar started: PID=$SIDECAR_NODE_PID"

    # Wait for discovery file — sidecar writes it on successful startup
    max_wait=15
    waited=0
    dev_port=""
    while [ "$waited" -lt "$max_wait" ]; do
        if [ -f "$DISCOVERY_FILE" ]; then
            # Parse port: try grep (no dependencies), fall back to node
            dev_port=$(grep -oP '"port":\s*\K[0-9]+' "$DISCOVERY_FILE" 2>/dev/null \
                    || node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).port)" "$DISCOVERY_FILE" 2>/dev/null \
                    || echo "")
            if [ -n "$dev_port" ] && [ "$dev_port" != "undefined" ]; then
                break
            fi
        fi
        sleep 0.5
        waited=$((waited + 1))
    done

    if [ -z "$dev_port" ] || [ "$dev_port" = "undefined" ]; then
        log "ERROR: Dev sidecar did not write discovery file within ${max_wait}s"
        log "Discovery file: $DISCOVERY_FILE (exists: $([ -f "$DISCOVERY_FILE" ] && echo 'yes' || echo 'no'))"
        log "APPDATA_UNIX: $APPDATA_UNIX"
        # Check if the process is still alive
        if kill -0 "$SIDECAR_NODE_PID" 2>/dev/null; then
            log "Sidecar process $SIDECAR_NODE_PID is still running"
        else
            log "Sidecar process $SIDECAR_NODE_PID has exited"
        fi
        echo "[tauri-dev] ERROR: Sidecar failed to start. Check sidecar/dist/server.js"
        exit 1
    fi

    log "Dev sidecar ready on port $dev_port"
    echo "[tauri-dev] Dev sidecar on port $dev_port (node direct — no caxa)"
    export SIDECAR_PORT="$dev_port"

    # Launch Tauri (reads SIDECAR_PORT env var, skips spawning .exe)
    log_section "LAUNCHING TAURI (dev sidecar on port $dev_port)"
    npx tauri dev "$@" 2>&1 | tee -a "$LOG_FILE"
    exit ${PIPESTATUS[0]}
fi

# ══════════════════════════════════════════════════════════════════════════════
# PROD MODE: Full Defender defense layers (caxa .exe path)
# ══════════════════════════════════════════════════════════════════════════════

# ── Defender exclusion nudge ────────────────────────────────────────────────
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

# ── Lock-polling wait ───────────────────────────────────────────────────────
wait_for_sidecar_unlock() {
    if [ ! -f "$SIDECAR_BIN" ]; then
        log "Lock check: skipped (binary does not exist)"
        return 0
    fi

    local mtime now age
    mtime=$(stat -c %Y "$SIDECAR_BIN" 2>/dev/null || echo 0)
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

# ── Retry loop ─────────────────────────────────────────────────────────────
MAX_RETRIES=5
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
    log_section "BUILD ATTEMPT $i/$MAX_RETRIES"
    echo "[tauri-dev] Attempt $i/$MAX_RETRIES"

    TMPLOG=$(mktemp)
    if npx tauri dev "$@" 2>&1 | tee -a "$LOG_FILE" | tee "$TMPLOG"; then
        log "App closed cleanly"
        echo "[tauri-dev] App closed cleanly"
        rm -f "$TMPLOG"
        exit 0
    else
        EXIT_CODE=$?
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
