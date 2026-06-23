---
name: daily-autopost
description: Draft a fresh LinkedIn post in the user's voice with a UML/architecture diagram; mode-aware.
---

# Daily autopost / `/autopost`

Pick ONE topic from `autopost-topics.md` that is NOT in the recent lines of `autopost-log.md`, then:

## Step 1 — Mode
Read `autopost-mode.md`. `review` (default) = draft + diagram, send for approval, do NOT publish.
`autonomous` = draft + diagram, publish directly, append to `autopost-log.md`, reply with the URL.

## Step 2 — Draft
Write the post in the user's voice (apply `feedback-dataset.md` Distilled style rules; ground in
`USER.md`). Rules:
- No emojis. Plain ASCII punctuation only (em dash `—` ok).
- Concrete, specific engineering voice; substance over hype. **NOT boastful / self-promotional** — no
  "transformative", "unprecedented", "game-changer", "I can attest", "revolutionary", "cutting-edge".
- **Tight: ~70–130 words** (hard cap 150). Lead with the insight. End with 3–5 hashtags.
- Grounded in USER.md; never invent facts/metrics/acronyms.
Write the EXACT text to `workspace/outbox.md` with the write tool.

## Step 3 — Image (ALWAYS, never ask)
Prefer a real Mermaid diagram. Pick the right type (`flowchart`/`sequenceDiagram`/`classDiagram`/
`stateDiagram-v2`/`erDiagram`), 3–6 nodes, SHORT labels, ALWAYS double-quoted (`A["API Gateway"]`),
color flowcharts with `classDef`/`fill:`. Write the Mermaid to `workspace/outbox-diagram.mmd`, then:
- `review` mode → run `render-diagram.sh` then deliver, or `draft-diagram.sh` (render + deliver in one).
- `autonomous` mode → run `render-diagram.sh`; the image is attached by `post.sh --image` in Step 4.
Only if the topic is abstract (no components to diagram), use `gen-image.sh "<concept>"` (diffusion).
The image step is mandatory — never ask "would you like an image?". If a command errors, report it
verbatim and continue text-only.

## Step 4 — Branch on mode
- `review` → send the draft text; do NOT publish; stop. (`/post` later publishes.)
- `autonomous` → `post.sh --image --alt "<short alt>"`; append `YYYY-MM-DD — <topic>` to
  `autopost-log.md`; reply with the live URL.

## Recording feedback (review mode)
When the user gives feedback, revise `outbox.md`, append a structured entry to `feedback-dataset.md`,
and fold the lesson into its "Distilled style rules".
