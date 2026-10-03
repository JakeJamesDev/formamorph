# 45: Pronoun follow-ups

Status: done
Status note: Built and measured. Follow-up recall@5 rises to 90% on both sets, and follow-up answers rise from 48% to 80% grounded-correct. Two follow-ups still miss, because their first question misses.
Base: 01047d1f
Blocked by: 43, 44
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A follow-up that says "it", "them" or "that one" finds the earlier topic's sections (Q72). In ticket 39, every approach and mix stayed at 50–70% recall on follow-ups. Examples: "and how do I send it back to them after I change it?".

- Find why each missed follow-up in both sets misses, with the sources of ticket 44 on.
- Fix it in the search sources. Options to measure include giving the AI pick request the earlier question and answer, or resolving the pronoun from the earlier answer's sources.
- A follow-up that names a new topic still finds that topic.

**Probe.** Ticket 39's recall probe on follow-ups and tasks, both sets, and ticket 26's harness on follow-ups and tasks, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: follow-ups failed under every approach, so the cause needs reading before a fix.

## Acceptance criteria

- [x] Each missed follow-up has a named cause in the handover
- [x] Follow-up recall@5 rises on both sets; task recall does not drop more than the 5-point batch drift
- [x] A follow-up that names a new feature still finds it; a test asserts it
- [x] Probe numbers, fixed vs current build, same batch, are in the handover
- [x] Four gates green

## Handover

**Result: the pick request now carries the earlier answer. Follow-up recall@5 rises from 66% to 90% on the known set and from 70% to 90% on the blind set. Follow-up answers rise from 48% to 80% grounded-correct. Task numbers stay inside the batch drift.**

**Built.**

| File | What changed |
|---|---|
| `src/lib/formaquestion/helpPicks.ts` | `PickQuestion.earlierAnswer`; the pick message holds "The earlier answer:" after the earlier question |
| `src/lib/formaquestion/helpSession.ts` | `helpSearch` sends the newest answered exchange's answer to the pick request |
| `testing/baseline/harness/help-probe-shared.ts` | `withoutEarlierAnswer`: the control's fetch. It rebuilds the pick message with no earlier answer, and ends the probe when the app's message is not the one it rebuilds |
| `testing/baseline/harness/help-recall.cli.ts` | A `pick-old` arm. Follow-ups in the `shipped` and `pick-old` arms run after the answer the help session gave to the first question in that run, with its sources |
| `testing/baseline/harness/help-baseline.cli.ts` | A `--pick-old` arm |

- A flagged earlier answer goes to the pick request too, with no mark (Q76).
- The pick prompt is unchanged. A contract line for follow-ups was measured and left out (see below).

**Why each follow-up missed.** Ticket 44's shipped arm, both sets. The pick request held the earlier question, but the word a pronoun points to is often only in the earlier answer.

| Follow-up | Set | Before → after (recall@5, 5 runs) | Cause |
|---|---|---|---|
| `follow-group-add` "how do I get one of my worlds into it?" | Known | 0/5 → 5/5 | The pick read "get one of my worlds into it" as Import a World. "It" is the group, which the earlier answer names |
| `follow-forget-undo` "I removed the wrong one, can I get it back?" | Known | 0/5 → 5/5 | The earlier question does not say "memory", and its search missed. The earlier answer names the Memory tab |
| `follow-avatar-customize` "can I change how it looks after?" | Known | 3/5 → 5/5 | The pick went to the profile image in some runs. The answer names the avatar |
| `follow-b-world-send` "how do I send it back to them after I change it?" | Blind | 0/5 → 5/5 | "A file of the setting they made" reads as a save, and "it" took that meaning. The answer names the world import |
| `follow-b-placeholder-force` "how do I force it to one result?" | Blind | 0/5 → 5/5 | The earlier question does not say "placeholder"; the pick went to Openings. The answer names the placeholder |
| `follow-default-make` "how do I create another one first?" | Known | 0/5 → 0/5 | **Not fixed.** The first question ("I always play the same guy") never finds the Personas page, so its answer is about starting traits. The follow-up has nothing right to point back to |
| `follow-b-card-player` "can I do the same with my player characters from there?" | Blind | 0/5 → 0/5 | **Not fixed.** The first answer leads with Import an Avatar ("character card" read as a 3D avatar), so "from there" points at avatars, not SillyTavern |

`follow-tool-try` was found by the recall probe in both builds; in the answer probe its right source rose from 2/5 to 5/5. The two misses left are first-question misses, a search fix for the first question, not for the follow-up.

**How the fix was picked.** Known set only, with the first answers of ticket 44's answer batch. The blind set took no part. 10 follow-ups × 5 runs per arm, one batch, pick fused with keyword:

| Pick request holds | Follow-up recall@5 | Pick tokens in |
|---|---|---|
| The earlier question (the build before) | 70% | 4,473 |
| \+ the earlier answer's section headings | 76% | 4,529 |
| \+ the earlier answer | **90%** | 4,661 |
| \+ both | 82% | 4,718 |

The headings alone do not fix `follow-group-add`: they list Make a Group, the earlier topic, not what "it" points into.

**Recall probe.** 2026-10-02, at 1b78eaf5, default cloud endpoint, model `default`. `npm run probe:help-recall -- --ai --arms keyword,pick-old,shipped --runs 5`: 191 questions × 5 runs per arm, 0 failed pick requests, 0 replies with no line, 0 failed first answers. Raw rows: `testing/baseline/runs/help-recall-2026-10-02T18-10-28-727Z.json` (not tracked).

| Set | Approach | Recall@5 | First | Sent | Task @5 | Here @5 | Follow-up @5 | Added time | Added tokens |
|---|---|---|---|---|---|---|---|---|---|
| Known (97) | Keyword | 69.1% | 33.0% | 69.1% | 68.0% | 100% | 40.0% | 0.7 ms | 0 |
| Known (97) | Pick with no earlier answer (control) | 80.8% (80.4–81.4) | 45.6% | 80.8% | 79.7% | 100% | 66.0% | 878 ms | 4,498 |
| Known (97) | **Fixed** | **83.7%** (83.5–84.5) | 47.2% | 83.7% | 80.3% | 100% | **90.0%** | 885 ms | 4,518 |
| Blind (94) | Keyword | 71.3% | 41.5% | 70.2% | 73.8% | n/a | 50.0% | 0.5 ms | 0 |
| Blind (94) | Pick with no earlier answer (control) | 85.1% (85.1–85.1) | 58.1% | 85.1% | 86.9% | n/a | 70.0% | 837 ms | 4,494 |
| Blind (94) | **Fixed** | **87.7%** (87.2–88.3) | 60.9% | 87.7% | 87.4% | n/a | **90.0%** | 835 ms | 4,515 |

- A follow-up's pick request holds about 190 more tokens: 4,470 → 4,660 on average. The token columns above average over every question.
- The control's follow-ups now run after a real first answer, so its 66% and 70% differ from ticket 44's shipped arm (76% and 70%), which ran on a stand-in answer.

**Answer probe.** Ticket 26's harness, task and follow-up kinds, same endpoint, 5 runs, 1,275 answers in one batch, 0 failed. `retrieval` is the fixed build; `pick-old` is the build before, next to it in time. Every `pick-old` answer made two requests, so the control's guard never fired. Raw rows: `testing/baseline/runs/help-baseline-2026-10-02T18-33-43-115Z.json` (not tracked).

| Kind | Answers | Fixed: grounded-correct | Control: grounded-correct | Fixed: right source | Control: right source |
|---|---|---|---|---|---|
| Task | 375 | 69% | 71% | 79% | 79% |
| Follow-up | 50 | **80%** | 48% | **92%** | 62% |
| All | 425 | 70% | 68% | 81% | 77% |

| Cost of one question | Requests | Tokens in | Tokens out | Time |
|---|---|---|---|---|
| Fixed | 2.00 | 6,132 | 207 | 5.97 s |
| Control | 2.00 | 6,078 | 210 | 6.16 s |

- Task grounded-correct moves 2 points with an equal right-source rate (79% in both arms): batch drift, inside the 5-point bar.
- Follow-up wrong steps fall from 20% to 8%, and wrong answers with no flag from 46% to 16%.

**A follow-up that names a new feature.** The test `finds the new feature a follow-up names, though the pick names the earlier topic alone` (`helpSession.sources.test.ts`) asserts the follow-up's own keyword hit leads when the pick names only the earlier topic. It turns red when the follow-up's own search is replaced by the combined search. A live check, 8 follow-ups that name a new feature after a known first question, 10 repeats each, one batch (`.scratch/45-contract-new.ts`, not tracked):

| Arm | Found |
|---|---|
| Control | 70/80 |
| Fixed | 66/80 |
| Fixed + a contract line in the pick prompt | 68/80 |

- 7 of the 8 score the same in every arm. Of those, `avatars-1` → "can I put my worlds in a folder on the main screen?" misses in all arms: a word miss, not a follow-up miss.
- The whole difference is one case: "how do I turn on scene images?" after a Memory answer, 10/10 → 6/10. The pick is not drawn to the old topic. It names the right page, but a sibling section, How to Turn On Image Generation, in place of How to Turn On Scene Images. A follow-up's own search keeps one slot of the block (tickets 35 and 44), so the keyword search's top hit drops out when the merged ranking leads with the sibling. That one-slot rule is the cause, not the earlier answer; see below.
- The contract line ("The earlier question and answer tell you what the question's words point to. Pick the sections for the question itself.") gave 46/50 against 45/50 on pronoun follow-ups and 68/80 against 66/80 on new features: noise, so it does not ship.

**Review.** Standards: no hard violations. Spec: two findings folded into the second commit. The control's guard threw inside the help session's pick catch, so a mismatch would read as a failed pick; it now ends the probe. The control matches a system prompt with a suffix (`/no_think`). A flagged earlier answer went to the spec session: Q76, send it with no mark, and a test asserts it.

Not folded, named for a later cleanup:

- The probes rebuild `{ earlier, earlierAnswer, where }` by hand in three places, with `history.at(-1)` where the app uses `keptHistory`. The guard catches a drift. A `PickQuestion.earlier` object type would end the copy, but ticket 47 holds the session and both harness files now.
- `help-baseline.cli.ts` adds an arm in five places (header, usage, `Arm`, the arms chain, `askSession`). An arm table would gather them.
- In `help-recall.cli.ts`, the `found` map key is a joined string, and `noFirst` could be `firstFailedThisRun`.

**Seen, not fixed.**

- **A follow-up's own search keeps one slot** in the block when sources merge. A pick of a sibling section can take that slot from the keyword search's top hit (the scene-images case above).
- **First-question misses** decide the two follow-ups left: "the same guy" does not reach Personas, and "character card from another chat app" reaches avatars first.
- **The earlier answer has no cap** in the pick request. An answer can hold 800 tokens; the mean addition was 190.

**Tests.** `helpPicks.test.ts`: the message holds the earlier answer after the earlier question. `helpSession.sources.test.ts`: the pick request names the screen, the earlier question and its answer; it carries the newest answered exchange alone; a flagged answer goes with no marker; a new-feature follow-up keeps its own keyword hit first. Each new test was red before the code change, except the new-feature test, which a mutation of the follow-up search turns red.

**Gates.** At 1b78eaf5: typecheck exit 0 (25 s), lint exit 0 (29 s, 2 warnings in files this ticket does not touch), test exit 0 (16,502 passed, 3 skipped, 138 s), build exit 0 (24 s). The probe files were checked with a scratch config (`testing/` is outside `tsconfig.json`): exit 0. The second commit's gates are in its message.
