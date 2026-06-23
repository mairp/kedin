#!/usr/bin/env bash
# Allowlisted reshare-with-commentary wrapper. Reshares the LinkedIn post at <url> to the user's feed,
# adding his thoughts (read from the outbox by default).
#   repost.sh <url>                 -> reshare <url> with commentary from workspace-kedin/outbox.md
#   repost.sh <url> FILE            -> reshare <url> with commentary from FILE
#   repost.sh --dry-run <url> [FILE]-> parse URL + build request, publish nothing
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTBOX="${KEDIN_OUTBOX:-$HERE/workspace/outbox.md}"

DRY=()
if [[ "${1:-}" == "--dry-run" ]]; then DRY+=("--dry-run"); shift; fi

URL="${1:-}"
[[ -n "$URL" ]] || { echo "[kedin] usage: repost.sh [--dry-run] <url> [commentary-file]" >&2; exit 1; }
FILE="${2:-$OUTBOX}"
[[ -f "$FILE" ]] || { echo "[kedin] no commentary at $FILE — write your thoughts there first" >&2; exit 1; }

exec node "$HERE/repost.js" "${DRY[@]}" "$URL" "$FILE"
