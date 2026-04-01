#!/usr/bin/env bash
# Claude Code hook script -- forwards stdin JSON to Chat Overlay Widget sidecar.
# Usage in ~/.claude/settings.json hooks:
#   "command": "bash C:/path/to/scripts/hook-event.sh"
#
# Reads discovery file for port/token. Silently exits if sidecar is not running.
DISCOVERY="$APPDATA/chat-overlay-widget/api.port"
[ -f "$DISCOVERY" ] || exit 0
PORT=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['port'])" "$DISCOVERY" 2>/dev/null)
TOKEN=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['token'])" "$DISCOVERY" 2>/dev/null)
[ -z "$PORT" ] && exit 0
BODY=$(cat)
[ -z "$BODY" ] && exit 0
curl -s -X POST "http://127.0.0.1:$PORT/hook-event" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$BODY" \
  --max-time 1 > /dev/null 2>&1 || true
exit 0
