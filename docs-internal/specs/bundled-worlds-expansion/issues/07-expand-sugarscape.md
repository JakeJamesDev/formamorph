# 07: Expand Sugarscape

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Sugarscape Survival** grows from 5 locations and 9 entities to at least 11 and 16, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Sugarscape keeps the hunger script, the pick counts, and the opening weights.

- Grow the Sugarscape: a licorice forest, the caramel caves, a marshmallow marsh, a toffee ridge, the seam's far side, each with its creatures and hazards.
- A Time of Day gate on the Daylight Seam: a trait or rule that holds only in daylight dayparts, so night changes what the seam allows.
- **Assigned features:** Time of Day gate.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Canvas layout (Q25):** store a `canvasPosition` for every location, old and new, placed by the lore within each Group's canvas: north is up, east is right, a far place sits farther than a near one, and no two nodes overlap at the grid size.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 11 locations and 16 entities, every one with `imageTags`, and the stripped diff is ready for review. 11 and 20; the build script checks `imageTags`; diff at `.scratch/bundled-worlds-expansion-07/frames/sugarscape-stripped.diff`.
- [x] The world's coverage row claims `timeGates`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. `bundledWorlds.test.ts` green, 86 tests.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. No new script or Tool; the Seam gate per daypart, the Licorice Flavor roll and the canvas each went red on a broken world file (seven mutations, see Comments).
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Final text, 9 scored runs per arm: 3.67 against 3.44, a win; structure clean.
- [x] Every location has a `canvasPosition` that matches the lore's directions and distances, shown in `.scratch/frames/sugarscape-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme. Frames at `.scratch/bundled-worlds-expansion-07/frames/sugarscape-canvas*.png`, Playwright at 1280 × 900; compass pairs and overlap checked in `sugarscapeWorld.test.ts`.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments.
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

For you: read one transcript per opening and judge whether the new places feel like the same world.

## Landed

**Not verified**

- The art-direction line is not yet in the spec's Comments: the spec session folds it in from the landing message.
- No probe run reaches the Stalefront, so no cloud transcript shows the seam open by day or dark at night. The gate is proven in `sugarscapeWorld.test.ts` only.

**For you**

- For you: read one transcript per opening and judge whether the new places feel like the same world. Final batch, worktree arm: `.scratch/bundled-worlds-expansion-07/frames/probe3-sugarscape-run1-worktree.md` through `run5`; the blind scores and key sit beside them.
- Check the map reads as the lore: the forest north, the ridge northeast, the marsh west, the shores south, the Stalefront far east and the Leftover Wastes behind it. `.scratch/bundled-worlds-expansion-07/frames/sugarscape-canvas.png` and the two Group frames beside it.
- Play to the Stalefront once by day and once after dark, and judge whether the Dark Seam reads as a fair twist rather than a trap.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-07/frames/sugarscape-stripped.diff`.

## Comments

**Art direction (Q16).** `whimsical 3d render, photorealistic food textures, glossy candy surfaces, soft focus background, pastel pink cream and mint palette, warm chocolate brown accents, golden hour sunlight, soft hazy glow, cozy playful mood, high detail`. Matched to the stored root backdrop and creature portraits.

**Rulings (spec session).** Q1: the far side is a real location behind the crust; by day the seam wins, at night it leads only there; it connects back on foot. Q2: two always-on traits on the Seam, evening on the dark side. Q3: 11 locations with Fudge Creek under Sundaelora and the caves under the ridge. Q4: the Licorice Flavor chip on both forest legs, one roll. Q5: Sundaelora stays the only start; openings and weights unchanged.

**What changed.**

- **Map.** Six new places: The Licorice Forest (north), The Marshmallow Marsh (west), The Toffee Ridge (northeast) with The Caramel Caves inside it, Fudge Creek inside Sundaelora, and The Leftover Wastes east of the Stalefront, behind its crust wall.
- **Connections.** Seven new, hints both ways: Sundaelora–Forest, Sundaelora–Marsh, Marsh–Shores, Forest–Ridge, Ridge–Dunes, Ridge–Stalefront, Stalefront–Wastes. The four old legs now read back the other way.
- **Time of Day gate.** The Daylight Seam holds two always-on traits: Open to Daylight (dawn to afternoon) carries the finale; Dark Seam (evening, night) says stepping through leads only to the Wastes. Both name what the seam does from the Wastes side. The system prompt names the seam as the way home and leaves the day and night branches to the traits.
- **Chip.** A new world placeholder, **Licorice Flavor**, with one placement on both forest legs, the forest's description and its lore entry.
- **Cast.** Eleven new entities: Fudge Otters, Licorice Constrictor, Jelly Bean Beetles, Puffmallow Toad, Fluffbog, Rock Candy Bats, Caramel Seep, Brittle Ram, Toffee Slide, Crust Crawlers, Stale Moths. The four place-bound hazards are Known In nowhere, so they never show up a region early. The Waypost, Saltlick Stones, Cream Cyclone and Seam joined new places.
- **Lore.** One entry per new region; The Stalefront entry states the daylight rule.
- **Map positions (Q25).** North up: Sundaelora in the middle, the forest north, the ridge northeast above the dunes, the marsh west, the shores south, the Stalefront far east, the Wastes past it. Old descriptions gained compass words so the text and the map agree.
- **Alias and key hygiene.** Generic aliases and keys were cut before they fired: `ram` matched "things that ram", `slide` the otters' "slide down", `caramel` the "salted caramel" Curse Fixation roll, `crumbs` every cookie-crumb scene.

**Tests.** `sugarscapeWorld.test.ts` gains 16: both Seam traits per daypart (12), the Licorice Flavor roll across both legs, the forest and its lore, and three canvas checks (every location placed, no overlap, the lore's compass pairs). Mutations, one at a time, each red: evening added to Open to Daylight; night dropped from Dark Seam; one forest leg on a unique roll; the Wastes west of the Stalefront; the Marsh on top of Sundaelora; the Shores straight south of the Marsh; the time gates removed (also fails the shared suite's `timeGates`).

**Probe (Q9).** Cloud `default`, worktree against `2f45261a5`, interleaved; rubric scored blind before the key (grounding, second person with no player voice, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5).

| Batch | World text | Runs per arm scored | Leaks (worktree / old) | Choices ok | Stat ok | Rubric mean (worktree / old) |
|---|---|---|---|---|---|---|
| 1 | before the review fold-ins | 5 | 0 / 0 | 15/15 / 15/15 | 15/15 / 15/15 | 3.20 / 2.80 |
| 2 | final | 4 | 0 / 0 | 12/12 / 12/12 | 12/12 / 12/12 | 3.88 / 3.13 |
| 3 | final | 5 | 0 / 0 | 15/15 / 15/15 | 15/15 / 15/15 | 3.50 / 3.70 |

- **Pooled on the final text:** batches 2 and 3, 9 runs per arm, 3.67 against 3.44 per run. A win. No flags in any batch.
- Batch 2's first run failed in both arms on the harness's `Enter World` click timeout, before any turn.
- Both arms share the same misses: the narrator writes the player's lines, and turns 2 and 3 play out the scripted action with nothing new added. No run breaks a world fact.
