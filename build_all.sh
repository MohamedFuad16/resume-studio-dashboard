#!/bin/bash
# Batch compile all 8 resume PDFs with Tectonic

TECTONIC=/opt/homebrew/bin/tectonic
OUT=/Users/mfuad16/Documents/Resume/output
EN=/Users/mfuad16/Documents/Resume/en
JA=/Users/mfuad16/Documents/Resume/ja

mkdir -p "$OUT"

PASS=0
FAIL=0

compile() {
  local src="$1"
  local outname="$2"
  local label="$3"
  local tmpdir=$(mktemp -d)
  
  echo "▶ $label"
  "$TECTONIC" "$src" --outdir "$tmpdir" 2>&1 | grep -E "Writing|error:|Error" | head -5
  
  local base=$(basename "$src" .tex)
  if [ -f "$tmpdir/$base.pdf" ] && [ -s "$tmpdir/$base.pdf" ]; then
    cp "$tmpdir/$base.pdf" "$OUT/$outname.pdf"
    local size=$(du -h "$OUT/$outname.pdf" | cut -f1)
    echo "  ✓ OK ($size) → $outname.pdf"
    PASS=$((PASS+1))
  else
    echo "  ✗ FAILED"
    FAIL=$((FAIL+1))
  fi
  rm -rf "$tmpdir"
}

echo ""
echo "=== English Resumes ==="
compile "$EN/01_jakes_clean.tex"   "en_01_jakes_clean"   "EN 01: Jake's Clean"
compile "$EN/02_awesome_cv.tex"    "en_02_awesome_cv"    "EN 02: Awesome CV"
compile "$EN/03_alta_classic.tex"  "en_03_alta_classic"  "EN 03: Alta Classic"
compile "$EN/04_slate_modern.tex"  "en_04_slate_modern"  "EN 04: Slate Modern"

echo ""
echo "=== Japanese Resumes ==="
compile "$JA/01_shokumu_modern.tex"  "ja_01_shokumu_modern"  "JA 01: 学校指定 履歴書"
compile "$JA/02_rirekisho_grid.tex"  "ja_02_rirekisho_grid"  "JA 02: 厚生労働省推奨 履歴書"
compile "$JA/03_deedy_jp.tex"        "ja_03_deedy_jp"        "JA 03: 新卒・インターン 職務経歴書"

echo ""
echo "======================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "======================================="
ls -lh "$OUT"/*.pdf 2>/dev/null
