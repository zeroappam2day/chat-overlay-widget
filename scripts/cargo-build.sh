#!/usr/bin/env bash
# cargo-build.sh — Reliable cargo build wrapper for Windows + Defender environments
# Retries on "os error 32" file lock failures (cached artifacts accumulate per attempt)
# Usage: bash scripts/cargo-build.sh [cargo-args...]
# Example: bash scripts/cargo-build.sh build --manifest-path src-tauri/Cargo.toml

set -euo pipefail

MAX_RETRIES=5
RETRY_DELAY=3

export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_INCREMENTAL=0
export RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-C codegen-units=1"

ARGS="${@:-build --manifest-path src-tauri/Cargo.toml}"

for i in $(seq 1 $MAX_RETRIES); do
    echo "[cargo-build] Attempt $i/$MAX_RETRIES"
    if cargo $ARGS 2>&1; then
        echo "[cargo-build] Success on attempt $i"
        exit 0
    else
        if [ $i -lt $MAX_RETRIES ]; then
            echo "[cargo-build] Failed (likely Defender lock). Retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    fi
done

echo "[cargo-build] Failed after $MAX_RETRIES attempts."
echo "[cargo-build] Run 'powershell -ExecutionPolicy Bypass -File scripts/setup-defender-exclusions.ps1' as admin to fix permanently."
exit 1
