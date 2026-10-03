# 28: Tune lookup mode

Status: done
Base: 31488ec8
Blocked by: 22
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Lookup mode gives the same start as retrieval mode and costs fewer tokens, with no loss in answer quality (Q48–Q50).

Ticket 22 measured lookup mode on MeroMero v2 31B: 81% complete answers against 63% for retrieval, at 4.6 times the input tokens. The user kept lookup mode (Q48) and ruled two changes:

1. **Every search hit (Q49).** The lookup prompt starts with every ranked search hit under the retrieval character budget, as retrieval mode does, in place of the best hit only. Ticket 22 reports this removes its one regression (the quotes-player question).
2. **No contents list (Q50).** Remove the contents list from the lookup prompt (about 3,900 tokens). The lookup function keeps search words. The model used search words, not section ids, in 21 of 28 calls. Keep lookup by section id working for the ids the prompt's own sections and earlier results show.

**Re-probe.** Run ticket 22's probe (`--lookup` arm) on the same model and question set, with ticket 22's lookup prompt as the in-batch control (`--alt`). Report complete answers, player-wording answers and input tokens per question for both arms.

- Keep change 2 only if the complete-answer and player-wording scores hold within the batch's noise. If they drop, restore the contents list and report the numbers; the user decides.
- MeroMero locks the PC. Ask the user for an AFK window before the run; do not start it mid-session. Check what LM Studio has loaded first.

Update ADR-0009 if the prompt shape it records changes.

Recommended model rationale: two prompt changes judged only by probe numbers on a local model.

## Acceptance criteria

- [x] The lookup prompt holds every search hit under the retrieval budget; a test asserts it
- [x] The lookup prompt holds no contents list; a test asserts it
- [x] Lookup by search words and by a shown section id both work; tests assert both
- [x] The re-probe ran in a window the user agreed to, with ticket 22's prompt as the in-batch control
- [x] Complete-answer, player-wording and token numbers for both arms are in the handover
- [x] Change 2 is kept only if its scores hold; otherwise the contents list is back and the numbers go to the user
- [x] ADR-0009 matches the shipped prompt shape
- [x] Four gates green

## Comments

**Built.** The lookup prompt starts with the same search hits as retrieval mode and holds no contents list.

| File | Role |
|---|---|
| `src/lib/formaquestion/helpSession.ts` | Every hit in both modes. `HELP_LOOKUP_CHAR_BUDGET` (12,000) is the calls' own budget, on top of the prompt's |
| `src/lib/formaquestion/helpPrompt.ts` | The lookup prompt and message lose the contents list |
| `src/lib/formaquestion/docsLookup.ts` | `docsContents` is gone. The function says "search by words, or read by the ids you have seen" |
| `testing/baseline/harness/lookupControl.ts` | Ticket 22's request, frozen as the control arm (`--lookup22`) |
| `docs/adr/0009-…`, `docs/Formaquestion.md`, changelog | The new shape |

**Ruling from the spec session.** The lookup calls get their own 12,000-character budget (option B). With every hit in the prompt, a shared budget left the calls nothing.

**Probe.** MeroMero v2 31B (`g4-meromero-v2-31b-i1`, Q4_K_M, LM Studio, context 8,192), ticket 22's 18 questions, 3 runs per arm, one batch of 216 question runs, one request at a time, 22 min. The user agreed to an AFK window on 2026-10-01. Before the run, LM Studio had only this model loaded. A failed run counts as not complete.

- 🔧 **The control is a new arm, `--lookup22`, not `--alt`.** `--alt` swaps only the retrieval system prompt. `lookupControl.ts` freezes ticket 22's prompt text, function description and contents list. The search, the executor and the budget constants are the live ones, so this control has ticket 27's search, not ticket 22's.

| Questions | Arm | n | Complete | Failed | Tokens in, mean | Tokens in, largest | Requests |
|---|---|---|---|---|---|---|---|
| Covered, all | retrieval | 48 | 100% | 0 | 1,653 | 2,949 | 1.0 |
| | **lookup (new)** | 48 | **94%** | 0 | **3,090** | **7,689** | 1.4 |
| | lookup22 (control) | 48 | 90% | 3 | 5,777 | 10,815 | 1.1 |
| Covered, player's words | retrieval | 24 | 100% | 0 | 1,855 | 2,949 | 1.0 |
| | **lookup (new)** | 24 | **88%** | 0 | **4,540** | **7,689** | 1.8 |
| | lookup22 (control) | 24 | 83% | 2 | 6,631 | 10,815 | 1.3 |
| Not covered | lookup (new) | 6 | flagged 6 of 6 | 0 | 2,122 | – | 2.0 |
| | lookup22 (control) | 6 | flagged 5 of 5 | 1 | 6,828 | – | 1.4 |

- ✅ **Change 2 holds.** Complete answers 45 of 48 against 43 of 48, player wording 21 of 24 against 20 of 24. Without the control's failed runs, it is 94% against 96% (43 of 45), and 88% against 91% (20 of 22): inside the noise either way. The contents list is out.
- 💸 **Tokens in drop 47%** on the mean (3,090 against 5,777) and 29% on the largest question.
- ✅ **The quotes-player regression is gone:** 3 of 3 complete, against 1 of 3 for the control.
- ⚠️ **New regression, `group-player`: 0 of 3.** The right section was first in the prompt. The model searched "folder worlds" anyway, got five save and load sections, and declined. The control answered 3 of 3. Every other covered question is 3 of 3.
- ⚠️ **The control failed 4 runs with HTTP 400**, the new arm none. UNVERIFIED: the probe keeps no error body. 3 of the 4 are in run 2, which points to the server more than to the request size.
- 🔎 **Ticket 27 changed the baseline.** Retrieval now sends the right section for 16 of 16 questions and answers 48 of 48 completely at 1,653 tokens. Both lookup arms score below it on this question set. Q48 kept lookup mode on ticket 22's numbers, where retrieval reached 63%.

**For the user to decide.**

| Question | What the numbers say |
|---|---|
| Does lookup mode still earn its place after ticket 27? | Retrieval: 100% complete, 1,653 tokens. Lookup: 94%, 3,090 tokens. Lookup's lift came from the search misses that ticket 27 fixed |
| Fix `group-player`? | An extra search can bury the right section. One option is to say in the prompt that the guide sections in the message come first. That is a prompt change and needs its own probe |

**Guards bite.** Five mutations, one at a time, each restored: the best hit only, a contents list put back, the shared budget, no lookup budget, near ids the lookup cannot read. Each fails a test.

**Review fold-in.** The stricter first-id check is back in the id test. A new test reads a section by an id an earlier result showed. `baseSectionIds` names the id list without later parts. "On top of" is now "in addition to".

**Gates** (2026-10-01, on the fold-in).

| Gate | Exit | Time |
|---|---|---|
| `npm run typecheck` | 0 | 61 s |
| `npm run lint` | 0 | 31 s |
| `npm run test` | 0 | 130 s, 16,129 tests, suite 128 s |
| `npm run build` | 0 | 21 s |

`lookupControl.ts` is outside the typecheck scope, so it was checked on its own: exit 0.
