#!/usr/bin/env bash
# kill-all.sh — Gracefully stop the Chat Overlay Widget and all associated processes
# Usage: bash scripts/kill-all.sh

echo "[kill-all] Stopping Chat Overlay Widget processes..."

# 1. Kill the Tauri app (chat-overlay-widget.exe or the dev Rust binary)
taskkill //F //IM "chat-overlay-widget.exe" 2>/dev/null && echo "[kill-all] Killed Tauri app" || true

# 2. Kill sidecar node processes spawned by Tauri (match by sidecar path or caxa)
#    During dev, the sidecar runs as a plain node process with sidecar/dist/server.js
#    Clean discovery file BEFORE killing — force-kill won't trigger Node exit handlers
DISCOVERY_FILE="$APPDATA/chat-overlay-widget/api.port"
if [ -f "$DISCOVERY_FILE" ]; then
  rm -f "$DISCOVERY_FILE"
  echo "[kill-all] Cleaned discovery file: $DISCOVERY_FILE"
fi
wmic process where "CommandLine like '%sidecar%dist%server%'" call terminate 2>/dev/null && echo "[kill-all] Killed sidecar process (wmic)" || true

# 2b. Kill sidecar.exe by image name (the caxa-bundled exe in target/debug/ or binaries/)
taskkill //F //IM "sidecar-x86_64-pc-windows-msvc.exe" 2>/dev/null && echo "[kill-all] Killed sidecar-x86_64 (taskkill)" || true
# Also kill the short name copy that tauri-build places in target/debug/
taskkill //F //IM "sidecar.exe" 2>/dev/null && echo "[kill-all] Killed sidecar.exe (taskkill)" || true

# 2c. Kill caxa-extracted node processes (node.exe running from Temp\caxa\apps\sidecar*)
wmic process where "Name='node.exe' and CommandLine like '%caxa%sidecar%'" call terminate 2>/dev/null && echo "[kill-all] Killed caxa-extracted sidecar node" || true

# 3. Kill orphan node-pty shell processes (powershell/cmd spawned by node-pty via ConPTY)
#    These are children of the sidecar — if sidecar dies uncleanly they become orphans
#    Only kill node.exe processes whose command line references our project's sidecar
wmic process where "Name='node.exe' and CommandLine like '%chat_overlay_widget%sidecar%'" call terminate 2>/dev/null && echo "[kill-all] Killed orphan sidecar nodes" || true

# 4. Kill the Vite dev server (port 1420)
#    During tauri dev, Vite runs on localhost:1420
lsof_pid=$(netstat -ano 2>/dev/null | grep ":1420 " | grep "LISTENING" | awk '{print $NF}' | head -1)
if [ -n "$lsof_pid" ] && [ "$lsof_pid" != "0" ]; then
  taskkill //F //PID "$lsof_pid" 2>/dev/null && echo "[kill-all] Killed Vite dev server (PID $lsof_pid)" || true
else
  echo "[kill-all] No Vite dev server found on :1420"
fi

# 5. Kill any cargo/rustc processes from tauri dev build
taskkill //F //IM "cargo.exe" 2>/dev/null && echo "[kill-all] Killed cargo" || true
taskkill //F //IM "rustc.exe" 2>/dev/null && echo "[kill-all] Killed rustc" || true

# 6. Clean up temp screenshot files from crashed sessions
TEMP_DIR="${TEMP:-$TMP}/chat-overlay-screenshots"
if [ -d "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
  echo "[kill-all] Cleaned temp screenshots: $TEMP_DIR"
else
  echo "[kill-all] No temp screenshots to clean"
fi

echo "[kill-all] Done. All Chat Overlay processes stopped."
