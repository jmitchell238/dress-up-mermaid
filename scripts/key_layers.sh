#!/usr/bin/env bash
# Chroma-key magenta (#FF00FF) → transparent PNG for dress-up layers.
# Usage: scripts/key_layers.sh [input_dir] [output_dir]
# Defaults: .art-raw → art/layers (mirrors structure)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IN="${1:-$ROOT/.art-raw}"
OUT="${2:-$ROOT/art/layers}"
FUZZ="${FUZZ:-12%}"

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick 'convert' required" >&2
  exit 1
fi

if [[ ! -d "$IN" ]]; then
  echo "Input dir not found: $IN" >&2
  exit 1
fi

count=0
while IFS= read -r -d '' f; do
  rel="${f#$IN/}"
  dest="$OUT/$rel"
  dest="${dest%.*}.png"
  mkdir -p "$(dirname "$dest")"
  # Flatten to remove alpha weirdness, then key magenta
  convert "$f" -alpha off -fuzz "$FUZZ" -transparent '#FF00FF' -strip "$dest"
  echo "  ✓ $rel → ${dest#$ROOT/}"
  count=$((count + 1))
done < <(find "$IN" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -print0)

echo "Keyed $count file(s) into $OUT"
