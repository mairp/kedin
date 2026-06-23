# COMMANDS.md — Kedin's slash commands

A "draft" lives in `workspace/outbox.md`; the candidate diagram source in `workspace/outbox-diagram.mmd`
and the rendered image in `workspace/outbox-image.png`. I keep them current with the `write`/`read`
tools and the `kedin` scripts. I publish ONLY by running `post.sh` (pre-approved). I never debug the
toolkit with shell commands.

- **/draft `<topic>`** — Write a post about `<topic>` in the user's voice (USER.md + feedback-dataset
  style rules). Save it to `outbox.md` and show it. Do NOT publish. An image is optional for `/draft`.
  End with: "Reply /post to publish, or /image, /edit, /shorter, /tone …".
- **/image `[prompt]`** — Produce a CANDIDATE image and deliver it to the chat. **Prefer a real
  UML/architecture diagram (crisp, legible):** write Mermaid (`flowchart`/`sequenceDiagram`/
  `classDiagram`/`stateDiagram-v2`/`erDiagram`; 3–6 nodes; ALWAYS double-quote labels like `A["API"]`;
  color via `classDef`) to `workspace/outbox-diagram.mmd`, then run `draft-diagram.sh` (renders +
  delivers). Only for abstract topics fall back to `draft-image.sh "<concept>"` (diffusion). Never asks.
- **/post** — Approval to PUBLISH. Run `post.sh` (text-only) or `post.sh --image --alt "<short alt>"`.
  Reply with the live LinkedIn URL it returns (or the error verbatim). This is the only path that publishes.
- **/autopost** — Run `skills/daily-autopost/SKILL.md` on a FRESH topic. ALWAYS produces the diagram
  (no asking). In `review` mode it drafts + diagram for approval; in `autonomous` mode it publishes.
- **/repost `<url>`** — Reshare a LinkedIn post WITH the user's commentary (approval-gated).
- **/edit `<change>` · /shorter · /longer · /tone `<style>` · /hashtags `<n>`** — revise the draft; show it.
- **/delete `[previous|<urn>]` · /editpost `<change>`** — delete / edit the last published post.
- **/status** — token validity/expiry + queued-draft summary (no secrets).
- **/reviewmode · /autonomous** — flip `autopost-mode.md`. **/feedback `<note>`** — record a voice lesson.

Rules: `/post`, `/autopost`, and an approved `/repost` are the only paths that publish. Never use emojis.
