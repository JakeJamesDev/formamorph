# 08: Bundled Example And Scripts Guide

Status: done
Blocked by: 04, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a Tool description is prompt text that needs probe numbers, plus house-style world authoring.

## What to build

One bundled world ships a During AI Output filter World Tool (Q18), written in the house style of the bundled-worlds skill. The ticket picks the world. Its description ships with probe numbers on the cloud default model: the model calls the Tool when the scene asks for it, and not otherwise, against an in-batch control. The Scripts guide documents World Tools, the three timings, Reply, Stack Calls and the new writes. The help topic for the Tools tab is added.

Spec: Q18; story 32; Further Notes (probe work, endpoints without Tool support).

## Acceptance criteria

- [ ] The bundled world loads with its Tool, and a live turn shows the filter applied after the call
- [ ] Probe numbers for call rate when asked and when not asked, with an in-batch control, recorded in the ticket's comments
- [ ] Scripts guide and help topic cover World Tools and the new writes; copy-sweep clean
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 04 Memory And Diary Writes
- 06 During AI Output Triggers

## Comments

**World pick:** the drone world (the scripts showcase) ships `lock_target`, a During AI Output Tool with Stack Calls off. It marks the locked enemy as `**⌖ Name**` for the rest of the reply.

**Cloud model can't take Tools (2026-10-17, spec Q49).** Resolved 2026-10-21: the server now runs with `--enable-auto-tool-choice --tool-call-parser gemma4`. A request to the cloud default endpoint with `tools` returns HTTP 400:

> "auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set

So the probe and live check ran locally, on `g4-meromero-v2-31b-i1` (LM Studio, `trained_for_tool_use: true`). Cydonia 24B lacks that flag, so the app offers it no Tools.

**Probe** (`testing/baseline/harness/world-tool-call-probe.cli.ts`). It replays the app's captured drone narration request, swaps the player action, and offers `lock_target`. Arm A sends the shipped description; arm B, the in-batch control, sends "Lock onto an enemy." Arms alternate order per case. A call gets a second round with the Reply, and the Tool's real script runs over the narration to count marks. 6 runs per cell, app sampler defaults, `reasoning_effort: "none"`.

| Case | Asked | Arm A (shipped) | Arm B (control) |
|---|---|---|---|
| fire-at: aim the cannon at the enemy and fire | yes | 6/6 | 0/6 |
| target: swivel the turret, lock on, charge | yes | 6/6 | 0/6 |
| dash-attack: ram the enemy | yes | 0/6 | 0/6 |
| look-around | no | 0/6 | 0/6 |
| greet | no | 0/6 | 0/6 |
| rest | no | 0/6 | 0/6 |
| **Total** | | **asked 12/18, not asked 0/18** | **asked 0/18, not asked 0/18** |

The filter marked the target in 12 of 12 calls. The model calls for gun aim and fire, never for a melee ram. A candidate that named body attacks did worse in its own batch (asked 5/18, fire-at 0/6; control 0/18 and 0/18), so the shipped wording stays.

**Live check:** the worktree build on MeroMero, four attack turns on random drone openings, through `appDriver`. Every narration request offered `lock_target`; the model called it on two turns.

- Turn 1: called with `{"name": "growling beast"}`, then wrote "the **beast**". The first filter matched only the whole phrase, so it marked nothing. The filter now also matches the name's last word.
- Turn 4, with that fix: called with `{"name": "blighted beast"}`. The story on screen reads "slamming into a **⌖ blighted beast**" and, two paragraphs later, "You targeted the **⌖ beast**".

Live calls (2 of 4) came less often than in the probe's one captured scene, so the call rate depends on the scene.
