# 24: General-knowledge flag

Status: ready-for-agent
Blocked by: 20 — Ask a question
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player can tell an answer that came from the docs from one that did not (Q15).

- When the docs sections do not cover the question, the AI may answer from general knowledge. That answer carries a visible flag that says it did not come from the Formamorph docs and can be wrong about the app.
- Under a flagged answer, the window shows the nearest docs sections from the search, so the player has a next place to look.
- The flag comes from a marker the prompt tells the model to emit at a fixed place, not from the answer's wording. The session reads and removes the marker; the player never sees it.
- A marker split across stream chunks is still read. A missing marker means: grounded when sections were sent and the model gave no marker; flagged when no section was sent at all.
- A grounded answer shows its sources and no flag.

The prompt contract is positive: say what to do when the sections cover the question and what to do when they do not. No example answer a small model can copy.

The flag is a new visual element; use an existing design-system pattern for a caution note, or ask.

Report probe numbers: how often a question the docs cover is wrongly flagged, and how often a question they do not cover is wrongly left unflagged, with an in-batch control.

Recommended model rationale: the marker contract must hold on small models, and that is a prompt problem measured by probes.

## Acceptance criteria

- [ ] A stream with the marker yields a flagged answer with the marker removed from the text
- [ ] A marker split across two chunks is read and removed
- [ ] No sections sent and no marker: flagged. Sections sent and no marker: not flagged
- [ ] A flagged answer shows the nearest sections; a grounded answer shows sources and no flag
- [ ] The flag uses an approved pattern, with `verify-ui` evidence in both themes
- [ ] Probe numbers for both error directions are in the handover
- [ ] Changelog: folded into the Formaquestion In Progress entry
- [ ] Four gates green
