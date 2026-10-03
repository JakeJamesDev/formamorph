# 24: General-knowledge flag

Status: done
Base: 8fa13c68
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

- [x] A stream with the marker yields a flagged answer with the marker removed from the text
- [x] A marker split across two chunks is read and removed
- [x] No sections sent and no marker: flagged. Sections sent and no marker: not flagged
- [x] A flagged answer shows the nearest sections; a grounded answer shows sources and no flag
- [x] The flag uses an approved pattern, with `verify-ui` evidence in both themes
- [x] Probe numbers for both error directions are in the handover
- [x] Changelog: folded into the Formaquestion In Progress entry
- [x] Four gates green

## Handover

Built: `generalKnowledge.ts` reads and removes the `[NOT IN GUIDE]` marker. A start that can still grow into the marker stays hidden while the stream runs, and after a Stop. The prompt asks for the marker alone on the first line. The session reads it at any place in the answer, so a misplaced marker still flags and never shows. A flagged answer gets pattern 5 above it, and **Nearest Sections** (a fresh search for the question) in place of **Sources**. The notice copy follows Writing Guide rule 4.5: "This answer is not from the guide. It can be wrong about Formamorph." The prototype line had no subject.

Probe (`help-probe.cli.ts --flag --lookup --alt <base prompt>`, cloud default endpoint, 21 cases x 5 runs, one batch). The cloud endpoint refuses function calls, so cloud players get retrieval mode and the lookup arm failed (HTTP 400, 105 requests).

| Retrieval mode, new prompt | n | flagged | wanted |
|---|---|---|---|
| Covered, right section sent | 50 | 0% | 0% |
| Covered, search missed the section (player wording) | 30 | 33% | 100% |
| Not covered (5 cases) | 25 | 100% | 100% |
| Control: covered question with another task's sections | 80 | 75% | 100% |

- Wrongly flagged: 0 of 50 when the right section was sent.
- Wrongly left unflagged: 0 of 25 on questions the guide does not cover. In the control, 20 of 80. All 20 are 4 pairs (publish and import questions, each 0 of 5) whose stand-in sections hold a near topic. There the model answered from the wrong section, for example Restore for "import a world". The 4 player-wording misses that stayed unflagged are the same kind.
- Every marker was on the first line (100%).
- Answer quality did not drop against the base prompt in the same batch: covered, all, complete 63% vs 63%; facts 69% vs 66%.

Gates after the review fold-in: typecheck, lint (0 errors), test (16054 passed, 139 s), build green. `verify-ui`: design-system reference, both themes, warning tint and icon read from computed styles.

Open:
- Lookup-mode flag numbers need an endpoint that takes function calls (Cydonia, local). Not run, per the cloud-first test policy.
- A flagged answer goes back in history without its marker, so the model sees its own unmarked general answer on a follow-up. Re-adding the marker to history is a small change. It changes the request, so it needs a probe that sends follow-ups.
- A grounded answer from a wrong section is not flagged. That is a search problem (ticket 27), not a marker problem.

