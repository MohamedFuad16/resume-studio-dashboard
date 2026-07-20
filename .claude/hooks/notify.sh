#!/bin/bash
# Stop / Notification — iMessages you a short, human summary of what just landed.
#
# The handle lives in $CLAUDE_NOTIFY_IMESSAGE, set in .claude/settings.local.json
# (personal, never committed). Unset means silence: that is how the second device
# and the code-doctor account run this same repo without messaging anyone.
#
# WHY IT READS THE TRANSCRIPT: "finished — ready for you" tells you nothing you
# did not already know from your phone buzzing. The last assistant message is
# already a written-for-you summary, so the useful notification is its opening,
# cleaned of markdown. No model call, no extra cost, no latency — just a read of
# a file the harness already wrote.
#
# Always exits 0 — a notification failure must never affect the session.
set -uo pipefail

[ -z "${CLAUDE_NOTIFY_IMESSAGE:-}" ] && exit 0
command -v osascript >/dev/null 2>&1 || exit 0

kind="${1:-stop}"
project=$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")

# The hook payload arrives on stdin and carries transcript_path. Read it with a
# timeout: if nothing is piped in (a manual test run), do not hang forever.
payload=$(timeout 2 cat 2>/dev/null || true)
transcript=$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null)

summary=""
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  # Last assistant turn's text, markdown stripped down to something that reads
  # like a person wrote it in a chat bubble.
  # The LAST text block of the last assistant turn. Slurping and taking `last`
  # matters: byte-truncating the concatenated stream splits a sentence and sends
  # you a fragment starting mid-clause.
  summary=$(jq -rs '
      [ .[]
        | select(.type == "assistant")
        | .message.content[]?
        | select(.type == "text")
        | .text
      ] | last // empty
    ' "$transcript" 2>/dev/null | awk '
      # Drop headings, table rows, code fences and list bullets — they read as
      # noise in a text message.
      /^```/      { infence = !infence; next }
      infence     { next }
      /^[[:space:]]*[|#>]/ { next }
      /^[[:space:]]*[-*][[:space:]]/ { next }
      /^[[:space:]]*$/ { next }
      { print }
    ' | head -3 | tr '\n' ' ' \
      | sed -E 's/\*\*([^*]*)\*\*/\1/g; s/`([^`]*)`/\1/g; s/\[([^]]*)\]\([^)]*\)/\1/g; s/  +/ /g')
  # A single long paragraph is worse than two sentences. Keep it short enough to
  # read on a lock screen without expanding the notification.
  summary=$(printf '%s' "$summary" | cut -c1-260)
  case "$summary" in *[!\ ]*) ;; *) summary="" ;; esac
fi

# Pick the emoji from what actually happened, not from the hook kind — a stop
# that reports a failure should not look like a celebration.
lower=$(printf '%s' "$summary" | tr '[:upper:]' '[:lower:]')
case "$lower" in
  *fail*|*error*|*broke*|*blocked*|*cannot*|*could\ not*) icon="⚠️" ;;
  *deploy*|*shipped*|*live*)                              icon="🚀" ;;
  *fix*|*repair*)                                         icon="🔧" ;;
  *commit*|*merged*|*landed*)                             icon="✅" ;;
  *)                                                      icon="💬" ;;
esac

if [ "$kind" = "attention" ]; then
  icon="🙋"
  [ -z "$summary" ] && summary="I need your input to keep going."
elif [ -z "$summary" ]; then
  summary="Finished this round — take a look when you get a sec."
fi

message="${icon} ${project} — ${summary}"

osascript <<APPLESCRIPT >/dev/null 2>&1 || true
on run
  tell application "Messages"
    set svc to 1st service whose service type = iMessage
    send "${message//\"/\\\"}" to buddy "${CLAUDE_NOTIFY_IMESSAGE}" of svc
  end tell
end run
APPLESCRIPT
exit 0
