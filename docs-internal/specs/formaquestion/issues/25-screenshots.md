# 25: Screenshots on a help question

Status: done
Base: 9a010b82
Blocked by: 20 — Ask a question
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A player with a vision model can attach a screenshot to a help question and ask "what is this?" (Q28).

- The ask field takes images by paste, drop and a pick control, through the same intake the action box uses, with the same cap and the same size limits.
- The attach control shows only when the active model accepts images. On other models it is absent, and a pasted image is ignored with no error.
- The images go with that one question. A follow-up does not resend them.
- The images stay in memory with the conversation and are gone when the app closes. They are never written to a save or to storage.
- The docs sections still go into the request; the image adds to them.

The image intake belongs to the action image attachments effort, which other sessions are still building. Check its tickets' status and message its spec session before you touch a file it holds. Reuse its seam; do not copy it.

Recommended model rationale: reuse of an existing intake with one capability check.

## Acceptance criteria

- [x] On a vision model, a pasted or dropped image shows as attached and is in the request for that question
- [x] On a non-vision model, the attach control is absent and a paste adds nothing
- [x] The cap and size limits match the action box
- [x] A follow-up request does not hold the earlier images
- [x] A test proves no image is written to storage or to a save
- [x] The intake code is shared with the action box, not duplicated
- [x] Changelog: folded into the Formaquestion In Progress entry
- [x] Four gates green
