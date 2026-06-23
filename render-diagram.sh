#!/usr/bin/env bash
# Render a crisp, colored UML / architecture diagram from Mermaid source via mermaid-cli (mmdc) +
# the system Chromium. Unlike gen-image.js (diffusion — garbles text), labels come out perfectly
# legible, so this is the PREFERRED path for technical/structural diagrams.
#
# Source resolution (first match wins):
#   render-diagram.sh "<mermaid source>"     -> inline arg
#   render-diagram.sh -                       -> read mermaid from stdin
#   render-diagram.sh                         -> read $KEDIN_DIAGRAM_SRC (default outbox-diagram.mmd)
# Options: --out FILE   (default $KEDIN_OUTBOX_IMAGE = workspace-kedin/outbox-image.png)
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${KEDIN_OUTBOX_IMAGE:-$HERE/workspace/outbox-image.png}"
SRC_FILE="${KEDIN_DIAGRAM_SRC:-$HERE/workspace/outbox-diagram.mmd}"
THEME="${KEDIN_MERMAID_THEME:-default}"

if [[ "${1:-}" == "--out" ]]; then OUT="${2:?--out needs a path}"; shift 2; fi

TMP="$(mktemp --suffix=.mmd)"; RAW="$(mktemp --suffix=.mmd)"; trap 'rm -f "$TMP" "$RAW"' EXIT
if   [[ -n "${1:-}" && "$1" != "-" ]]; then printf '%s' "$1" > "$RAW"
elif [[ "${1:-}" == "-" ]];            then cat > "$RAW"
elif [[ -f "$SRC_FILE" ]];             then cp "$SRC_FILE" "$RAW"
else echo "[kedin] no Mermaid source — write it to $SRC_FILE (write tool) or pass it as an argument" >&2; exit 1; fi

# Auto-repair common LLM mistakes (unquoted labels, literal \n) before rendering.
node "$HERE/mmd-sanitize.js" < "$RAW" > "$TMP" 2>/dev/null || cp "$RAW" "$TMP"

# -s 2 = 2x scale (hi-res), -w 1600 = wide LinkedIn-header width, white background.
# Retry up to 3x: mmdc launches a fresh Chromium each run and occasionally flakes (launch/eval
# timeout) on input that is actually valid — a retry distinguishes a transient flake from a real
# syntax error, so we only fall back to diffusion when the source is genuinely unrenderable.
err=""
for attempt in 1 2 3; do
  if err="$(mmdc -i "$TMP" -o "$OUT" -p "$HERE/mermaid-puppeteer.json" -t "$THEME" -b white -s 2 -w 1600 2>&1)"; then
    echo "DIAGRAM"
    echo "file: $OUT"
    echo "bytes: $(stat -c %s "$OUT")"
    exit 0
  fi
  sleep 1
done
echo "[kedin] mermaid render failed after 3 attempts — fix the diagram syntax:" >&2
echo "$err" | tail -6 >&2
exit 1
