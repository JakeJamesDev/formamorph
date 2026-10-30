# 10: Fired Lore and Met Rows Share the World Block

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a budget rule in the game world block, measured by the probe.

## What to build

In game, fired dictionary entries go first in the world block under its 5-section cap. Five fired entries push out every Player View row, including the entity the question asked about. Past 5, "fired entries always join" is not true either. The world block keeps room for the top-ranked Player View rows when lore fires. Triage rule: fired entries take at most 3 of the 5 sections, the same cap semantic lore uses in narration. Ranked Player View rows fill the rest. When more than 3 entries fire, keyword-fired entries rank ahead of semantic ones, then by activation order.

Found in the close review. Spec: "Fired dictionary entries always join, ahead of ranked rows, inside the same budget."

## Acceptance criteria

- [x] A question that fires 5 or more entries still carries the top-ranked Player View row (`helpSession.gameWorld.test.ts` "keeps the met row the question names when five entries fire", "keeps the met row when five lore pages outrank it", "drops lore from the end so the top met row fits the budget"; each red with its guard removed)
- [x] Fired entries never take more than 3 sections; keyword-fired entries keep their place over semantic ones ("caps fired lore at three sections with no met row ranked", "ranks keyword fires ahead of a semantic fire declared first"; red with the cap at 5 and with declaration order only)
- [x] `probe:world-question` game arm, before and after, recorded in the ticket (below)

## Probe

Cloud default (root `/home/fiery/gemma_deploy/model`), `--arms shipped`, the 21 game cases, 5 runs each. Both runs in this ticket's worktree; ticket 08 had not landed.

| Game, shipped (n=105) | correct | facts | leak | opinion |
|---|---|---|---|---|
| Before (Base `5984091ab`) | 63% | 70% | 0% | 74% |
| After | 80% | 84% | 0% | 77% |

The gains sit on the met-row questions: `drone-who-sabi` 20% → 100%, `slime-who-hollis` 0% → 100%, `sugar-what-stone` 20% → 100%. The batches carry no in-batch control arm, so cloud drift is not ruled out. Raw answers: `testing/baseline/runs/world-question-probe-2026-10-30T03-29-43-920Z.json` (before), `…03-42-31-379Z.json` (after).

## Landed

The game World Index now searches Player View rows only. Fired lore resolves through `sectionsOf` and `sourceOf` and never ranks. Cause: a lore page that matched the question set the top score, and the 20% score floor dropped the met row before any cap applied. So ruling 4 (ranked lore counts against the cap) holds with no ranked lore.

**Not verified**
- Constant and recursive fires rank with keyword fires by the code (every non-semantic reason first); no test drives a constant or recursive fire.

**For you**
- Ask Morphie in game about a character while five or more lore entries fire. The answer names the character, and Sources list at most 3 lore entries.
