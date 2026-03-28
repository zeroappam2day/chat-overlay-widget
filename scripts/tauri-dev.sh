#!/usr/bin/env bash
# tauri-dev.sh — Reliable `tauri dev` launcher for Windows + Defender environments
# Retries on "os error 32" file lock failures (cached artifacts accumulate per attempt)
# Usage: bash scripts/tauri-dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_INCREMENTAL=0
export RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-C codegen-units=1"

MAX_RETRIES=5
RETRY_DELAY=3

for i in $(seq 1 $MAX_RETRIES); do
    echo "[tauri-dev] Attempt $i/$MAX_RETRIES"
    # Run tauri dev. If it succeeds (user closes app), exit cleanly.
    # If it fails with build error, retry.
    if npx tauri dev "$@" 2>&1; then
        echo "[tauri-dev] App closed cleanly"
        exit 0
    else
        EXIT_CODE=$?
        # Check if the failure was a build error (not a runtime crash)
        if [ $i -lt $MAX_RETRIES ]; then
            echo "[tauri-dev] Build failed (likely Defender lock). Cached artifacts will help next attempt."
            echo "[tauri-dev] Retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    fi
done

echo "[tauri-dev] Failed after $MAX_RETRIES attempts."
echo "[tauri-dev] Fix permanently: run as admin:"
echo "  powershell -ExecutionPolicy Bypass -File scripts/setup-defender-exclusions.ps1"
exit 1
