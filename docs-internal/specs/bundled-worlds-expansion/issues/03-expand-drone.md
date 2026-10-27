# 03: Expand Drone

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Reincarnated Drone** grows from 4 locations and 6 entities to at least 10 and 14, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Drone keeps its `lock_target` Tool and its chassis gates and pick counts.

- Grow Magiterra Nova from four regions into a map a drone can patrol: towns, ruins, a frontier line, and places under each region.
- Give each new place at least one entity: machines, dragons, scavengers, soldiers, and the people the drone meets.
- Extend `lock_target` where the new cast needs it, and keep it the one Tool this world shows.
- **Assigned features:** none from the table.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 10 locations and 14 entities, every one with `imageTags`, and the stripped diff is ready for review. 12 and 16; the build script checks `imageTags`; diff at `.scratch/bundled-worlds-expansion-03/frames/drone-stripped.diff`.
- [x] The world's coverage row claims `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. `bundledWorlds.test.ts` green; `GameViewer.bundledSaves.test.tsx` drone rows pass at the pre-refresh and pre-expansion revisions.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. Five world-file mutations, each failing its test (see Comments).
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Decision batch, 10 per arm: rubric 41 to 39; the one leak turn is a model-side spill, passed by the spec session under Q9.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments. In the comments; sent to the spec session to fold into the spec (ruling 1).
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). `npm run fingerprints` after the last world edit; no fragment.

## Landed

**Not verified**

- The art-direction line is not yet in the spec's Comments: by ruling 1 the spec session folds it in from the landing message.

**For you**

- Read one transcript per opening and judge whether the new places feel like the same world. Worktree arm, decision batch: Capital `.scratch/bundled-worlds-expansion-03/frames/drone-run4-A.md`, Wastes `.scratch/bundled-worlds-expansion-03/frames/drone-run7-A.md`, Frontier `.scratch/bundled-worlds-expansion-03/frames/drone-run3-A.md`.
- Read the Frontier run with the reasoning spill on turn 1: `.scratch/bundled-worlds-expansion-03/frames/drone-run8-A.md`.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-03/frames/drone-stripped.diff`.

## Comments

**Art direction (Q16).** `painterly fantasy illustration, soft cel shading, clean lineart, sky blue and meadow green palette, warm brass accents, bright natural sunlight, airy atmosphere, hopeful adventurous mood, high detail`. Matched to the stored root backdrop and Tiamat portrait.

**Rulings (spec session).** The art line goes to the spec session at landing; only `newFieldChips` moves into the row, `visibilityRules` stays planned for ticket 10; the three starting regions and six openings stay; one Travel Hint chip, no Relationship labels. Correction: Ser Halden already stood at the Demon Frontier. The Mossback Sentinel stood at the root, and it moved to Mossback Hill.

**What changed.**

- **Map.** Eight new places, each nested by `parentId`. Capital: Undercity Vaults. Wastes: Hulkfall Camp, The Leviathan. Frontier: Fort Graywatch, Blightcrown Peaks, The Blight Line. Root: Thornmere, Mossback Hill.
- **Connections.** A tram tunnel joins the Undercity Vaults and The Leviathan, with hints both ways. Both ends set Nearby to use connections, because the tunnel is the point of those two places: a drone in the vaults should hear what nests in the hulk. The pass from Fort Graywatch to The Blight Line carries the chip.
- **Chip.** A new world placeholder, **Frontier Pass**, with four rolled names. Both legs of the pass hint use one placement token; the fort's description, summary and lore entry name the same roll.
- **Cast.** Ten new entities: Lady Morrow, Vault Warden, Sabi, Glassback Burrower, Squire Wren, Blight Drake, Blightspawn, Herald Skarn, Old Corwin, Tamsin. Lady Morrow, Herald Skarn and Tiamat set Known In to their region. Tiamat moved to his peaks, Rustjaw also stands at Hulkfall Camp, Ser Halden also at Fort Graywatch. Named cast gained pronouns.
- **Lore.** One Codex entry per new place, with keys narrow enough to clear the Test Bench substring rule.
- **lock_target.** Step 3 adds each word's other number, so a lock on "Blight Drakes" marks "drake", and "foxes" marks "fox". It stays the one Tool.
- **System prompt.** One fact line: the drone rolls on four chunky wheels. Readme's How this world is built names Map, the rolled Travel Hint, Known In and the plural marking.

**Tests.** `droneWorld.test.ts` gains five: the plural lock, the three opening characters at their starts, and one pass roll across both legs and the fort. Mutations, one at a time, each failing the named test: the Tool's number forms removed; its "es" singular removed; one pass leg switched to a unique roll; Ser Halden at the root; the pass chip removed (also fails `shows newFieldChips`).

**Probe (Q9).** Cloud `default`, Drone, worktree vs `2f45261a5`, interleaved. Rubric on the blind labels before the key: scene grounding, 2nd person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5.

Batch 1, 5 runs per arm (before the review fold-ins and the wheels line):

| Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|---|---|
| worktree | 5 | 15 | 0 | 0 | 0 | 0 | 15/15 | 15/15 | 1 | 0 |
| 2f45261a5 | 5 | 15 | 0 | 0 | 0 | 0 | 15/15 | 15/15 | 0 | 0 |

Rubric: worktree 20 / 25, 2f45261a5 21 / 25. The flag is DRONE-SPEAKS plus OFFERS-CHOICES on one knight line, "Friendly greeting, you say? ... What do you want, then?". Both are regex hits on dialogue: the knight echoes the scripted action's own words, as the system prompt's guessing rule invites in both arms.

Batch 2, the decision batch, 10 runs per arm (final world):

| Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|---|---|
| worktree | 10 | 30 | 0 | 1 | 1 | 0 | 30/30 | 30/30 | 1 | 0 |
| 2f45261a5 | 10 | 30 | 0 | 0 | 0 | 0 | 30/30 | 30/30 | 1 | 0 |

Rubric: **worktree 41 / 50, 2f45261a5 39 / 50.** The leak is one turn (run 8, turn 1, Frontier action opening): a Gemma `<|channel>thought` spill before the narration, with `reasoning_effort: "none"` sent. It is model-side: 1 of 45 worktree turns against 0 of 45, inside the open stat-pass spill's base rate (spec session ruling). The Frontier openings hold no line that invites deliberation: the only question is the knight's in-scene "Demon-work, or something else?". No reword.

**Probe-regex note for ticket 01's owner.** All three DRONE-SPEAKS hits are NPC dialogue, not drone speech: "Friendly greeting, you say?", "You answer in kind.", "Explains why you picked a machine to talk with". The `you (say|answer|…) … "` pattern matches an NPC quoting or guessing at the drone. OFFERS-CHOICES matched the knight's "What do you want, then?".

**Treads, for ticket 10.** Both arms give the wheeled drone treads or legs. The drone's `imageTags` already say "chunky wheels". The art-direction line names no subject (Q16), so the fix belongs in ticket 10's drone tags or negatives ("tank treads", "legs").

- The new arm uses the new cast in place: Blightspawn with many eyes and thorned hide, Ser Halden's squire, Rustjaw named.
- Shared misses in both arms: treads or legs on a wheeled drone (the wheels line did not move it), NPCs named before they introduce themselves, past-tense slips.
- Blinding is partial: new cast names give the arm away.
