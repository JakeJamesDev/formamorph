# 13: Lookup Mode re-probe

Status: ready-for-human
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Lookup Mode default follows a fresh probe on today's docs and search, not ticket 22's numbers.

- Ticket 28 found retrieval answering 48 of 48 completely at 1,653 input tokens against lookup's 45 of 48 at 3,090, after the keyword work changed the baseline. Ticket 10 flipped the default on from ticket 22's older 63% → 81%. Q46 reopens Q6 on that evidence.
- Run ticket 22's probe (`--lookup` arm against retrieval as the in-batch control) on MeroMero v2 31B with today's docs index and search sources, the same 18 questions, 3 runs per arm. Report complete answers, player-wording answers and input tokens per question for both arms, with failed runs counted as not complete.
- The run needs the GPU: ask the user for an AFK window before starting, and check what LM Studio has loaded first.
- Hand the numbers to the spec session. The user then rules: default on, or a follow-up flips it back to off. ADR 0009 line 20 is amended to match the ruling, in the ticket that applies it.

Spec: Q6, Q46; Testing → Other checks.

Recommended model rationale: a probe run with an in-batch control and a report the default rests on.

## Acceptance criteria

- [x] Both arms ran in one batch on the same model and question set; the table is in the ticket's Answer.
- [x] The spec session has the numbers and the user's ruling is recorded in the spec.
- [x] No code change in this ticket. Q47 limits this to product code; only the probe harness changed.

## Answer

**Lookup mode and retrieval mode tie on this question set.** Both answer 48 of 48 covered runs completely, flag 0 of 48 covered runs and flag 6 of 6 uncovered runs. Lookup mode costs 562 more tokens in per question (+7%).

**The harness used a renamed export (Q47).** A first run on 2026-10-04 failed all 108 retrieval and no-docs runs: `DEFAULT_HELP_ANSWER_OPTIONS` is now `DEFAULT_HELP_OPTIONS.answer`. `help-baseline.cli.ts` and `lookupControl.ts` held the same import. The old retrieval arm also skipped the app's session: keyword sections only, one request, no AI Picks, no face call. The spec session ruled that harness code is in scope.

| File | Change |
|---|---|
| `testing/baseline/harness/help-probe.cli.ts` | The import fix. A new `--session` arm runs `askHelp` with the lookup off and the lookup arm's settings. Session arms report tokens in per request kind. A failed run counts against every share |
| `testing/baseline/harness/lookupControl.ts` | The import fix. The `done` event carries `reasoning` |
| `testing/baseline/harness/help-baseline.cli.ts` | The import fix |

**Probe.** MeroMero v2 31B (`g4-meromero-v2-31b-i1`, Q4_K_M, LM Studio, context 8,192), ticket 22's 18 questions (`help-cases.json` now holds 21; the 3 uncovered cases added after ticket 22 stayed out), 3 runs per arm, one batch of 216 question runs, one request at a time, 1,530 s, 0 failed. The user agreed to the window on 2026-10-04. Before the run, LM Studio had only this model loaded. Default help settings in both session arms: keyword and AI Picks sources, the Mascot on. The only difference is the lookup switch. The bare `docs` arm (keyword sections, one request) ran in the same batch for reference.

| Questions | Arm | n | Complete | Failed | Tokens in, mean | Tokens in, largest | Requests |
|---|---|---|---|---|---|---|---|
| Covered, all | retrieval (session) | 48 | 48 (100%) | 0 | 8,576 | 11,886 | 3.0 |
| | **lookup** | 48 | **48 (100%)** | 0 | **9,138** | **17,316** | 3.0 |
| | bare retrieval | 48 | 48 (100%) | 0 | 1,535 | 3,389 | 1.0 |
| Covered, player's words | retrieval (session) | 24 | 24 (100%) | 0 | 8,694 | 11,886 | 3.0 |
| | **lookup** | 24 | **24 (100%)** | 0 | **9,442** | **17,316** | 3.0 |
| Not covered | retrieval (session) | 6 | flagged 6 of 6 | 0 | 8,486 | 11,463 | 3.0 |
| | lookup | 6 | flagged 6 of 6 | 0 | 9,838 | 13,308 | 3.8 |

Tokens in per question, by request kind (requests per question in brackets). A round after a face call and a lookup call counts as lookup.

| Questions | Arm | Pick | Answer | Face round | Lookup rounds |
|---|---|---|---|---|---|
| Covered, all | retrieval (session) | 4,617 (1) | 1,964 (1) | 1,994 (1) | – |
| | lookup | 4,617 (1) | 2,151 (1) | 1,938 (0.9) | 433 (0.1) |
| Not covered | retrieval (session) | 4,616 (1) | 1,920 (1) | 1,950 (1) | – |
| | lookup | 4,616 (1) | 2,072 (1) | 824 (0.5) | 2,326 (1.3) |

| Question | Wording | Retrieval complete | Tokens in | Lookup complete | Tokens in | Lookup requests |
|---|---|---|---|---|---|---|
| `backup-docs` | docs | 3 of 3 | 8,821 | 3 of 3 | 9,182 | 3.0 |
| `backup-player` | player | 3 of 3 | 7,670 | 3 of 3 | 8,066 | 3.0 |
| `lmstudio-docs` | docs | 3 of 3 | 7,237 | 3 of 3 | 7,681 | 3.0 |
| `lmstudio-player` | player | 3 of 3 | 7,422 | 3 of 3 | 7,836 | 3.0 |
| `regen-docs` | docs | 3 of 3 | 7,432 | 3 of 3 | 7,813 | 3.0 |
| `regen-player` | player | 3 of 3 | 8,161 | 3 of 3 | 8,553 | 3.0 |
| `publish-docs` | docs | 3 of 3 | 9,353 | 3 of 3 | 9,715 | 3.0 |
| `publish-player` | player | 3 of 3 | 9,075 | 3 of 3 | 9,459 | 3.0 |
| `group-docs` | docs | 3 of 3 | 10,317 | 3 of 3 | 10,667 | 3.0 |
| `group-player` | player | 3 of 3 | 11,764 | 3 of 3 | 13,683 | 3.3 |
| `quotes-docs` | docs | 3 of 3 | 8,369 | 3 of 3 | 8,733 | 3.0 |
| `quotes-player` | player | 3 of 3 | 8,770 | 3 of 3 | 9,117 | 3.0 |
| `tools-docs` | docs | 3 of 3 | 8,411 | 3 of 3 | 8,785 | 3.0 |
| `tools-player` | player | 3 of 3 | 9,420 | 3 of 3 | 11,148 | 3.0 |
| `import-docs` | docs | 3 of 3 | 7,719 | 3 of 3 | 8,101 | 3.0 |
| `import-player` | player | 3 of 3 | 7,273 | 3 of 3 | 7,673 | 3.0 |
| `trade-uncovered` | player | flagged 3 of 3 | 11,463 | flagged 3 of 3 | 12,806 | 3.0 |
| `achievements-uncovered` | player | flagged 3 of 3 | 5,510 | flagged 3 of 3 | 6,870 | 4.7 |

- 🟰 **No quality gap.** Retrieval sends the right section for 16 of 16 covered questions. The lookup has nothing left to find on this set, so both arms score 100%.
- ⚠️ **The tie says nothing about questions the keyword search misses.** This set has none. Lookup mode exists for those questions, and this probe cannot measure it.
- 💸 **The lookup's own cost:** 187 tokens in on the answer request (the lookup prompt and function), and lookup rounds on 4 of 48 covered runs (`group-player` once, `tools-player` three times). None of those runs changed an outcome: retrieval answered the same questions 3 of 3.
- ✅ **Ticket 28's `group-player` regression is gone:** 3 of 3 in both arms.
- 🔎 **The AI Picks request is the largest cost:** 4,617 tokens in per question, 54% of the retrieval session's total. It is the same in both arms and is not part of this ruling.

**Ruling (user, 2026-10-04):** the Lookup Mode default goes back to off (Q52). Ticket 16 sets it to off and amends ADR 0009 line 20.

**Review fold-in.** The probe's shares count a failed run against them; a dead-endpoint run now reads `complete 0%, failed 1` where it printed no row. The request-kind tally has a named type, and the comment states that the pick test rests on the default settings.
