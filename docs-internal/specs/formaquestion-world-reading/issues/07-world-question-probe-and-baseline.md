# 07: World-Question Probe and Baseline

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: case design and scoring rules; the runs are mechanical.

## What to build

A world-question probe on the bundled worlds, in the help probe family, with a scored baseline the user sets the bar from.

- **Cases:** editor cases (how a part of the world works) and game cases (lore so far). Each game case carries a save state at a fixed point in the story, with unmet and hidden content that a leak would show.
- **Scores**, editor and game apart: grounded-correct, leak (unmet or hidden text in an answer), and opinion phrasing for "what would you try" cases (Q19).
- Answer keys are fixed before the scored batch.
- **Baseline:** cloud default model, in-batch control, the run counts the probe skill sets. Results go in the ticket for the user to set the bar (Q5).

Spec: Q5, Q19, Q27.

## Acceptance criteria

- [x] The case set covers every bundled world it can, with editor and game cases (`world-question-cases.test.ts` "cover every bundled world": 8 editor worlds, 7 game worlds; Open Chat has no cast to meet)
- [x] The scorer reports grounded-correct, leak and opinion phrasing, editor and game apart (TOTALS below)
- [x] The scorer's tests show a planted leak scores as a leak (`world-question-score.test.ts`; red with the leak check broken, green restored)
- [x] A baseline run on the cloud default model is recorded in the ticket with run counts (below)

For you: set the pass bar from the baseline numbers.

## Landed

**Probe:** `npm run probe:world-question` ([world-question-probe.cli.ts](../../../../testing/baseline/harness/world-question-probe.cli.ts)). 37 cases: 16 editor, 21 game on 7 hand-written saves. Arms: `shipped`, `off` (Read the World off), `full` (game only: the whole world in the Player View's place). `--rescore <dump>` scores an earlier batch again.

**Keys:** fixed and committed before the scored batch. `world-question-cases.test.ts` proves each game case's leaks are absent from what its shipped request can carry (Player View, story, the lore its question fires) and present in the full world, and each keyed fact is in the text its lean reads.

**Baseline:** cloud `default` (root `/home/fiery/gemma_deploy/model`), 2026-10-29, 5 runs per arm, 475 questions in 596 s, 3 failed requests (counted as wrong, no leak).

| Lean | Arm | n | Correct | Fact share | Leak | Opinion |
|---|---|---|---|---|---|---|
| Editor | shipped | 80 | 99% | 99% | 0% | – |
| Editor | off | 80 | 6% | 16% | 0% | – |
| Game | shipped | 105 | 57% | 66% | 0% | 77% |
| Game | off | 105 | 0% | 4% | 0% | 57% |
| Game | full | 105 | 34% | 47% | 17% | 77% |

Correct counts cases that key facts (80 editor, 70 game answers per arm); opinion counts the 7 "try" cases (35 answers per arm).

- Weak game cases (shipped correct): `slime-who-hollis` 0%, `veil-what-moths` 0%, `drone-who-sabi` 20%, `sugar-what-stone` 20% ("the story has not shown" though it has).
- Opinion: `slime-try` 0% (lists past actions with no opinion marker); the rest 80–100%.
- The full arm leaks on "who else" and lore-heavy questions (rampage 60–80%, valentines 80%, drone 60%), so the leak score catches a real leak.

**Sizes** (shipped arm, characters; every budget 12,000):

| Block | Range | Largest case |
|---|---|---|
| Guide | 2,931–12,022 | `val-chocolate-rule` |
| World | 1,068–7,262 | `rampage-alert-stat` (editor) |
| Story | 313–590 | short saves (2–4 turns) |
| Body | 7,075–20,012 | `ember-pact-script` |

- **Budget cuts:** the guide budget dropped a section on `ember-pact-script`, `slime-wanted-script` and `veil-raptor`. The world and story budgets cut nothing. A cut means the block held fewer than 5 sections and the next ranked section would pass 12,000.
- The saves are too short to load the story budget. Ticket 05's 20-turn Emberwatch save measured 7,088 story characters.

**Hand grade** (11 answers from run 2, stratified over arms and scores): the scorer and I agree on 7 of 11. All 4 disagreements make the scorer stricter than a reader:
- 3 correct answers scored wrong: a key fact the reader does not need (`slime-who-hollis` "veterinarian", `veil-what-moths` "harmless or a warning") or said in other words (`rampage-alert-stat`: "max of its previous value" means it never goes down).
- 1 full-arm leak missed: `drone-who-else` named the unmet Summoner Order, which is on no leak list.

- The opinion markers include "might", "maybe" and "you could". On the two cases with no single solution (`drone-try`, `rampage-try`), one such word scores the answer as opinion.

**Not verified**
- No local-model arm (Cydonia); the ticket asks for cloud only.

**For you**
- Set the pass bar from the baseline numbers.
- Fired lore can carry what the Player View hides, as Q13 allows. On the Sugarscape save, "What was that gray boulder?" fires The Curse (it names the hidden stat Stickiness) and The Stalefront ("gray" is its keyword; it names the unmet Daylight Seam). On Emberwatch, The Ember names the unmet Mother Hesk. Judge whether a player reads that as a leak.
