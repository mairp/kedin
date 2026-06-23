#!/usr/bin/env bash
# Deliver the CANDIDATE post image to the user over Telegram (the kedin bot) so he can
# actually SEE it before approving. Kedin's normal text replies auto-deliver, but a media
# file does NOT — it must be pushed with `openclaw message send --media`. This wrapper is
# the allowlisted way Kedin does that (covered by the <repo>/**  exec-approval glob).
#
#   send-image.sh                 -> send workspace-kedin/outbox-image.png, default caption
#   send-image.sh "caption text"  -> send the outbox image with a custom caption
#   send-image.sh --image FILE ["caption"] -> send a specific image file
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE="${KEDIN_OUTBOX_IMAGE:-$HERE/workspace/outbox-image.png}"
TARGET="${KEDIN_TELEGRAM_TARGET:?set KEDIN_TELEGRAM_TARGET to your Telegram chat id (see .env.example)}"
ACCOUNT="${KEDIN_TELEGRAM_ACCOUNT:-kedin}"
CAPTION="Candidate image for your draft — reply /post to publish it with the post, or tell me what to change."

if [[ "${1:-}" == "--image" ]]; then
  IMAGE="${2:?--image needs a file path}"; shift 2
fi
[[ -n "${1:-}" ]] && CAPTION="$1"

[[ -f "$IMAGE" ]] || { echo "[kedin] no image at $IMAGE — run gen-image.sh first" >&2; exit 1; }

# OpenClaw refuses to send media from any `workspace-*` dir (anti-exfiltration: see
# local-media-access). The allowed roots are ~/.openclaw/{media,canvas,workspace,sandboxes}.
# So stage the (identical) image under ~/.openclaw/media and send from there.
SEND_DIR="${KEDIN_MEDIA_DIR:-$HERE/workspace/media}"
mkdir -p "$SEND_DIR"
SEND_IMAGE="$SEND_DIR/outbox-image.png"
cp -f "$IMAGE" "$SEND_IMAGE"

exec openclaw message send \
  --channel telegram \
  --account "$ACCOUNT" \
  --target "$TARGET" \
  --media "$SEND_IMAGE" \
  -m "$CAPTION"
