#!/usr/bin/env bash
# Allowlisted live-edit wrapper. Updates the TEXT of an already-published post.
#   editpost.sh                      -> edit the last post using the outbox text
#   editpost.sh previous | -1        -> same
#   editpost.sh <urn:li:...>         -> edit a specific post using the outbox text
#   editpost.sh [target] FILE        -> use FILE as the new text instead of the outbox
#   editpost.sh --dry-run [target] [FILE]
# Write the corrected post text to the outbox first; this pushes it to the live post.
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTBOX="${KEDIN_OUTBOX:-$HERE/workspace/outbox.md}"
LAST="${KEDIN_LAST_POST:-$HERE/workspace/last-post.json}"

DRY=()
if [[ "${1:-}" == "--dry-run" ]]; then DRY+=("--dry-run"); shift; fi

TARGET="${1:-previous}"
case "$TARGET" in
  previous|-1|last|"")
    URN="$(node -e 'try{process.stdout.write((require(process.argv[1]).urn)||"")}catch(e){}' "$LAST")"
    [[ -n "$URN" ]] || { echo "[kedin] no recorded last post in $LAST — pass an explicit <urn>" >&2; exit 1; }
    shift || true ;;
  urn:li:*) URN="$TARGET"; shift ;;
  *) URN=""; ;;  # first arg was actually a FILE; resolve previous below
esac
if [[ -z "${URN:-}" ]]; then
  URN="$(node -e 'try{process.stdout.write((require(process.argv[1]).urn)||"")}catch(e){}' "$LAST")"
  [[ -n "$URN" ]] || { echo "[kedin] no recorded last post in $LAST — pass an explicit <urn>" >&2; exit 1; }
fi

FILE="${1:-$OUTBOX}"
[[ -f "$FILE" ]] || { echo "[kedin] no new text at $FILE — write the corrected post there first" >&2; exit 1; }

exec node "$HERE/editpost.js" "${DRY[@]}" "$URN" "$FILE"
