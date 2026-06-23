#!/usr/bin/env bash
# Allowlisted poster the Kedin agent runs AFTER the user approves a draft.
# Reads the approved post from the agent's workspace outbox and publishes it.
#   post.sh                       -> publish workspace-kedin/outbox.md (text-only)
#   post.sh --dry-run             -> build + print the request, publish nothing
#   post.sh --image [--alt TEXT]  -> attach the approved outbox image ($KEDIN_OUTBOX_IMAGE)
#   post.sh --image FILE          -> attach a specific image file
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTBOX="${KEDIN_OUTBOX:-$HERE/workspace/outbox.md}"
OUTBOX_IMAGE="${KEDIN_OUTBOX_IMAGE:-$HERE/workspace/outbox-image.png}"

[[ -f "$OUTBOX" ]] || { echo "[kedin] no draft at $OUTBOX — write the approved post there first" >&2; exit 1; }

# Translate post.sh flags into post.js args. --image with no path defaults to the outbox image.
PASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) PASS+=("--dry-run"); shift ;;
    --alt) PASS+=("--alt" "${2:-}"); shift 2 ;;
    --image)
      if [[ -n "${2:-}" && "$2" != --* ]]; then PASS+=("--image" "$2"); shift 2;
      else PASS+=("--image" "$OUTBOX_IMAGE"); shift; fi ;;
    *) echo "[kedin] unknown arg: $1" >&2; exit 1 ;;
  esac
done

exec node "$HERE/post.js" "${PASS[@]}" "$OUTBOX"
