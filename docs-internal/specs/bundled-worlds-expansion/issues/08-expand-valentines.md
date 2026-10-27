# 08: Expand Valentines

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Valentines Survival** grows from 7 locations and 7 entities to at least 12 and 15, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Valentines keeps the Agility script and the hidden Pursuit stat.

- Grow Ashburn High: the library, the cafeteria, the locker rooms, the art wing, the bus loop, each with admirers, allies, and staff.
- Relationship labels across the cast: rivals, best friends, the teacher who covers for the student. A chip where a label carries a rolled name.
- **Assigned features:** Relationship labels.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Canvas layout (Q25):** store a `canvasPosition` for every location, old and new, placed by the lore within each Group's canvas: north is up, east is right, a far place sits farther than a near one, and no two nodes overlap at the grid size.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [x] The world has at least 12 locations and 15 entities, every one with `imageTags`, and the stripped diff is ready for review. 12 and 15; `.scratch/bundled-worlds-expansion-08/frames/valentines-stripped.diff`.
- [x] The world's coverage row claims `relationships`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions. `bundledWorlds.test.ts`, 86 passed and 1 skipped; `visibilityRules` stays planned for ticket 15.
- [x] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once. No new script or Tool. Twelve tests in `valentinesWorld.test.ts` cover the map, the canvas and the labels; nine world mutations each fail the named test (Comments).
- [x] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments. Win on the final text, 43.5 to 41.5 over 10 runs per arm.
- [x] Every location has a `canvasPosition` that matches the lore's directions and distances, shown in `.scratch/frames/valentines-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme. Playwright at 1280 × 900; root plus school, hallway, gymnasium and courtyard frames.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments.
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). `npm run fingerprints` on the final world.

## Landed

**Not verified**

- The art-direction line is not yet in the spec's Comments: the spec session folds it in from the landing message.

**For you**

- For you: read one transcript per opening and judge whether the new places feel like the same world. Final text, new world: action opening `.scratch/bundled-worlds-expansion-08/frames/valentines-b2-run1-A.md`, group-chat opening `.scratch/bundled-worlds-expansion-08/frames/valentines-b2-run8-A.md`, authored openings `.scratch/bundled-worlds-expansion-08/frames/valentines-b2-run3-A.md` and `.scratch/bundled-worlds-expansion-08/frames/valentines-b2-run10-A.md`.
- Look at the canvas layout: `.scratch/bundled-worlds-expansion-08/frames/valentines-canvas.png` and the four Group frames beside it.
- Skim the stripped world diff: `.scratch/bundled-worlds-expansion-08/frames/valentines-stripped.diff`.
- The stored Hana Sakuragi portrait shows a short-haired boy; her text and `imageTags` say a girl with long hair. Art ticket 15 should redo it.

## Comments

**Art direction (Q16).** `anime illustration, soft cel shading, clean lineart, pastel pink and cream palette, warm red accents, bright winter afternoon light, gentle bloom, playful romantic comedy mood, high detail`. Matched to the stored thumbnail (a soft pink hallway, cel-shaded uniforms).

**Rulings (spec session).** All six as proposed: the map with the main building north, Courtyard and Front Gate south, Gymnasium east, Bus Loop west; the Bus Loop is no exit; the Library's no-food rule; the eight new cast; the labels with the player end on `you` and the Vice President chip on Hana's label to The Swarm; scripts, stats, openings and start unchanged. Later ruling on new evidence: Ren Takeda comes off `you` (his rivalry is in his description), Best Friend and Mr. Kuroda stay, and Kuroda is counted in batch 1.

**Note for the spec.** A Relationship label that ends on `you` makes its owner known in every scene (`knownPulledIds` in `chipValues.ts`). Kuroda's label passed the count: he entered 0 of 30 worktree turns in batch 1 and 0 of 30 in batch 2.

**What changed.**

- **Map.** Five new places: Library and Art Wing under the Second-Floor Hallway, Cafeteria and Bus Loop under Ashburn High, Locker Rooms under the Gymnasium. Eight new Connections with hints both ways. The Art Wing sits at the hallway's west end and the Library at its east end: the first proposal had them the other way, which put the Art Wing's fire escape on the far side of the building from the Bus Loop.
- **Cast.** Eight new people: Ms. Fujimura, Mr. Kuroda, Mei Tachibana, Rin Hayama, Ren Takeda, Mrs. Okabe, Haruto Mori, Mr. Gonda. Fujimura, Kuroda and Rin set Known In. The Swarm adds the Cafeteria and Bus Loop; Coach Daizen adds the Bus Loop and Guard Post gains "the bus loop". The named cast has pronouns; the rolled Best Friend has none.
- **Relationships.** Hana → The Swarm carries her rolled Vice President, which her description names too. Best Friend → you, Kuroda → you, Rin → Hana, Coach Daizen → Ren, Mei → Kuroda, Haruto → Okabe, Kenta → Hana.
- **Lore.** One Almanac entry per new place.
- **Canvas (Q25).** The main building is north, with the Rooftop above the classroom. The Courtyard is south with the Front Gate on its south edge, the Gymnasium is east of the building and the courtyard, and the Bus Loop is west. Ashburn High, the hallway, the classroom, the rooftop, the gym, the courtyard and the gate gained a compass sentence.
- **Readme.** "How this world is built" names Relationship labels, the rolled label and Connections.

**Tests.** `valentinesWorld.test.ts` gains twelve: reachability through the app's travel graph, the fence path with hints both ways, placement and overlap, three compass checks, the Vice President chip for each roll, and which ties end on you for the Custom Persona and a library persona. Mutations, one at a time, each failing the named test: the chip replaced by text (also fails `shows newFieldChips`); the fence path removed; the Library cut off the map; the Library onto the Art Wing; the Gymnasium under the hallway; the Gymnasium west of the courtyard; Ren back on `you`; Kuroda off `you`; the Best Friend's label removed. The canvas overlap test repeats Slime's; moving it into the shared harness touches files ticket 07 may hold, so it stays a follow-up.

**Review fold-ins.** Positive wording on the Library, Fujimura and the Bus Loop; the fence hints name the fence, not "south"; the Gymnasium moved east of the building; Daizen's label to Ren reads "second-fastest sprinter" to match Ren's text; the readme claims only what the world holds; the map tests call `reachableFromStarts` and `effectiveDestinations` instead of a copy of the walk; the label tests check the tie and the rolled name, not the authored prose.

**Probe (Q9).** Cloud `default`, Valentines, worktree vs `2f45261a5`, interleaved, no Tool. Rubric: scene grounding, 2nd person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5; graded blind by a fresh subagent on shuffled, relabeled transcripts.

| Batch | Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Choices ok | Stat ok | Flagged | Errors | Rubric |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | worktree | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 39.5 / 50 |
| 1 | 2f45261a5 | 10 | 30 | 3 | 0 | 0 | 27/27 | 27/27 | 0 | 0 | 33.5 / 50 |
| 2 | worktree | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 43.5 / 50 |
| 2 | 2f45261a5 | 10 | 30 | 0 | 0 | 0 | 30/30 | 30/30 | 0 | 0 | 41.5 / 50 |

**Decision: batch 2 on the final text, 43.5 to 41.5, a win of 0.2 per run.** Batch 1 ran before the review fold-ins. Its old arm lost one run to three empty turns (scored 0); without that run in both arms it reads 35.5 to 33.5. Pooled over both batches: 83 to 75. Score tables: `.scratch/bundled-worlds-expansion-08/frames/valentines-b1-blind-scores.md`, `valentines-b2-blind-scores.md`.

- No transcript in either batch names a new person uninvited. The Art Wing comes up as a route off the hallway, on its west side.
- Batch 2's low score (2 / 5) is an old-arm run that turned Hana into a generic admirer.
