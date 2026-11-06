# 01: Focus Classifier Probe

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it writes a new prompt for small models and judges probe numbers that decide whether the mode gets built.

## What to build

The first evidence that the Focus Classifier works and that trimmed narration holds up, before any pipeline work (Q12).

- Write the draft Focus Classifier prompt as a default prompt constant beside the other prompts, with no wiring into the game. This ticket owns the prompt text; ticket 02 wires it. Follow the prompt-writing guide: positive contract, no example values a small model can parrot. The user turn carries the player's action, the last narration, and one line per entity here and in sublocations: letter, name, and AI summary (full description when the summary is blank) (Q5, Q6, Q17). The reply is one line per letter with a tier word: Focus, Background or Offstage (Q21).
- Draft a labeled case file from bundled worlds and Sedge Landing: turns with 3 or more entities here, each with its expected tier per entity (Q14). Cover moves, addressed characters, entities named only by description, and sublocation entities.
- A harness script that sends each case to the classifier with `reasoning_effort: "none"` and the classifier's sampler pins, and reports Focus recall, tier match, parse failures and entity tokens saved.
- A second arm that sends narration with the full roster and with the hand-labeled trimmed roster for the same turns, and scores both on the continuity rubric.
- Run counts and in-batch controls follow the probe skill. Cloud default model first; the Cydonia arm runs only in a window the user agrees to.

## Acceptance criteria

- [x] The draft prompt exists as a default prompt constant and nothing in the game reads it yet. `defaultFocusClassifierPrompt` and `defaultFocusClassifierUserPrompt` in `GamePrompts.ts`; a grep of `src/` finds no other reader, and neither is in `PROMPT_TEXT_DEFAULTS`.
- [x] The case file has the expected tier for every entity in every case. `testing/baseline/focus-classifier-cases.json`: 30 cases, 9 scenes; the harness throws on a roster entity without a label.
- [x] The user reviewed a sample of the labels before any counted run, and the ticket records their changes. The user reviewed 10 cases on 2026-11-06 and changed none.
- [x] The harness reports Focus recall, tier match, parse failures and tokens saved for each model. `--arm classifier`, cloud run below.
- [x] The narration arm reports continuity scores for full and trimmed rosters on the same turns. `--arm narration` plus `--arm merge`, cloud run below.
- [ ] The ticket records the numbers for the cloud default model and Cydonia against the Q13 bar: Focus recall at least 95%, tier match at least 85%, trimmed narration no worse than full. Cloud recorded below: **it misses the bar.** Cydonia not run (Q26).
- [x] The ticket lists every missed Focus entity with its case, so a later grill can decide on floors (Q9). See "Missed Focus".

For you: review the label sample before the counted runs (the case file in this ticket's harness folder).
For you: pick a GPU window for the Cydonia arm.
For you: read three trimmed-vs-full narration pairs from the probe output and judge whether background characters still feel present.

## Results (cloud default, 2026-11-06)

Run: `npx vite-node testing/baseline/harness/focus-classifier-probe.cli.ts -- --arm classifier|narration [--control <module>]`. The classifier sends `reasoning_effort: "none"`, temperature 0.2 and repetition penalty 1. **Ticket 02 copies these pins into `PROMPT_SAMPLER_PINS` (Q24).** The narration request is unpinned, like the app's.

### Classifier: 30 cases × 5 runs, 0 parse failures in every run

Each revision ran beside the draft in the same batch (`--control`), because the cloud model drifts between batches. Tune = the 15 even-indexed cases; held = the 15 odd-indexed cases (Q27).

| Prompt | Focus recall, tune · held · all | Tier match, tune · held · all | Classifier tokens (system + per turn) | Net tokens per turn |
|---|---|---|---|---|
| Draft (first counted run) | n/a · n/a · 55.9% | n/a · n/a · 61.7% | 513 (296 + 217) | −127 |
| Rev 1 | 100% · 86.7% · 92.9% | 74.5% · 74.1% · 74.3% | 471 (253 + 218) | −157 |
| Rev 2 | 82.5% · 71.1% · 76.5% | 76.1% · 73.4% · 74.8% | 498 (280 + 218) | −144 |
| **Rev 3 (shipped text)** | **100% · 87.8% · 93.5%** | **71.5% · 73.8% · 72.6%** | 480 (262 + 218) | −154 |

- **Bar (Q13): missed.** On the held half, rev 3 reaches 87.8% Focus recall (bar 95%) and 73.8% tier match (bar 85%).
- The draft control repeated in every batch: Focus recall 57.6%, 55.9% and 57.6%. The gains are real, not batch drift.
- The draft gave exactly one Focus per turn and almost never Offstage (126 of 170 Offstage labels came back Background). Rev 1 fixed both, at the cost of over-marking: Background→Focus 75 of 295 in rev 3. Rev 2 narrowed Focus to the action and lost the "about to act" cases.
- **Tokens:** the narration request saves 326–399 prompt tokens per turn, but the classifier call costs 471–513. On bundled worlds the net is negative in every revision. Bundled AI summaries are short (median 79 characters), so a Background block saves little.
- I saw the draft's per-case table for all 30 cases before the split was set. After that I read only the tune half's errors.

### Missed Focus

Rev 3 (shipped text), 11 of 170:
- `sedge-waiting` Bram → Background, 5/5 (left waiting on the player)
- `sunk-bell` Dread Crawler → Background, 4/5 (about to act, drawn by the bell)
- `hallway-peek` Hana Sakuragi → Offstage, 1/5 (sublocation, described only)
- `keep-smith` Bram Oakes → Offstage, 1/5 (sublocation, named by role)

All four are on the held half. Every miss is a "waiting" or "about to act" entity, or a sublocation entity the action only reaches by description.

The draft missed 75 of 170, each at 5/5, all → Background: `sedge-ask-ferryman` Bram, `sedge-waiting` Bram, `tavern-toast` Sylvie and Corvin, `keep-smith` Bram Oakes, `keep-recruit` Albus, `cafeteria-kitchen` The Swarm, `cafeteria-fountain` Haruto Mori, `hallway-listen` The Swarm, `hallway-peek` Hana Sakuragi, `hospital-cordon` Quarantine Watch, `fort-radar` Jet Fighter, `sunk-wade` Mire Leeches, `sunk-silence` Bark Frogs, `sunk-bell` Dread Crawler.

### Narration: 6 cases × 12 runs per arm, hand-labeled tiers, both arms in one batch

Better-by = trimmed minus full (for Offstage onstage, full minus trimmed), with the 95% interval.

| Metric | Full | Trimmed | Better-by [95% CI] |
|---|---|---|---|
| Focus facts kept (share of fact patterns) | 0.326 | 0.276 | −0.050 [−0.126, 0.025] |
| Background entities present (share) | 0.208 | 0.132 | −0.076 [−0.169, 0.016] |
| Offstage entities put onstage (count) | 0 | 0 | 0 |
| Blind continuity 1–5 (judge run 2, ids re-drawn) | 4.36 | 4.54 | +0.18 [−0.003, 0.36] |
| Blind continuity 1–5 (judge run 1) | 3.99 | 3.94 | −0.04 [−0.28, 0.19] |
| Invented duplicates (judged) | 0 | 0 | 0 |
| Narration prompt tokens | 3393 | 3003 | 390 saved |

- "No worse" (Q23: the interval reaches zero) holds on every metric. Both objective point estimates lean toward full, though, and this test passes on wide intervals. It shows the data cannot rule out parity. It does not prove parity.
- The two judge runs disagree in level (3.97 vs 4.45 overall) and in direction. Read the blind score as noisy.
- Judge run 1's ids followed job order, so an even id was always the full arm. Run 2 re-drew the ids from the passage text, so neither an id nor its position tells the arm. The harness now numbers ids that way.
- Invented duplicates come from the judge, not from a pattern match.

## Results (MeroMero 31B, local, 2026-11-06)

The user asked for this run. Q13 names Cydonia, so this arm does not replace it. Setup: `g4-meromero-31b` in LM Studio, 12288 context, 2 slots, fully on the GPU (23.2 of 24.5 GB). The text is rev 3, as shipped. Each run uses its own seed (`SEED + run`), so the runs are replicates, not copies.

### Classifier: 30 cases × 3 runs, 0 parse failures

| Half | Focus recall | Tier match |
|---|---|---|
| Tune | 93.8% (45/48) | 86.9% (172/198) |
| Held | 92.6% (50/54) | 79.2% (145/183) |
| All | 93.1% (95/102) | 83.2% (317/381) |

- **Bar (Q13): missed, narrowly.** Recall is below 95% on both halves. Tier match passes 85% only on the tune half.
- Classifier call: 465 tokens (243 system + 222 per turn). The narration saves 378 ± 69, so the net is −87 per turn.
- Missed Focus, 7 of 102: `cafeteria-kitchen` The Swarm → Background 3/3 (about to act); `fort-radar` Jet Fighter → Background 3/3 (about to act); `cafeteria-run` Rin Hayama → Background 1/3 (triggered by a rule).
- Confusion: Background→Focus 22 and Background→Offstage 16 of 177; Offstage→Background 19 of 102.

### Narration: 6 cases × 6 runs per arm

| Metric | Full | Trimmed | Better-by [95% CI] |
|---|---|---|---|
| Focus facts kept | 0.616 | 0.655 | +0.039 [−0.080, 0.158] |
| Background entities present | 0.292 | 0.347 | +0.056 [−0.067, 0.178] |
| Offstage entities put onstage | 0 | 0 | 0 |
| Blind continuity 1–5 | 4.56 | 4.64 | +0.08 [−0.008, 0.175] |
| Invented duplicates (judged) | 0 | 0 | 0 |
| Narration prompt tokens | 3290 | 2903 | 388 saved |

- On MeroMero, trimmed narration is no worse, and every point estimate leans toward trimmed.

## Landed

**Not verified**
- Cydonia numbers against the Q13 bar: no GPU window yet (Q26). Ticket 02 stays blocked until Cydonia meets the bar, and cloud already misses it.

**For you**
- For you: pick a GPU window for the Cydonia arm. Run: `npx vite-node testing/baseline/harness/focus-classifier-probe.cli.ts -- --arm classifier --endpoint http://127.0.0.1:1234/v1/chat/completions --model cydonia-24b-v4.3@q4_k_m --runs 3`, then the same command with `--arm narration`.
- For you: read three trimmed-vs-full narration pairs from the probe output and judge whether background characters still feel present. `.scratch/focused-thinking-01/frames/narration-pairs.md`; every run file is beside it, the MeroMero runs as `meromero-*.json`.
- For you: the cloud classifier misses the Q13 bar after 3 revisions, and the token net is negative on bundled worlds. Per the spec, Focused Thinking returns to the grill before any build ticket.

**Known limits of this probe**
- The one move case (`tavern-arrive`) has no Focus entity, so no case tests a Focus entity at a move's destination.
- `hallway` has 2 entities here and 5 in sublocations. It meets "3 or more" only when sublocation entities count.
- Presence patterns are broad (for example `raft|ferry|rope`), so the presence and onstage counts are blunt.
- The Offstage list rides the sublocation roster chip. A narration template without that chip would drop the list.

## Comments

**2026-11-06, label review (spec session).** The user reviewed the labels that every model run rejected, or nearly every run (cloud rev 1, rev 3 and MeroMero), then re-checked them against the tier definitions below. The numbers above use the old labels.

**Tier definitions (the user's).**
- **Focus:** the entity speaks or acts in this turn's narration, or the player acts on it. It needs its full entry so the narration does not get an important fact wrong.
- **Background:** nearby, but it will not act or speak this turn. It is included so a mention does not get basic details wrong or invent a new character in place of the authored one.
- **Offstage:** not relevant to this turn. It just left the scene or plays no part, and a mention would go against the narrative. Listing it nudges the narration to ignore it.
- **Toss-ups:** a genuine Background-vs-Offstage toss-up accepts both. The case file marks the second tier in `alsoOk`, and the scorer counts either as a match.

| Case | Entity | Was | Now |
|---|---|---|---|
| `tavern-arrive` | Wenna Tallow | Background | Focus |
| `fort-radar` | General Vasquez | Background | Focus |
| `fort-highway` | Jet Fighter | Background | Focus |
| `fort-highway` | Artillery Battery | Background | Focus |
| `sunk-wade` | Dread Crawler | Offstage | Background |
| `cafeteria-kitchen` | Rin Hayama | Background | Focus |
| `sunk-silence`, `sunk-bell` | Mire Leeches | Background | Background, Offstage also accepted |

Kept: `hallway-text` and `cafeteria-run` The Swarm, `sedge-waiting` Rope Ferry (Background); `sunk-silence` Bleeding Tooth, `hospital-cordon` Dr. Ines Varga, Dr. Lena Sorensen in both fort cases (Offstage).

The shipped prompt's Focus rule includes "asks about it". Under these definitions, a topic the player asks a third party about is Background (`hallway-text`), so the prompt contradicts the labels there.

**2026-11-06, pretrained reranker probe (spec session).** Can a pretrained cross-encoder tier the entities with no training? `testing/baseline/harness/focus-reranker-probe.cli.ts` scores every (turn, entity) pair on CPU and fits two thresholds on the tune half. Four models (int8 ONNX) × query (action, or action plus last narration) × entity text (summary or description) × score mode (absolute, or relative to the case's top score). Labels as of the review above.

| Model (size) | Best Focus AUC | Held at 95% tune recall | ms per pair |
|---|---|---|---|
| bge-reranker-v2-m3 (571 MB) | 0.862 | recall 95.0%, match 41.0% | 57 |
| ms-marco-MiniLM-L-6-v2 (23 MB) | 0.837 | recall 90.0%, match 34.4% | 3 |
| mxbai-rerank-xsmall-v1 (87 MB) | 0.834 | recall 100%, match 32.8% | 9 |
| gte-reranker-modernbert-base (151 MB) | 0.783 | recall 95.0%, match 37.7% | 30 |

- **Fails.** To hold 95% Focus recall, every model calls most entities Focus, so tier match falls to 33–41%. The prompted LLM classifier reached 78–87%.
- Topical relevance is not Focus. An entity can be Focus because it acts, or the player acts on it, with little word overlap with the action.
- A Focus AUC of 0.78–0.86 shows some signal, so fine-tuning a cross-encoder stays open. It needs the labeled data first.
