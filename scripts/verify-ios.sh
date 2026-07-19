#!/bin/bash
# The iOS surface's verification battery — the single source of truth for
# "is ios/ healthy", and the mechanism behind the owner's decision on issue #18
# (local ritual instead of a macOS CI runner). The /preflight skill runs this
# before any ios/** work merges to main.
#
# Note on `grep -c`: it exits 1 when the count is zero, so every count is
# wrapped to keep a clean build from looking like a failed command.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/ios" || exit 1

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-beta.app/Contents/Developer}"
OUT=/tmp/xcodebuild.out
fail=0
step() { printf '%s %s — %s\n' "$1" "$2" "$3"; }

# project.yml is the source of truth; the .xcodeproj is generated output, so a
# file added without regenerating simply would not exist to the compiler.
if xcodegen generate >/tmp/xcodegen.out 2>&1; then
  step PASS xcodegen "project regenerated"
else
  step FAIL xcodegen "see /tmp/xcodegen.out"
  echo "VERDICT: FAIL"; exit 1
fi

xcodebuild -project InternshipPortal.xcodeproj -scheme InternshipPortal \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  -derivedDataPath /tmp/claude-501/dd build >"$OUT" 2>&1
build_rc=$?

errs=$(grep -cE '(^|\s)error:' "$OUT" || true)
warns=$(grep -cE '(^|\s)warning:' "$OUT" || true)
errs=${errs:-0}; warns=${warns:-0}

if [ "$build_rc" -eq 0 ] && [ "$errs" -eq 0 ]; then
  step PASS xcodebuild "0 errors · $warns warnings"
else
  step FAIL xcodebuild "$errs errors · $warns warnings — see $OUT"; fail=1
fi
[ "$warns" -gt 0 ] && grep -E '(^|\s)warning:' "$OUT" | head -10

if command -v swiftlint >/dev/null 2>&1; then
  if swiftlint --strict >/tmp/swiftlint.out 2>&1; then
    step PASS swiftlint "clean"
  else
    step FAIL swiftlint "$(grep -cE ':\s+(warning|error):' /tmp/swiftlint.out || echo '?') violations — see /tmp/swiftlint.out"
    fail=1
  fi
else
  step SKIP swiftlint "not installed (brew install swiftlint)"
fi

[ "$fail" -eq 0 ] && echo "VERDICT: PASS" || echo "VERDICT: FAIL"
exit "$fail"
