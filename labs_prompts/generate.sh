#!/usr/bin/env bash
# Generates the FLUX concept images for /labs (Logo + Presenter).
# Each line of prompts.tsv is: <experiment>/<id> <TAB> <aspect ratio> <TAB> <prompt>
# Usage (from anywhere): BFL_API_KEY=... bash labs_prompts/generate.sh [id-filter]
# Images land in room-viewer/src/labs/assets/<experiment>/<id>/, where the labs pages pick them up.
set -u
cd "$(dirname "$0")/.."
OUT=room-viewer/src/labs/assets
PARALLEL=6

gen() {
  local id=$1 aspect=$2 prompt=$3
  mkdir -p "$OUT/$id"
  if uv run flux_image.py "$prompt" --aspect-ratio "$aspect" --out "$OUT/$id" > "$OUT/$id/gen.log" 2>&1; then
    echo "ok   $id"
  else
    echo "FAIL $id (see $OUT/$id/gen.log)"
  fi
}

while IFS=$'\t' read -r id aspect prompt; do
  case "$id" in ''|'#'*) continue ;; esac
  [[ "$id" == *"${1:-}"* ]] || continue
  while [ "$(jobs -rp | wc -l)" -ge "$PARALLEL" ]; do sleep 1; done
  gen "$id" "$aspect" "$prompt" &
done < labs_prompts/prompts.tsv
wait
