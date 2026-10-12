# 06: Ask Probes With Fuzzy and Semantic On

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Prove that Ask holds its quality with fuzzy keywords and Semantic Search on (Q4, Q16).

- Run the help retrieval and baseline probes on the cloud model with fuzzy keywords and Semantic Search on. Use in-batch controls with the ranking from before ticket 01, and enough runs per arm for the cloud model's drift.
- The bar is no regression: 77.5% answer quality and 93% Take Me There, or better. Report the gain.
- When a probe misses the bar, tune the fuzzy weights or the semantic floor, and re-run. Never tune on the blind set.
- Smoke-test first; scale only a run the smoke proved.
- The control arm builds its index with `fuzzy: false`. After ticket 01, the help-baseline control indexes (untiered, unfiltered, hubOld) run with fuzzy on, so a control must set the flag explicitly.
- Known weak spots from ticket 01, to check first on a miss:
  - Prefix first (Q30): a typo that is also the start of another word gets no correction.
  - With two typo words in one question, a hub section's repeated exact words can outrank the specific section. The half weight on expanded words decides it.
  - A typo written in the docs or changelog matches exactly and never expands. Docs text must not quote typo examples literally.

Spec: Testing Decisions → Probes.

Recommended model rationale: probe design, reading noisy cloud results, and tuning judgment.

## Results

Cloud `default`, `npm run probe:help -- --semantic --search-old [--fuzzy-only | --unfloored] --runs 5 --kinds task,here,followUp`, four batches of 1,940 answers, 0 failed. Rulings Q32–Q34: three arms per batch; route hit is the live column (`answerRoute` on each answer) against the in-batch control; fresh section vectors in memory.

**Batches 1–2 (as built by tickets 01–02, Semantic with no floor), 10 runs, 970 answers per arm:**

| Arm | Grounded-correct | Route hit (710) |
|---|---|---|
| fuzzy + Semantic | 74.4% | 66.5% |
| search-old (control) | 74.0% | 70.0% |
| fuzzy-only | 74.4% | 70.0% |

Semantic's low-similarity hits took slots in Ask's fusion (an OpenRouter question got `WorldFormat#openings`), and the button fell back to them. Fuzzy alone showed no regression.

**Tuning:** Ask's semantic source had no floor. `HELP_SEMANTIC_FLOOR` = 0.45, picked on the known set's helped and hurt questions; the blind set was not used.

**Batches 3–4 (floor 0.45), 10 runs, 970 answers per arm:**

| Arm | Grounded-correct | Route hit (710) |
|---|---|---|
| fuzzy + Semantic, floor 0.45 | **77.4%** (76.7, 78.1) | **67.5%** |
| search-old (control) | 73.9% (73.4, 74.4) | 67.6% |
| unfloored | 73.2% | 62.8% |

- Answer quality: +3.5 over the control in the same batches. Against the absolute bar: 77.4% vs 77.5%, 0.1 under. The user accepted it as met (2026-10-11): the control runs 73.9% today.
- Take Me There: no regression against the control (479 vs 480 of 710). Offline route probe: surfaced task 55/59 (93%), here 12/12, unchanged.
- Follow-ups trail the control in both floored batches (70% vs 77%, 50 answers each); 10 follow-up questions.

**Recall**, with the 0.45 floor (`npm run probe:help-recall -- --ai --arms shipped,semantic-on,search-old --runs 3`): known @5 84.2% fuzzy, 89.0% + Semantic, 83.2% exact; blind @5 89.4%, 89.0% (first 62.8% vs 57.8%), 91.8%. Fuzzy and exact rank all 94 blind questions the same to depth 50, so the blind spread between arms is pick noise.

**Stale vectors:** the shipped `sectionVectors.json` holds no current vector for 24 sections: Prompts#the-chip-editor, WorldEditor#️-world-editor, World-Editor-Stats#how-to-add-a-stat, World-Editor-Stats#how-to-group-stats, World-Editor-Entities#the-panel, World-Editor-Entities#entity-stats, World-Editor-Entities#in-the-library, World-Editor-Traits#how-to-make-a-blueprint, World-Editor-Traits#stat-changes, World-Editor-Traits#groups, World-Editor-Traits#entity-traits, World-Editor-Traits#blueprints, World-Editor-Traits#test-bench-checks, World-Editor-Dictionary#the-entry-panel, Persona-Authoring#persona-stats, WorldFormat#traits, WorldFormat#dictionaries, StatCodeGuide#how-it-works, StatCodeGuide#quick-reference, StatCodeGuide#basic-syntax, StatCodeGuide#writing-to-self, StatCodeGuide#persona, StatCodeGuide#entities, StatCodeGuide#order-of-effects. Run `npm run build:help-vectors` before the release.

## Acceptance criteria

- [x] Probe numbers for both arms, with run counts, quoted in the ticket.
- [x] Both bars met or beaten, or the miss escalated to the user with the numbers.
- [x] Any tuning lands with its tests; four gates green.
