#!/bin/bash
# PostToolUse[Edit|Write] — reminds that a contracts/ change needs a CHANGELOG
# entry in the SAME commit (CLAUDE.md rule 2).
#
# Non-blocking on purpose: the edit is usually correct, it is the follow-through
# that gets forgotten, and the other surface only learns about a contract change
# by reading that changelog on its next merge.
set -uo pipefail

payload=$(cat)
fp=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$fp" ] && exit 0

case "$fp" in
  */contracts/CHANGELOG.md) ;;              # the entry itself — nothing to say
  */contracts/*)
    echo "Reminder: contracts/ changed. Add a contracts/CHANGELOG.md entry in the SAME commit (CLAUDE.md rule 2) stating what changed and what the OTHER surface must do."
    ;;
esac
exit 0
