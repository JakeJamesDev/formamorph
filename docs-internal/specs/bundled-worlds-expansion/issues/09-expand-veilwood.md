# 09: Expand Veilwood

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Veilwood** grows from 7 locations and 10 entities to at least 13 and 18, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Veilwood keeps The Veil's Hold, Veil Sight, Move Quietly, and the weighted openings.

- Grow the wood: a fungal cathedral, the surveyor's cache, a drowned village, the predator dens, the eastern edge, each with its mushrooms, hunters, and signs of the lost.
- A Time of Day gate: the hunters' trait, or a rule on their images, holds only in the night dayparts.
- **Assigned features:** Time of Day gate.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Canvas layout (Q25):** store a `canvasPosition` for every location, old and new, placed by the lore within each Group's canvas: north is up, east is right, a far place sits farther than a near one, and no two nodes overlap at the grid size.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 13 locations and 18 entities, every one with `imageTags`, and the stripped diff is ready for review. 13 and 19; the build script checks `imageTags` and every reference; diff at `.scratch/bundled-worlds-expansion-09/frames/veilwood-stripped.diff`.
- [x] The world's coverage row claims `timeGates`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. `bundledWorlds.test.ts` green; `GameViewer.bundledSaves.test.tsx` plays a turn from both revisions.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. No new script or Tool; Night Hunt per daypart, the Attention doubling, the blazes chip and the canvas each went red on a broken world file (twelve mutations, see Comments).
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Final text, 5 runs per arm: 4.75 against 4.35, a win; structure clean.
- [x] Every location has a `canvasPosition` that matches the lore's directions and distances, shown in `.scratch/frames/veilwood-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme. Frames at `.scratch/bundled-worlds-expansion-09/frames/veilwood-canvas*.png`, Playwright at 1280 × 900; the compass table and every compass-led Travel Hint are checked in `veilwoodWorld.test.ts`.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments.
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

## Landed

**Not verified**

- The art-direction line is not yet in the spec's Comments: the spec session folds it in from the landing message.
- No probe run reaches night or leaves the Drowned Hollow, so no cloud transcript shows Night Hunt or a new region. The gate is proven in `veilwoodWorld.test.ts` only.

**For you**

- For you: read one transcript per opening and judge whether the new places feel like the same world. Final batch, worktree arm (label A): `.scratch/bundled-worlds-expansion-09/frames/probe2/transcripts/veilwood-run1-A.md` through `run5`; the blind scores and key sit beside them.
- Check the map reads as the lore: the Cathedral north of the Thicket, the Dens northeast under the ridge, Sunkwater south down the Channels, the Eastern Edge southeast with the open slope to the Veilbreak. `.scratch/bundled-worlds-expansion-09/frames/veilwood-canvas.png` and the three Group frames beside it.
- Play past dusk once and judge whether Night Hunt makes night feel different, and whether the doubled Predator Attention is fair.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-09/frames/veilwood-stripped.diff`.

## Comments

**Art direction (Q16).** `realistic digital painting, atmospheric concept art, muted teal and moss green palette, soft cyan and amber bioluminescent glow, dim diffused twilight, volumetric fog, hushed eerie mood, high detail`. Matched to the stored root backdrop. For ticket 16: the seven animated portraits are 3D-style creatures and mushrooms on a plain charcoal backdrop, so the new portraits need that backdrop in their run to match.

**Rulings (spec session).** Q1: Night Hunt, Always On per hunter, evening and night, +1 Predator Attention each; no day twin. Q2: both hunters Known In the root, with a count of out-of-scene hunter mentions in the first batch. Q3: 13 locations, the Belfry under Sunkwater and the Cache under the Edge. Q4: nine new entities, still exactly two hunters, no people. Q5: the Lost Surveyor chip on both legs of Fig to Eastern Edge. Q6: openings, weights, start and stats unchanged. Q7: the art-direction line above.

**What changed.**

- **Map.** Six new places: The Gloam Cathedral (north of the Thicket), The Predator Dens (northeast of the Fig, under the ridge), Sunkwater (south of the Channels) with Sunkwater Belfry inside it, and The Eastern Edge (southeast of the Fig) with The Surveyor's Cache inside it. The Edge is a second, open route to the Veilbreak.
- **Connections.** Seven new, hints both ways: Thicket–Cathedral, Cathedral–Dens, Fig–Dens, Channels–Sunkwater, Sunkwater–Edge, Fig–Edge, Edge–Veilbreak. The five old legs now lead with a compass word or read from their own side.
- **Time of Day gate.** Night Hunt on the Shadow Raptor and the Dread Crawler, Always On on evening and night. Each adds 1 to Predator Attention regen, so night doubles the curse's climb from 2 to 4. By day the hunters keep to their haunts and rest at the Dens.
- **Known In.** Both hunters are known in the whole wood. Mire Leeches are Known In nowhere, so they never show up before Sunkwater.
- **Chip.** The Lost Surveyor chip on both legs of the Fig–Edge road ("following the surveyor's paint blazes"), one world roll shared with the cache, the blazes and their lore.
- **Cast.** Nine new entities: Ghost Chanterelle, Bleeding Tooth, Sporeburst Puffball, Bark Frogs, Mire Leeches, The Drowned Bell, The Map's Other Half, The Bone Midden, The Surveyor's Blazes.
- **Lore.** One entry per new region; the Surveyor entry points to the cache.
- **Rewrites (Q4).** The Veil's Hold bends only the paths that try to leave the wood, since north and south now hold real places. The journal answers to `journal` only, since the map's other half shares the word `map`.
- **Map positions (Q25).** North up: the Fig in the middle, the Hollow west, the Thicket northwest with the Cathedral above it, the Dens northeast, the Channels and Sunkwater due south, the Edge southeast, the Veilbreak east of everything. Old descriptions gained compass words so the text and the map agree.
- **Key hygiene.** No short keys: `the dens` matched "the dense", `bell` matches "belly", `scree` matches "screech", `edge` matches the opening's "edge of the hollow".
- **Shared suite.** The detector tests read the pre-expansion Veilwood as their feature-free base, since the current one now shows `timeGates` and `newFieldChips`.
- **Player-stats test (prepare finding, spec ruling (a)).** `bundledPlayerStats.test.ts` let only a player owner's trait rows name a loose world stat, so it called Night Hunt's Attention row dead. The runtime's `globalRowTraits` applies every entity's global rows, played or not, so the test's `reachable` now gives every owner the loose world stats. It still fails a row on a missing stat or on another entity's stat: both mutations went red.
- **Parity snapshot.** Additions, plus two non-additions from the world itself: the Veil's Hold text copy, and one Blueprints group order 2 → 4 in the "past a hidden Blueprints group" drop, because the two hunters now own traits ahead of it.

**Tests.** `veilwoodWorld.test.ts` gains 31: Night Hunt per hunter per daypart (12), the Attention climb at day, night and dawn, the blazes chip, and canvas checks (every location placed, no overlap, 13 compass pairs from the lore, every compass-led Travel Hint, the Veilbreak east of everything). Mutations, one at a time, each red: afternoon added to the raptor's gate; evening dropped from the crawler's; the crawler's Attention row removed; one fig leg on a unique roll; the Edge west of the Fig; the Cathedral on the Thicket; the Cathedral northeast of the Thicket; the gully hint pointing north; the Veilbreak west of the Dens; Sunkwater unplaced; the time gates removed (also fails the shared suite's `timeGates`); the chip removed from both legs (also fails `newFieldChips`).

**Probe (Q9).** Cloud `default`, worktree against `2f45261a5`, interleaved; rubric scored blind before the key (grounding, second person with no player voice, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5; per narrated turn, 0–5).

| Batch | World text | Runs per arm | Leaks (worktree / old) | Choices ok | Stat ok | Flagged (worktree / old) | Rubric per turn (worktree / old) |
|---|---|---|---|---|---|---|---|
| 1 | before the review fold-ins | 5 | 0 / 0 | 15/15 / 15/15 | 15/15 / 15/15 | 0 / 0 | 4.30 / 4.33 |
| 2 | final | 5 | 0 / 0 | 15/15 / 15/15 | 15/15 / 15/15 | 0 / 1 (TONE-GORE) | 4.75 / 4.35 |

- **Final text:** batch 2, 5 runs per arm, 4.75 against 4.35 per turn (4.75 against 4.40 on turns 2–3, which both arms narrate). A win.
- Batch 1 was a tie: 4.30 against 4.33, and 4.30 against 4.15 on turns 2–3.
- An authored narration opening has no turn-1 request, so turn 1 is scored only where an arm drew an action opening.
- Both arms share the misses: the narrator voices the player, and the Ember Speckle sometimes eases hunger instead of deepening it. No run has the crawler see the player or the raptor climb.
- **Q2 count.** Out-of-scene hunter mentions: 0 of 15 turns on each arm in batch 1, and 0 of 15 in batch 2. Every turn stays in the Drowned Hollow, where both hunters are present on both arms, so the count cannot show a Known In effect. `knownIn` stays on the root.
