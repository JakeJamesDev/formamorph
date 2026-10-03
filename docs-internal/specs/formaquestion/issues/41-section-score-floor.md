# 41: Score floor for extra sections

Status: done
Base: 76d770c8
Blocked by: 38
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A weak match stops riding along after a strong top hit (Q69). Ticket 40 found that guide sections that look like answers, but score far below the top hit, draw the cloud model away. `worldeditor-1` scores 10/10 with only its key section and 2/10 with Personas **Change It in Game** in slot 5. That section scores 0.29 of the top hit.

- After the top hit, a search hit joins the docs block only when its score is at least a set share of the top hit's score. The share is a named constant beside the budget and the cap.
- The top hit and the surface section always go in.
- The Search tab keeps its full list. The floor applies to the help session's docs block only.
- Pick the share from the scores. Report the share of the top hit for every keyed section in ticket 26's set, so the floor drops no keyed section that reaches the block today.

**Probe.** Run ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct, right source and sections sent per kind. Name `worldeditor-1`.

Recommended model rationale: the floor trades recall for precision, and the share must be read from data.

## Acceptance criteria

- [x] A hit under the floor stays out of the docs block; a test asserts it
- [x] The top hit and the surface section are never dropped; a test asserts it
- [x] The handover holds the share of the top hit for every keyed section, and how many keyed sections the floor drops
- [x] Probe numbers, fixed vs current build, same batch, are in the handover; no kind drops by more than the 5-point batch drift
- [x] Four gates green

## Handover

**Verdict: the floor ships at 0.2, and it changes little.** Both probed floors sit inside the batch drift of the no-floor control. Q70 says ship 0.2 in that case. At 0.2, `worldeditor-1` keeps its distractors and stays at 1/5.

**The rule.** `DocsIndex.search` takes a `floor` option, a share of the top hit's score from 0 to 1. A hit under it stays out. The first hit after a what's-new question's lead sections always stays, and the lead sections stay too. `helpSections` passes `HELP_SCORE_FLOOR` (0.2), beside the budget and the cap. **Nearest Sections** for a flagged answer comes from `helpSections`, so it gets the floor too. The Search tab and the lookup pass none.

- A follow-up's combined search floors against its own top hit (Q70.1).
- The surface section and the on-page how-tos are exempt (Q70.3, reopened on the data below).

**Shares of the top hit, 69 keyed sections that reach a block today.** Bundled docs at 7996537d. 49 keyed sections are the top hit or a lead section (share 1). The 20 others:

| Share | Question | Keyed section |
|---|---|---|
| 0.210 | `textformatting-2` | `TextFormatting#superscript-and-subscript` (slot 5) |
| 0.230 | `image-generation-3` | `Image-Generation#how-to-connect-comfyui` (slot 5) |
| 0.385 | `follow-backup-restore` | `Saves-and-Backup#how-to-restore-a-backup` |
| 0.425 | `worldformat-3` | `WorldFormat#how-to-add-a-trait` |
| 0.430 | `statcodeguide-3` | `StatCodeGuide#how-to-add-stat-code-to-a-stat` |
| 0.460 | `worldformat-2` | `WorldFormat#versions-and-older-files` |
| 0.530 | `world-editor-openings-3` | `World-Editor-Openings#how-to-add-an-others-opening` |
| 0.570 | `follow-group-add` | `Library#how-to-add-a-tile-to-a-group` |
| 0.605 | `textformatting-1`, `persona-authoring-2` | how-tos in slot 4 |
| 0.615 | `avatars-1`, `world-editor-dictionary-1` | how-tos in slot 3 |
| 0.625 to 0.975 | 8 more | slot 2 |

- Floor 0.2 drops 0 keyed sections; 0.25 to 0.35 drop 2 (the first two rows); 0.4 drops 3; 0.5 drops 6.
- Before the on-page exemption, three "here" keys reached the block only through the on-page step, at 0.045 (`here-add-location`), 0.16 (`here-add-stat`) and 0.165 (`here-add-memory`). Any useful floor dropped them.
- `worldeditor-1` distractors: 0.37, 0.34, 0.315 and 0.29. The 0.35 arm was read from this one question, so it is fitted to the known set. Ticket 39's blind set is the out-of-sample check.

**Probe.** `npm run probe:help -- --runs 5 --floor-old --floor-alt 0.35`, default cloud model, 125 questions × 4 arms × 5 runs, 2,500 answers in 1,743 s, 0 failed. Grounded-correct, with right source and sections sent:

| Kind | Floor 0.2 (ships) | No floor (control) | Floor 0.35 | Right source, 0.2 / none / 0.35 | Sections sent, 0.2 / none / 0.35 |
|---|---|---|---|---|---|
| Task | 54% | 55% | 53% | 59% / 59% / 56% | 4.56 / 4.80 / 4.03 |
| Here | 98% | 98% | 100% | 100% / 100% / 100% | 4.00 / 4.00 / 4.00 |
| Follow-up | 36% | 34% | 38% | 50% / 50% / 50% | 4.70 / 4.70 / 4.40 |
| Language, setting only | 88% | 93% | 100% | 100% / 100% / 100% | 2.50 / 3.13 / 2.06 (both language rows) |
| Language, asked in it | 0% | 0% | 0% | 0% / 0% / 0% | |
| Changelog | 100% | 100% | 100% | 100% / 100% / 100% | 4.50 / 4.50 / 4.50 |
| **All** | **57%** | **57%** | **57%** | 62% / 62% / 60% | |

- No kind at 0.2 drops more than 5 points. Language, setting only, drops 5 (2 answers of 40).
- Questions that differ by 2 or more runs (0.2 / none / 0.35, of 5): `worldeditor-1` 1 / 1 / 5, `worldeditor-1-es-setting` 0 / 2 / 5, `statcodeguide-3` 3 / 0 / 5, `follow-backup-restore` 2 / 2 / 4, `textformatting-2` 5 / 5 / 0, `image-generation-3` 5 / 5 / 0, `formaquestion-2` 5 / 5 / 1, `persona-authoring-1` 2 / 4 / 3, `world-editor-stats-1` 3 / 5 / 4, `worldeditor-2` 3 / 5 / 5.
- 0.35 is a trade, not a gain: it recovers `worldeditor-1` and `statcodeguide-3`, and loses the two keys it drops plus `formaquestion-2`.

**Changes.** The harness has `--floor-old` (no floor) and `--floor-alt N` arms. `screen-old` now keeps every other option, so it no longer drops the floor with the screen words. Four existing tests used weak hits as their second section; the lookup tests now ask "How do I add a trait to a stat?", which has three hits over the floor. The changelog has one sentence in the Formaquestion entry and the probe entry.

**Gates.** typecheck, lint (0 errors), test (965 files, 16,314 tests, 125 s) and build all exit 0. Mutations: no floor fails 5 tests, a floor measured on the highest score with no top-hit exemption fails 1, a floor on the what's-new lead fails 4, a floor on the on-page how-tos fails 2, the help session without the floor fails 3, and a follow-up's combined search without the floor fails 1.

**Review.** Standards and Spec found no defect. Folded in: the floor's doc names the first ranked hit, a comment marks the on-page exemption, a follow-up test, and `--floor-alt` refuses a value outside 0 to 1. Left as is:

- The floor measures against the first ranked hit, not the highest score. A changelog hit that outscores the first guide hit always passes. The first guide hit must stay, so this is on purpose; a test covers it.
- **Nearest Sections** now lists the floored block, the same sections the AI gets. The changelog does not name this.
- The ticket body above still says the floor drops no keyed section and only the surface section is exempt. Q70 replaced both.

**Files.** Not tracked: `.scratch/t41/shares.ts` (shares), `.scratch/t41/per.ts` (per-question scores), and the raw batch `testing/baseline/runs/help-baseline-2026-10-02T15-06-55-759Z.json`.
