# 28: Tune lookup mode

Status: ready-for-agent
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

- [ ] The lookup prompt holds every search hit under the retrieval budget; a test asserts it
- [ ] The lookup prompt holds no contents list; a test asserts it
- [ ] Lookup by search words and by a shown section id both work; tests assert both
- [ ] The re-probe ran in a window the user agreed to, with ticket 22's prompt as the in-batch control
- [ ] Complete-answer, player-wording and token numbers for both arms are in the handover
- [ ] Change 2 is kept only if its scores hold; otherwise the contents list is back and the numbers go to the user
- [ ] ADR-0009 matches the shipped prompt shape
- [ ] Four gates green
