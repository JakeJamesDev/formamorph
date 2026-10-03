# 50: Right page, wrong section

Status: done
Status note: No rule ships (Q80). Two rules reached two of the five keyed sections, but blind recall dropped and the bar did not move. Causes and measured alternatives are in the Handover.
Base: c040ee84
Blocked by: 46
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When the search reaches the right page, the keyed section on that page reaches the block too (Q79). In ticket 46, five questions reached the right page but never the keyed section in 10 runs: `memory-1`, `prompts-1`, `persona-authoring-2`, `statcodeguide-2`, `world-editor-openings-4`.

- For each, find why a sibling section ranked or was picked above the keyed one.
- Fix the cause with a rule you can state, in the search sources or the docs block. Do not add keyword lines or pick hints aimed at these five questions.
- Check the rule on ticket 39's blind set. It must not rely on the known set alone.

**Probe.** Ticket 39's recall probe on both sets, shipped defaults, 5 runs. Ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: a general rule from five cases, without fitting them.

## Acceptance criteria

- [x] Each of the five has a named cause in the handover
- [ ] The rule is stated in the code and a test, with no question named
- [ ] Blind-set recall@5 does not drop; same batch
- [x] Probe numbers on all kinds, fixed vs current build, same batch, are in the handover
- [ ] Four gates green

## Handover

**Verdict: no rule ships.** Two stated rules fixed two of the five questions. In the live batch, blind recall@5 dropped: the best run of each rule arm equals the worst run of the current build. Follow-up recall@5 dropped 4 to 6 points on both sets, and follow-up grounded-correct dropped 6 points. The bar stayed at 73–74%. The spec session ruled that neither rule ships (Q80). The second and third acceptance criteria stay open for that reason, and the gates did not run (see Gates).

### Causes

Two sources rank the sections: the keyword search and the AI picks. The merge is reciprocal rank fusion (k = 60) over 50 sections of each ranking. I traced each question through both sources and the merge. The picks are near-stable: 3 cached runs per question gave the same picks.

| Question | Keyword rank of the keyed section | What the picks chose | Cause |
|---|---|---|---|
| `statcodeguide-2` | 2nd (`StatCodeGuide#examples` 1st) | StatCodeGuide's first five how-tos, in list order | **A low keyword rank adds to a pick in the merge.** The keyword search ranks the five picks 10th–27th. Fusion adds those ranks to the pick ranks: 1/61 + 1/87 = 0.028, against 1/61 = 0.016 for keyword #1 alone. So the five picks take all five places, and keyword #1 and #2 are left out |
| `world-editor-openings-4` | 4th | Starting-a-Game how-tos ("the story begins" read as starting a game) | **Contraction pieces count as words.** "player's" gives `player` + `s`, and the three sections above the keyed one match `s` or other common words. The merge takes keyword #1–3 and two picks, so keyword #4 is left out |
| `memory-1` | 45th | `Entities#how-to-remove-a-cast-member`, Library delete how-tos ("drop an old event" read as removing an entity) | **Common words decide word coverage.** The score multiplies by (matched words ÷ question words)². After stemming, the keyed section matches 2 of 12 words: `keep` ("keeps") and `drop`, from its keyword line. Long sections match 5 of 12, from `doesn` + `t` ("doesn't"), `keeps`, `event`, `matter` |
| `prompts-1` | 16th | Connect-Your-Own-AI model-choice sections | **Common words decide word coverage.** The keyed how-to has the highest raw score (`cheaper`, `model`) but matches 2 of 9 words. `Prompts#the-surfaces-of-a-prompt` matches 7 of 9, with `have`, `while`, `main`, `write` |
| `persona-authoring-2` | 9th | World-Editor-Entities' first five lines, in list order | **Common words decide word coverage.** The keyed how-to matches 4 of 8 words. `StatCodeGuide#traits` and `Persona-Authoring#the-persona-chip` match 5–6, with `write`, `uses`, `whatever` |

- Pick replies often copy a page's first lines in list order. 98 of 477 cached replies hold 3 or more consecutive lines. On most pages, those first lines are the how-tos.
- The keyword search reaches the keyed page in all five. Inside that page, the keyed section ranks 2nd to 5th.

### The three at 0/5

`memory-1`, `prompts-1` and `persona-authoring-2` share one cause: word coverage counts every word that is not a stop word the same. A long overview or reference section holds more of a question's everyday words. The short how-to holds only its topic words. The picks then go to another page, so neither source reaches the keyed section. I found no coverage rule that held on both sets. Offline, task recall@5 known / blind (shipped: 79.6% / 87.3%):

| Tried | Known | Blind |
|---|---|---|
| Coverage weighted by word rarity (idf) | 75.6% | 84.5% |
| NLTK's English stop list | 78.2% | 82.9% |
| Coverage to the power 1 | 80.9% | 86.1% |
| Coverage to the power 3 | 81.3% | 83.7% |

Merge changes, offline:

| Tried | Known | Blind |
|---|---|---|
| Merge depth 5 | 83.1% | 86.1% |
| Merge depth 10 | 83.1% | 87.3% |
| Round-robin merge | 83.1% | 83.7% |
| Consecutive picks collapsed to one | 80.9% | 86.9% |
| Picks read as pages | 79.6% | 84.5% |

Depth 10 held blind recall, but 10 is a tuned number, not a stated rule.

### Measured alternatives

Two rules, each with an off switch for a control arm. Arm names: `section-old` is the current build (both rules off), and `contract-old` is rule 1 alone. The shipped arm (`shipped` in the recall probe, `retrieval` in the harness) has both rules.

1. **Floor before the merge.** The keyword search applies its score floor (0.2) to its own hits before the merge. The merged ranking has no floor, and the on-page how-to step still skips it. Fixes `statcodeguide-2`.
2. **Whole contractions.** A contraction or possessive is one word: "player's" is `player`, and a word that ends in "n't" is dropped. Applies to questions and docs alike. Fixes `world-editor-openings-4` together with rule 1.

**Offline**, cached picks, task recall@5 known / blind: shipped 79.6% / 87.3%, rule 1 83.1% / 87.3%, rules 1 + 2 85.8% / 86.1%. The simulator matched ticket 46's live numbers (79.5% / 87.6%). The one offline blind loss under rule 2 was a tie flip (21.35 vs 21.31) on `persona-authoring-b3`, which has no apostrophe.

**Recall probe, live.** `npm run probe:help-recall -- --ai --arms shipped,contract-old,section-old --runs 5`, no screen, 0 failed requests, 1,118 s. Raw (not tracked): `testing/baseline/runs/help-recall-2026-10-02T22-26-06-882Z.json` and `.md`. The report leaves the labels of the two new arms blank. Its rows are in the order shipped, `section-old`, `contract-old`.

| Arm | Known recall@5 | Known task @5 | Known follow-up @5 | Blind recall@5 (run range) | Blind task @5 | Blind follow-up @5 |
|---|---|---|---|---|---|---|
| Current build | 82.3% | 78.7% | 88.0% | **87.9%** (87.2–88.3%) | 87.4% | 92.0% |
| Rule 1 | 84.7% | 82.7% | 82.0% | 87.0% (86.2–87.2%) | 86.9% | 88.0% |
| Rules 1 + 2 | 86.0% | 84.3% | 82.0% | 86.6% (86.2–87.2%) | 86.4% | 88.0% |

"Here" recall@5 is 100% in every arm. Rule 1's gain is on the known set only.

**Ticket 26's harness, live.** `npm run probe:help -- --runs 5 --section-old --contract-old`, `BASELINE_NO_WATCH=1`, 125 questions × 4 arms × 5 runs, 0 failed, 2,627 s of wall-clock time (`time`). Raw (not tracked): `testing/baseline/runs/help-baseline-2026-10-02T23-09-55-505Z.json` and `.md`. The bar is from `--rescore <json> --kinds task,here,followUp`. Grounded-correct:

| Kind | Current build | Rule 1 | Rules 1 + 2 |
|---|---|---|---|
| Task | 69% | 69% | 70% |
| Here | 100% | 97% | 97% |
| Follow-up | 76% | 70% | 70% |
| **Bar (all three)** | **73%** | **73%** | **74%** |
| Task: keyed section sent | 79% | 82% | 82% |

- All kinds, all arms: 76% / 75% / 76% grounded-correct. No-docs control: keys met 2%.
- Keyed section sent, 5 runs: `statcodeguide-2` 0 → 5 (rule 1), `world-editor-openings-4` 0 → 5 (rules 1 + 2 only). The other three stay at 0.
- The bar is 73–74% in every arm, within drift of ticket 46's 75.5%.

I reverted the code. The two control arms toggle the reverted rules, so I reverted them too. I kept the diff of the rules, their tests and the arms on this machine at `.scratch/t50/ticket50-rules.patch` (not tracked). A later ticket can apply it to rebuild them.

### Gates

Not run. I restored the seven files I changed to `c040ee84`: `src/lib/docs/docsIndex.ts`, `docsIndex.test.ts`, `src/lib/formaquestion/helpSession.ts`, `helpSemantic.ts`, `helpSession.sources.test.ts`, `testing/baseline/harness/help-baseline.cli.ts` and `help-recall.cli.ts`. No commit since then touches them. This ticket changes only this file, as in tickets 37 and 46.
