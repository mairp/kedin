#!/usr/bin/env bash
# Review-mode helper: generate a CANDIDATE image AND deliver it to the user on Telegram in ONE
# atomic, allowlisted step — so image delivery for review never depends on the LLM remembering to
# make a second call (it kept skipping send-image.sh, esp. under gemini 503 mid-stream errors).
# Autonomous mode does NOT use this (it uses gen-image.sh + post.sh --image to attach on LinkedIn).
#   draft-image.sh "<image prompt>" ["caption"]
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT="${1:?usage: draft-image.sh \"<image prompt>\" [caption]}"
CAPTION="${2:-Candidate image for your draft — reply /post to publish it with the post, or tell me what to change.}"

"$HERE/gen-image.sh" "$PROMPT"        # writes $KEDIN_OUTBOX_IMAGE
exec "$HERE/send-image.sh" "$CAPTION"  # delivers it to the user's Telegram
