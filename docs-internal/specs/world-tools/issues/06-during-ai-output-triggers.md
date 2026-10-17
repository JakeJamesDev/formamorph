# 06: During AI Output Triggers

Status: done
Blocked by: 02, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: joins the trigger list to the sentence stream, the pacer and the retract restart.

## What to build

An armed During AI Output trigger fires on each completed narration sentence for the rest of the turn. Triggers run in Tools-tab order, before the world's output Scripts, and chain `narration.sentence` as output Scripts do (Q4). Their writes land with the After batch (Scripts Q42). A trigger armed by a Planning request covers the turn's whole narration. A retracted round restarts the run with the triggers still armed (Q9, ticket 02). The rewrite is the one copy: screen, save, TTS and recaps (Scripts Q2). `player.*` fails the script, and an error passes the sentence unchanged (Q3).

Spec: R2, Q3, Q4, Q9; stories 8, 15, 39.

## Acceptance criteria

- [ ] Through `runTurn`, a Tool call arms a filter; sentences after the call come out rewritten, and the save holds the rewrite
- [ ] Two armed filters compose in Tools-tab order, then a world output Script sees their result
- [ ] A retracted round restarts the run and the filter applies to the kept round's sentences
- [ ] A throwing filter passes the sentence unchanged; `player.tell` in a filter fails the script
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 02 Output Run Restarts On Retracted Rounds
- 05 Arming, After The AI And On Call Writes

## Comments

- From ticket 02 (landed 3e949300b): `OutputRun`'s listener resets only on `retract`, not on `opened`; `rewriteSentences` resets on both. Today they match, because the transport retracts whenever a round streamed text. Keep the armed trigger list outside the run's reset: a retract restarts the run's steps and writes, but triggers stay armed (Q9). A test with a retracted round must prove the filter still applies to the kept round.
