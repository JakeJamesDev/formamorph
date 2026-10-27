# 06: Expand Slime

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Slime Outbreak** grows from 7 locations and 8 entities to at least 12 and 16, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Slime keeps the spread script, the hidden Strain trait, and the rolled strain placeholder.

- Grow Ashburn: the hospital, the bridge out, a church shelter, the sewers, the radio station, each with survivors and slime forms.
- A Tool with a live write: the AI marks a block as overrun, which enables that block's lore entry. The world still plays without it.
- Relationship labels among the survivors and the Quarantine Watch. A chip where a label carries a rolled name.
- A Time of Day gate: the Night Pharmacy opens, or a trait turns on, only in the night dayparts.
- **Assigned features:** World Tool with a live write. Relationship labels. Time of Day gate. Script control of lore.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 12 locations and 16 entities, every one with `imageTags`, and the stripped diff is ready for review. 12 and 17; the build script checks `imageTags`; diff at `.scratch/bundled-worlds-expansion-06/frames/slime-stripped.diff`.
- [x] The world's coverage row claims `tools`, `relationships`, `timeGates`, `scriptLore`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. The row also claims `traitGates` (the night gate is one); `bundledWorlds.test.ts` green; `GameViewer.bundledSaves.test.tsx` slime rows pass at the pre-refresh and pre-expansion revisions.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. Eight world-file mutations, each failing its test (see Comments).
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Three decision batches, 10 per arm each, structurally clean; pooled rubric 126 to 128 over 30 runs per arm, 0.067 per run, inside the 0.1 tie band (spec session ruling).
- [ ] The art-direction line is in this ticket's comments and the spec's Comments. In the comments; sent to the spec session to fold into the spec.
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). `npm run fingerprints` after the last world edit; no fragment.
- [x] Every location has a `canvasPosition` matching the lore (Q25), shown in `.scratch/frames/slime-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme. `slime-canvas.png` (Ashburn) and `slime-canvas-marquette.png` (The Marquette District); `slimeWorld.test.ts` checks every location is placed and no two nodes overlap.

For you: read one transcript per opening and judge whether the new places feel like the same world.

## Landed

**Not verified**

- The art-direction line is not yet in the spec's Comments: the spec session folds it in from the landing message.

**For you**

- Read one transcript per opening and judge whether the new places feel like the same world. Worktree arm, batch 4 (final world): action opening `.scratch/bundled-worlds-expansion-06/frames/slime-b4-run1-A.md`, neighbor `.scratch/bundled-worlds-expansion-06/frames/slime-b4-run10-A.md`, stairwell `.scratch/bundled-worlds-expansion-06/frames/slime-b4-run3-A.md`.
- Expect `mark_overrun` rarely in play: on the cloud model it called on 1 of 5 games where a whole block fell, with no reasoning spills. A block report usually stays off unless the narrator calls the Tool.
- Look at the canvas layout: `.scratch/bundled-worlds-expansion-06/frames/slime-canvas.png` and `.scratch/bundled-worlds-expansion-06/frames/slime-canvas-marquette.png`.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-06/frames/slime-stripped.diff`.

## Comments

**Art direction (Q16).** `cel shaded comic illustration, bold clean lineart, flat muted colors, dark teal and charcoal gray palette, neon lime green glow, glossy highlights, overcast night lighting, light fog, eerie quiet mood, high detail`. Matched to the stored root backdrop and Green Slime portrait.

**Rulings (spec session).** All seven intent answers as proposed: Counter Open on Hollis, gated on [evening, night]; Wanted Notice two-way at 75% Suspicion; `mark_overrun` with a six-block enum and a Block Reports book; the Missing Partner chip in Sergeant Okonjo's label plus four plain labels; five new places and nine new entities; `visibilityRules` stays planned for ticket 13. The seven entries that start off have by-design Test Bench rows (option A); they come out when the `dictionary-disabled` rule learns about entries that scripts switch on, which is its own task. Q25 added canvas positions. The Tool wording: two rounds at most, keep the best call rate at zero spills.

**What changed.**

- **Map.** Five new places under Ashburn: Ashburn General, The Causeway Bridge, St. Anselm's, The Storm Sewers, KASH Radio. Eight new Connections with hints both ways. The school's coast road now runs down the west shore, to match the map.
- **Cast.** Nine new entities: Dr. Ines Varga, The Ward Mimic, Sergeant Abena Okonjo, The Fog Veil, Father Tomas Reyes, Dee Halloran, The Signal Slime, Gus Marrow, The Gutter Swarm. Okonjo, Reyes, Dee and Gus set Known In. The Watch also stands at the bridge and the hospital; Green Slimes wait at the church's salt line. Named cast and slimes have pronouns.
- **Lore.** One Bulletin entry per new place, the Wanted Notice entry (off, constant once on), and the Block Reports book (six entries, off).
- **Wanted Notice.** An After the AI world script switches the entry to match Suspicion at or above 75% of its max, both ways, writing only on a change. It reads a share, because the Long Coat & Gloves raise the max. It is a world script rather than one on Suspicion (ruling 2 named the stat): `statCodeExecutor.test.ts` and `bundledPlayerStats.test.ts` hold every bundled stat script to setting its own stat, and Emberwatch's Founders' Pact set the world-script precedent.
- **mark_overrun.** On Call, offered to narration. It switches on `<Block> Overrun` and adds one memory; a second call for the same block changes nothing and says so.
- **Night hours.** Counter Open on Hollis Pratt is Always On, gated on evening and night. Her text says the shutters come down at dawn.
- **Relationships.** Okonjo → Quarantine Watch carries the rolled Missing Partner; Hollis → Dr. Varga "niece", Father Reyes → Quarantine Watch "uninvited guests", Dee Halloran → Quarantine Watch "best source", Gus Marrow → the neighbor "bowling partner".
- **Canvas (Q25).** North is up: Signal Hill and KASH at the top, the harbor on the south shore, the bridge on the east edge, the Works farthest from Crescent Row. Ashburn, Crescent Row, the Works, Ashburn General and the sewers gained the direction words the map shows.
- **Probe driver.** `appDriver.mjs` now clears a live event poster before Enter World. The Spooky Season poster is modal and blocked every probe run on both arms.

**Tests.** `slimeWorld.test.ts` gains 25: the Tool's load shape, its write for each block, the second call, a second block; the notice at 75%, under the coat's raised max, and both ways; Counter Open in each daypart; Okonjo's partner in her label and her description for each roll; the canvas placement and overlap. Mutations, one at a time, each failing the named test: the second-call guard removed; the memory removed; the report write removed; the notice threshold read raw; the notice one-way; Counter Open on night only; the Okonjo chip replaced by text (also fails `shows newFieldChips`); the Bridge moved onto the Marquette box. The two notice mutations were rerun after the script moved to the world, and both still fail their tests. The owner-tree parity snapshot gains Hollis Pratt as a new trait owner (84 lines added, none changed). The probe batches ran with the script on Suspicion; the move changes where it runs, not what it writes.

**Tool call rate (cloud `default`, real games through the probe driver, Tool offered on narration, 5 games per cell).** Block fall: "The barricade at the end of Crescent Row gives way, and the slime floods the whole street behind me…". Vague: "I look around for what to do next."

| Wording | Block-fall calls | Block-fall spills | Vague calls | Vague spills |
|---|---|---|---|---|
| First draft ("The narration shows…") | 0/5 | 0 | — | — |
| Kept ("The player's action or this turn's events…", plus a Do-not-use line) | 1/5 | 0 | 0/5 | 0 |
| Round 1 (the narration you are about to write; block names in the parameter) | 0/5 | 1 | 0/5 | 0 |
| Round 2 (short imperative; block names in the parameter) | 1/5 | 1 | 0/5 | 0 |
| Positive rewording of the kept text (review fold-in) | 1/5 | 1 | 0/5 | 0 |

**Purposeful exception (spec session ruling).** The kept wording holds a "Do not use when" line against the prompt guide's positive-contract rule. Its positive rewording called on the same 1 of 5 block falls but spilled reasoning once; the kept wording spilled 0 times. A spill is worse than one negative clause. The stat pass was not tried: ticket 05 showed its strict schema blocks every Tool call.

**Probe (Q9).** Cloud `default`, Slime, worktree vs `2f45261a5`, interleaved, Tool offered. Rubric: scene grounding, 2nd person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5; graded blind by a fresh subagent on shuffled, relabeled transcripts.

| Batch | Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Choices ok | Stat ok | Flagged | Errors | Rubric |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | worktree | 5 | 15 | 0 | 0 | 0 | 15/15 | 15/15 | 0 | 0 | — |
| 1 | 2f45261a5 | 5 | 15 | 0 | 0 | 0 | 15/15 | 15/15 | 0 | 0 | — |
| 2 | worktree | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 38.5 / 50 |
| 2 | 2f45261a5 | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 42 / 50 |
| 3 | worktree | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 44.5 / 50 |
| 3 | 2f45261a5 | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 43.5 / 50 |
| 4 | worktree | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 43 / 50 |
| 4 | 2f45261a5 | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 42.5 / 50 |

**Decision: pooled rubric over batches 2 to 4, 30 runs per arm: worktree 126 / 150, 2f45261a5 128 / 150, 0.067 per run, inside the 0.1 tie band.** After batches 2 and 3 (83 to 85.5, 0.125 per run), the spec session ruled a third batch and a decision on the pooled 30. Batch 2's gap is scene grounding (6 vs 8); its worktree arm drew the weaker stairwell opening four times to the old arm's once. Batches 2 and 3 ran on the world before the review fold-ins (church slime form, sewer direction, coast road, readme wording, timeline); batch 4 ran on the final world. In batch 4, run 5 never entered play in either arm (a timeout on the Enter World click), so one interleaved make-up run per arm replaced it. Score tables: `.scratch/bundled-worlds-expansion-06/frames/slime-b2-blind-scores.md`, `slime-b3-blind-scores.md`, `slime-b4-blind-scores.md`.

- Shared misses in both arms: the checkpoint turn ends with no Watch reaction, the choices drift to posture, the salt throw often gets no visible reaction, and stock words ("tide", "viscous") recur.
- No transcript misuses the new content, and none shows gore or a speaking slime.
