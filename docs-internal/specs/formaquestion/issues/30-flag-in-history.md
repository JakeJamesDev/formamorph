# 30: General-knowledge flag in history

Status: ready-for-agent
Blocked by: 21, 24
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

On a follow-up, the model knows which of its earlier answers did not come from the guide (Q52). Today a flagged answer goes back into the history without its `[NOT IN GUIDE]` marker, so the model sees its own general answer as if the guide supported it.

- When the session builds the follow-up history, a flagged answer carries the marker again, in the same place the prompt asks for it. A grounded answer carries none.
- The player never sees the marker. Only the request changes.

**Probe.** This changes the request, so it needs numbers. Use ticket 20's harness with follow-up pairs where the first answer is flagged: a not-covered question, then a follow-up the guide also does not cover, and one it does cover. Report, with and without the marker in history, in the same batch on the default cloud model: how often the follow-up is flagged correctly, and answer quality on the covered follow-up.

Recommended model rationale: a small code change whose value is decided by a follow-up probe.

## Acceptance criteria

- [ ] A follow-up request after a flagged answer holds that answer with the marker; a test asserts it
- [ ] A follow-up request after a grounded answer holds no marker; a test asserts it
- [ ] The marker never shows in the window
- [ ] Probe numbers with and without the marker in history, same batch, are in the handover
- [ ] Four gates green
