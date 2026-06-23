#!/usr/bin/env bash
# Allowlisted delete wrapper. Deletes a published LinkedIn post.
#   delete.sh                 -> delete the most recent post (from last-post.json)
#   delete.sh previous | -1   -> same (delete the last post)
#   delete.sh <urn:li:...>    -> delete a specific post by URN
# NOTE: deletion is permanent and cannot be undone.
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAST="${KEDIN_LAST_POST:-$HERE/workspace/last-post.json}"

arg="${1:-previous}"
case "$arg" in
  previous|-1|last|"")
    URN="$(node -e 'try{process.stdout.write((require(process.argv[1]).urn)||"")}catch(e){}' "$LAST")"
    [[ -n "$URN" ]] || { echo "[kedin] no recorded last post in $LAST — nothing to delete (use delete.sh <urn>)" >&2; exit 1; } ;;
  urn:li:*) URN="$arg" ;;
  *) echo "[kedin] usage: delete.sh [previous|-1|<urn:li:...>]" >&2; exit 1 ;;
esac

node "$HERE/delete.js" "$URN"
# If we deleted the recorded last post, clear the record so /delete previous won't double-fire.
if [[ "$arg" != "urn:li:"* ]]; then rm -f "$LAST"; fi
