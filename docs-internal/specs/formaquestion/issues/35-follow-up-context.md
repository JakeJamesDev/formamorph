# 35: Follow-ups keep their topic

Status: done
Base: 378213d1
Blocked by: 32
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A follow-up with a generic verb stays on the earlier answer's topic (Q60). Follow-ups scored 34% grounded-correct in ticket 26, the lowest English kind. "How do I test it?" after making a Tool found the Test Bench. "How do I create another one first?" found the Group how-to. "Can I cap how many of those they take?" after a trait requirement found Limit Active Characters.

- When a question has history, sections from the page of the previous answer's sources rank above other matches of the same strength.
- A follow-up that names a new topic outright still finds that topic.

**Probe.** Run ticket 26's harness on the follow-up and task kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct and right-source per kind.

Recommended model rationale: the weight must help vague follow-ups without trapping a real topic change.

## Acceptance criteria

- [x] "How do I test it?" after a Tool answer sends a Tools section; a test asserts it
- [x] A follow-up that names another feature sends that feature's section; a test asserts it
- [x] Probe numbers, fixed vs current build, same batch, are in the handover; task questions do not drop by more than the 5-point batch drift
- [x] Four gates green

## Handover

Commits b769e731 (weight) and a081877a (review fold-in). Rulings Q64 (×2 page weight, the follow-up's own search only; the page of the first source that is not the open screen's lead; no page after a flagged answer) and Q65.

**Probe.** Default cloud model, 5 runs, task and follow-up kinds, one batch. `retrieval` = fixed; `follow-old` = history without sources (current build). Run `help-baseline-2026-10-02T06-01-23-976Z`, 20 min.

| Kind | Arm | Grounded-correct | Right source |
|---|---|---|---|
| Task (75 × 5) | fixed | 49% | 55% |
| Task | current | 51% | 55% |
| Follow-up (10 × 5) | fixed | 20% | 50% |
| Follow-up | current | 18% | 40% |

- Task questions run the same code in both arms, so the 2-point gap is batch drift, inside the 5-point bar.
- Follow-up right source gains 10 points, all from `follow-tool-try` (0/5 → 5/5 right source, 0/5 → 2/5 correct).
- The other per-question shifts have the right source in both arms and are model drift at n=5: publish-update 0 → 2, group-add 2 → 0, backup-restore 2 → 1.
- The probe ran on b769e731. The flagged-answer rule came later; it changes only follow-ups whose first answer was flagged. The "cap" keyword is in the docs both arms read, so neither arm credits it.

**Findings, not fixed here**

- `follow-require-count`: the first answer's top source is LinkedContent, so the follow-up favors that page, not World-Editor-Traits. The pick-count section ranks first when its own page is favored. Needs a better first-question search.
- `follow-default-make` ("create another one first"): the first answer has no Personas section to favor (ticket 37).
- `follow-forget-undo`, `follow-rewind-edit`, `follow-connect-start`: the first answer's sources miss the keyed page, so no page weight reaches it.
- Lookup mode (off, does not ship): the sources start with the fetched sections, so the favored page is the first fetched section's page.
- What's-new follow-ups keep the release lead through the combined search (Q65, open for a later ticket).
- Ticket 34's probe saw follow-up grounded-correct fall when weaker guide sections took the changelog's old slot. This batch ran after 34 in both arms, so it does not measure that.
