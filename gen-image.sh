#!/usr/bin/env bash
# Allowlisted image generator the Kedin agent runs to propose a CANDIDATE image for a post.
# Produces an image from a text prompt; Kedin then shows it to the user for approval.
# Nothing is published here — only /post (post.sh --image) attaches an approved image.
#   gen-image.sh "<prompt>"   -> writes $KEDIN_OUTBOX_IMAGE, prints its path
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${KEDIN_OUTBOX_IMAGE:-$HERE/workspace/outbox-image.png}"

if [[ $# -eq 0 ]]; then
  echo "[kedin] usage: gen-image.sh \"<image prompt>\"" >&2
  exit 1
fi
exec node "$HERE/gen-image.js" --out "$OUT" "$@"
