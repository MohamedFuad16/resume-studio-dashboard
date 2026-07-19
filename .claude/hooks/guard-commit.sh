#!/bin/bash
# PreToolUse[Bash] — blocks commits and PRs that carry AI attribution.
#
# This repo's history is written in a human voice: Conventional subjects, a body
# that explains why, and no machine signature. Agents default to appending
# "Co-Authored-By: Claude" and "Generated with Claude Code", so the rule needs a
# gate rather than a note in a doc.
#
# Exit 2 blocks the tool call and feeds stderr back to the model, which then
# rewrites the message itself.
#
# Known limitation: only inline `-m` messages are inspected. `git commit -F file`
# or an editor-based commit bypasses this — the /commit skill deliberately keeps
# messages inline so the gate stays meaningful.
set -uo pipefail

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Fail SAFE, not open: if jq can't parse the payload (malformed input, a schema
# change), fall back to scanning the raw text. A guard that silently allows
# everything the moment its parser trips is worse than no guard, because it
# still looks installed.
[ -z "$cmd" ] && cmd="$payload"

case "$cmd" in
  *"git commit"*|*"gh pr create"*|*"gh pr edit"*) ;;
  *) exit 0 ;;
esac

if printf '%s' "$cmd" | grep -qiE 'Co-Authored-By:[[:space:]]*Claude|Generated with .{0,3}Claude Code|🤖'; then
  cat >&2 <<'MSG'
BLOCKED: this repo does not put AI attribution in commits or pull requests.

Remove the "Co-Authored-By: Claude ..." trailer, any "Generated with Claude Code"
line, and the robot emoji, then run the command again. Message style: Conventional
subject (type(scope): imperative, <=72 chars), blank line, body explaining WHY.
See the /commit skill.
MSG
  exit 2
fi
exit 0
