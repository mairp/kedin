#!/usr/bin/env bash
# Review-mode: render a crisp Mermaid UML/architecture diagram AND deliver it to the user on Telegram
# in ONE atomic, allowlisted step (mirrors draft-image.sh, but uses the real diagram renderer instead
# of the diffusion image model). The agent writes Mermaid source to outbox-diagram.mmd first.
#   draft-diagram.sh                 -> render $KEDIN_DIAGRAM_SRC, deliver with default caption
#   draft-diagram.sh "caption"       -> custom caption
#   draft-diagram.sh "<mermaid>" "caption"  -> inline source + caption
set -eo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If the first arg looks like Mermaid (multi-word diagram source), treat it as inline source.
SRC_ARG=""
CAPTION="Candidate diagram for your draft — reply /post to publish it with the post, or tell me what to change."
if [[ "${1:-}" =~ (flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|^-$) ]]; then
  SRC_ARG="$1"; shift
fi
[[ -n "${1:-}" ]] && CAPTION="$1"

# Render the crisp Mermaid diagram; if it still won't render, fall back to the styled diffusion image
# (derived from the post topic) so an image ALWAYS reaches the user.
if "$HERE/render-diagram.sh" ${SRC_ARG:+"$SRC_ARG"}; then
  :
else
  echo "[kedin] diagram render failed — falling back to a styled diffusion image" >&2
  CONCEPT="$(head -c 300 "${KEDIN_OUTBOX:-$HERE/workspace/outbox.md}" 2>/dev/null | tr '\n' ' ')"
  [[ -z "$CONCEPT" ]] && CONCEPT="modern software architecture diagram"
  "$HERE/gen-image.sh" "$CONCEPT"
fi
exec "$HERE/send-image.sh" "$CAPTION"               # delivers it to the user's Telegram
