#!/bin/bash
# The web surface's verification battery — the single source of truth for
# "is editor/ healthy". Run by hand, by the /preflight skill, by the verifier
# agent, and by the code doctor, so everyone measures the same thing.
#
# Exits non-zero if any step fails OR if the react-doctor score regresses below
# the recorded baseline. The score is a TREND metric: a build can pass while the
# codebase quietly gets worse, which is exactly what the baseline catches.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/editor" || exit 1

# Measured on 2026-07-19 against main@06fe56f. The code-doctor reported 49 on the
# same day against ad3222a, but react-doctor is invoked unpinned (@latest), so its
# scoring can move without a line of our code changing — the number is only
# comparable within a tool version. Treat this as a floor that catches OUR
# regressions, and re-baseline deliberately when the tool bumps.
BASELINE=46
OUT=/tmp/react-doctor.out
fail=0
step() { printf '%s %s — %s\n' "$1" "$2" "$3"; }

# A git worktree gets its own node_modules, and merging a branch that changed
# dependencies does NOT reinstall them. Running the battery against stale deps
# produces ERR_MODULE_NOT_FOUND stack traces that read like source bugs.
if [ ! -d node_modules ] || ! node -e 'require("./package.json").dependencies' >/dev/null 2>&1; then
  step FAIL deps "node_modules missing — run: npm ci"
  echo "VERDICT: FAIL"; exit 1
fi
missing=$(node -e '
  const d = Object.keys(require("./package.json").dependencies || {});
  const fs = require("fs");
  console.log(d.filter(p => !fs.existsSync("node_modules/" + p)).join(" "));
' 2>/dev/null)
if [ -n "$missing" ]; then
  step FAIL deps "stale node_modules, missing: $missing — run: npm ci"
  echo "VERDICT: FAIL"; exit 1
fi

if npm run build >/tmp/web-build.out 2>&1; then
  step PASS build "vite build clean"
else
  step FAIL build "see /tmp/web-build.out"; fail=1
fi

if npm run validate:catalog >/tmp/web-catalog.out 2>&1; then
  step PASS validate:catalog "$(grep -c '' /tmp/web-catalog.out) lines, validation passed"
else
  step FAIL validate:catalog "see /tmp/web-catalog.out"; fail=1
fi

# Playwright binds :5173. A dev server already holding that port makes every
# spec fail in a way that looks like a code regression — say so instead.
if lsof -ti :5173 >/dev/null 2>&1; then
  step FAIL playwright "port 5173 is already in use — stop the dev server first"
  fail=1
elif npx playwright test >/tmp/web-e2e.out 2>&1; then
  step PASS playwright "$(grep -oE '[0-9]+ passed' /tmp/web-e2e.out | tail -1)"
else
  step FAIL playwright "see /tmp/web-e2e.out"; fail=1
fi

npx react-doctor@latest . >"$OUT" 2>&1 || true
# The score is read from the share URL (`…?p=proj&s=46&w=138&f=27`) because that
# is the one machine-stable place it appears; the human-facing banner is boxed
# ANSI art whose layout changes between releases.
score=$(grep -oE '[?&]s=[0-9]+' "$OUT" | head -1 | grep -oE '[0-9]+')
if [ -z "${score:-}" ]; then
  step WARN react-doctor "could not parse a score from $OUT (tool output changed?)"
elif [ "$score" -lt "$BASELINE" ]; then
  step FAIL react-doctor "score $score < baseline $BASELINE — regression"; fail=1
else
  step PASS react-doctor "score $score (baseline $BASELINE, delta +$((score - BASELINE)))"
fi

# eslint is advisory for now: the config landed after ~151 findings already
# existed, so gating on it today would block every commit. Promote to a FAIL
# once the backlog is cleared.
if [ -f eslint.config.js ]; then
  if npx eslint src >/tmp/web-eslint.out 2>&1; then
    step PASS eslint "clean"
  else
    step WARN eslint "$(grep -cE '^\s+[0-9]+:[0-9]+' /tmp/web-eslint.out || echo '?') findings (advisory)"
  fi
fi

[ "$fail" -eq 0 ] && echo "VERDICT: PASS" || echo "VERDICT: FAIL"
exit "$fail"
