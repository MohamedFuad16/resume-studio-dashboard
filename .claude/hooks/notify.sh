#!/bin/bash
# Stop / Notification — sends an iMessage when a session finishes or needs input.
#
# The handle lives in $CLAUDE_NOTIFY_IMESSAGE, set in .claude/settings.local.json
# (personal, never committed). Unset means silence: that is how the second device
# and the code-doctor account run this same repo without messaging anyone.
#
# Always exits 0 — a notification failure must never affect the session.
set -uo pipefail

[ -z "${CLAUDE_NOTIFY_IMESSAGE:-}" ] && exit 0
command -v osascript >/dev/null 2>&1 || exit 0

kind="${1:-stop}"
project=$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")
case "$kind" in
  stop)      body="finished — ready for you." ;;
  attention) body="needs your input." ;;
  *)         body="$kind" ;;
esac

osascript <<APPLESCRIPT >/dev/null 2>&1 || true
on run
  tell application "Messages"
    set svc to 1st service whose service type = iMessage
    send "Claude Code · ${project}: ${body}" to buddy "${CLAUDE_NOTIFY_IMESSAGE}" of svc
  end tell
end run
APPLESCRIPT
exit 0
