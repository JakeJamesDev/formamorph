# 11: Art for Emberwatch

Status: done
Blocked by: 02, 04, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Emberwatch** has art in one style, and the world shows Image Visibility rules and a Map Background.

- Run the Art Harness (02) with this world's art-direction line from ticket 04, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set complementary rules on slot 0 and slot 1 by script, since play shows the first visible image and an unruled slot 0 always wins. A location rule with no owner reads the played persona.
- **Canvas layout (Q25):** the content ticket placed every location by the lore. Set the Map Background frame so the drawn map agrees with those positions, and generate the map from the same layout: a place that is north on the canvas is north on the map. You may move nodes to fit the map as long as the overall layout stays similar (Q26); record each move in the comments.
- **Map Background (Q12):** one generated map image behind the Locations canvas. Set its frame in the editor so the drawn map lines up with the placed locations, and set the opacity. The world's coverage row claims `mapBackground`.
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` and `mapBackground` claimed in this world's row. (34 of 34 items hold art, 36 images plus the map; `bundledWorlds.test.ts` green with the row moved from PLANNED.)
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. (`emberwatchWorld.test.ts` › the Emberwatch Visibility rules: Faith 69/70 on the Wanderer, 97/98 of 140 on Albus, Hesk Health 40/39. Four mutations each fail a test: slot 0's Chapel rule removed, the Chapel unit set to raw, Hesk's slot 1 rule removed, Hesk's threshold moved to 39.)
- [x] The contact sheet is at `.scratch/frames/emberwatch-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] The Map Background shows behind the Locations canvas and the in-game Map at `.scratch/frames/emberwatch-map.png`, 1280 wide, light theme. (Playwright frames on the worktree's dev server: the full-screen canvas in `emberwatch-map.png`, the Change Location Map in `emberwatch-ingame-map.png`.)
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). (`npm run fingerprints`: 148 revisions, 90 fingerprints.)

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.

## Landed

**Not verified**

- No Visibility rule was flipped in a live game. The tests read the rules through `visibleImages` and `visibleLocationImages`, which play's gallery and backdrop hooks call.

**For you**

- For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes. (`.scratch/bundled-worlds-expansion-11/frames/emberwatch-sheet.png`)
- Judge the map against the canvas: `.scratch/bundled-worlds-expansion-11/frames/emberwatch-map-overlay.png` draws each root location's box on the stored map. `emberwatch-map.png` and `emberwatch-ingame-map.png` show it in the app.
- The map is the weakest image: no candidate in 42 drew a keep, a wall or a barrow field, so the stored map is a riverside town with fields to the north. The seven search sets are `emberwatch-map-set-1.png` to `-7.png`.
- Five nodes moved under Q26 (listed in the comments). Every compass sentence in the location text still holds; the river market sits south and a little east of the square.
- The Herbwife's Cottage text says thatched; its art has a shingle roof.
- The Chapel of the Ember blazes gold at Faith 70% for the played character. Mother Hesk shows wounded below 40% of her own Health.
- `emberwatch-face-fix.png` shows the 12 faces after Face Fix.

## Comments

**Art direction.** Every location and entity image used ticket 04's line as the positive prefix, with the Q21 preset. The map used its own prefix (spec-session ruling): `top-down fantasy map, illustrated cartography, muted earth tones, slate gray and heather green palette, warm ember orange accents, high detail`.

**Rulings (spec session).** The Chapel of the Ember on the played persona's Faith, owner-less, percent unit, no daypart, so `timeGates` stays with its three worlds. Mother Hesk on her own Health. One Map Background behind the root canvas, covering the ten root places; the keep's and the barrow's Group canvases get none. Q28 (user, mid-build): Face Fix on every portrait with a garbled or small face, through a new `--face-fix` harness option.

**Harness change (Q28).** `--face-fix` sets the provider's `adetailer` for the run, and the run log keeps it in each request. With `--replay` it adds the pass at the stored seed and prompt (`withFaceFix`), so a portrait keeps its composition. Two unit tests, one per path; each fails with its wiring removed.

**Face Fix.** Replayed at their stored seeds with Face Fix on: Wanderer, Sylvie Thornwhistle, Mother Hesk (both slots), Corvin Vale, Captain Orrin Blackwell, Wenna Tallow, Bram Oakes, Sergeant Ilsa Marr, Bryony Fenn, Mara Venn, Reeve Godric Holt, Hob Wainwright. Albus and Jory Pike have large faces and read clean; the rest are creatures, undead or hooded.

**Extra negatives per pass.** Every pass also carried `nsfw, suggestive, sexualized, revealing clothing, cleavage, bare shoulders, midriff, text, watermark`. No entity is written as a child, and the sheet shows none.

| Pass | Extra negative |
|---|---|
| Redo 1, Barrow, Boundary Wall, Watchtower | `house, cottage, cabin, castle, archway, wagon, cart, indoors` |
| Redo 1, Herbwife's Cottage, Frontier Road, Ashford Square | `indoors, interior, hallway, statue, sculpture, wagon` |
| Cold Lights (redo 1, 2) | `obelisk, tower, monument, building, person, character, creature`; then `fire, flame, campfire, obelisk, person, character` |
| Grave Hounds, Barrow Dead (redo 1) | `solo, fur, living animal, knight, plate armor` |
| Grave Hounds (redo 2, 3) | `humanoid, skeleton person, giant, person, standing on two legs`; then `fur, living dog, humanoid, person, giant` |
| Blackwell | `young, boy, helmet` |
| Ashford Square (redo 2) | `statue, shrine, fire, brazier` |
| Old Watchtower (redo 2, 3) | `lighthouse, rooftop, roof tiles, castle, intact`; then `interior, indoors, colonnade, pillars, corpse, person, lighthouse, castle` |
| Barrow (redo 2, 3, 4) | `arch, archway, cart, wagon, well, house`; `pyramid, arch, house, cart, fire, glow`; `wheelbarrow, cart, pyramid, arch, house, fire, glow` |
| Mother Hesk#1 (second try) | `multiple people, 2girls, lying down, patient, bed, bare legs` |

**Redos and their stored seeds.** Each redo used Compel weights on the subject; the stored `imageTags` are the plain form and describe the stored art. Hard subjects got two candidates, and the pick is named.

| Item | Miss | Weighted prompt subject | Stored seed |
|---|---|---|---|
| The Boundary Wall#0 | a cottage with lanterns | `(long stone defensive wall)1.4, (battlements)1.3` | 1883338800 |
| The Herbwife's Cottage#0 | an interior hall | `(thatched cottage)1.4, exterior, (herb garden)1.3` | 1299989816 |
| The Frontier Road#0 | a wagon filling the frame | `(dirt road)1.4, (open heathland)1.3, (mossy standing stone)1.3` | 2017573207 |
| Barrow Dead#0 | one knight | `(skeleton soldiers)1.4, (multiple skeletons)1.3` | 854328575 |
| Captain Orrin Blackwell#0 | a young man | `(old man)1.3, (male human soldier)1.2, (gray hair)1.2` | 334274341 |
| Ashford Square#0 | a statue on the plinth; then a fire shrine | `(market square)1.4, (market stalls)1.3` | 1176765206 |
| Cold Lights#0 | an obelisk; then one large flame | `(will-o'-the-wisp)1.4, (many small floating blue lights)1.4` | 1993014914 |
| The Old Watchtower#0 | a castle through an arch; a lighthouse on a roof; a ruined interior with a body | `(lone stone tower)1.4, (ruins)1.3, (crumbling tower on a hilltop)1.3`, candidate A of two | 1658659575 |
| Grave Hounds#0 | one living dog; a giant skeleton with dogs | `(skeletal dogs)1.5, (undead dogs)1.4, (three skeletons of dogs)1.3`, candidate A of two | 1950693171 |
| The Barrow Beyond the Wall#0 | a cottage; an arch with a cart; a pyramid; a wheelbarrow twice | `(burial mound)1.4, (tumulus)1.3, (grassy mound)1.3, (dark stone doorway in the mound)1.3`, candidate C of two | 903952230 |
| The Captain's Hall#0 | a glowing crystal on the table, no map table (spec review, Q10) | `(long map table)1.4, (maps spread on the table)1.2, (cold stone hearth)1.3`, candidate G of two | 768150667 |
| The Old Watchtower#0 (again) | an intact clock tower, not the cracked tower with half its roof gone (spec review, Q10) | `(ruined stone watchtower)1.4, (half-collapsed roof)1.4, (cracked walls)1.3`, candidate H of two | 1598789485 |
| The Barrow Wight#0 | a flaming crown and plate armor, not rotted mail and ember eyes (spec review, Q10) | `(rotted chainmail)1.3, (broken iron crown)1.3, (glowing ember eyes)1.3`, candidate G of two | 1731295687 |

The spec-review redos used the extra negatives `crystal, gem, glowing crystal, fire in hearth, person` (hall), the watchtower's redo-3 set plus `intact roof, clock`, and `fire, flames, flaming crown, plate armor` (wight).

Lesson for later art tickets: "barrow" draws a wheelbarrow, "map" draws a paper map on the ground, and "burial mounds" alone draws animals on this model. Name the shape (`tumulus`, `grassy mound`) instead.

**First-pass seeds** (kept): Emberwatch Keep 549278094 · The Cinder and Crown 1263360015 · Chapel of the Ember#0 184183231 · The Bier Chamber 39620459 · The Smithy 1736383509 · Riverside Market 402443554 · The Hall of Shields 863858651 · The Sorcerer's Vault 1312738212 · Wanderer 42552921 · Albus 1559606621 · Sylvie Thornwhistle 49146395 · Mother Hesk#0 532754422 · Corvin Vale 298040958 · Wenna Tallow 861021149 · Bram Oakes 487741770 · Sergeant Ilsa Marr 1874785703 · Bryony Fenn 1103252227 · Jory Pike 985766395 · Mara Venn 1996850418 · Reeve Godric Holt 849075926 · Hob Wainwright 1208358862 · The Shade of Maelis 35138398.

**Refined `imageTags`.** Every redone item, plus The Hall of Shields, whose first-pass art shows no shields. The spec review found three first-pass images that contradicted the lore rather than drifted from their tags (Q10), so those were redone, not retagged.

**Visibility rules (Q18).** Both pairs use complementary rules and share a seed, so slot 1 is slot 0's scene in its new state.

- Chapel of the Ember: slot 0 at Faith < 70%, slot 1 (towering golden flame, beams of holy light) at Faith ≥ 70%. No owner, so it reads the played persona's Faith, on that persona's own max: a Paladin's 140 flips at 98. Slot 1 is seed 184183231 with `(towering golden flame)1.4, (beams of holy light)1.3, (radiant)1.2, glowing runes on the walls` added.
- Mother Hesk: slot 0 at Health ≥ 40%, slot 1 (bandaged head and arm, cuts, torn vestments, leaning on her staff) below 40%. Slot 1 is seed 532754422 with Face Fix and `solo, (wounded)1.3, (bandage on head)1.3, bandaged arm, bruised face, frost on clothes, torn vestments, (leaning on staff)1.2, exhausted, standing`. The first try at that seed drew a lightly dressed patient on the floor; it was rejected before storage.

**Map Background (Q12, Q25, Q26).** Candidate 30, seed 1970124228, mirrored left to right after generation, then encoded through the app's lossless WebP encoder. Frame x −150, y 250, width 1800, height 1231.58; opacity 0.6.

- Seven prompt sets, 42 candidates. Set 1 (`walled town`) gave one close-up ring wall each. Set 2 (`wide valley`, `small castle`) gave oblique views with fairy-tale castles. Set 3 (`map`) drew paper maps on the ground. Set 4 gave oblique, bright views. Set 5 gave top-down, muted towns with rivers. Sets 6 and 7 (`hamlet`, `burial mounds`) drew animals. No candidate drew a keep, a wall or a barrow field; the user directed two more sets after set 5, then the best pick with Q26 moves.
- The stored map's tags: `(top-down)1.4, (aerial view)1.2, (many small houses)1.3, small town, (river)1.3, (burial mounds)1.2, heathland, dirt road, ridge, fields, forest, no humans`, with the extra negative `text, letters, labels, watermark, horizon, sky, people, character, person lying, sea, ocean, island, coast, circle, ring, round wall, arena, close-up, paper map, barrel, perspective`.
- Mirrored, the river runs down the southeast past the market and the cottage. The fields north of the town hold the barrow.
- Q26 moves: The Barrow Beyond the Wall (800, 0) → (760, 280), into the north fields inside the frame; Emberwatch Keep (820, 820) → (720, 760), off the river's bend; Ashford Square (940, 1060) → (880, 1060), off the bank; Riverside Market (940, 1300) → (1100, 1380), onto the west bank below the town, so it stays south of the square (first placed at (1180, 1300), which read mostly east; spec review); The Herbwife's Cottage (1260, 1400) → (1440, 1360), onto the east bank. North-to-south order and every compass sentence still hold, and `emberwatchWorld.test.ts` › the map stays green.

**Test worker heap (spec-session ruling C).** Prepare's affected-tests gate died with "JavaScript heap out of memory": the Main Menu seeder parses every bundled world on each mount, and `emberwatch.json` is now 54 MB beside Rampage's 55 MB and Drone's 40 MB. Run alone, `MainMenu.ageGate.test.tsx` peaked at 3,160 MB of heap. Its slowest tests: "drops an explicit answer when the login dialog is canceled" 10.9 s idle against 0.9 s usual, and "cannot finish the login callback for an account replaced during persistence" 7.8 s idle against 0.8 s usual. This ticket carries a stopgap: test forks get `--max-old-space-size=8192` in `vite.config.js`. The next prepare then died in the main vitest process at 4 GB (exit 134), since vite transforms the world JSON there, so `scripts/runTests.mjs` passes the same flag to that process. Ticket 23 replaces it with image-stripped bundled worlds for the tests that mount the Main Menu.

**File size (Q13).** `src/defaultworlds/emberwatch.json`: 215,479 bytes (0.21 MB) before, 54,376,745 bytes (51.86 MB) after, all new images lossless WebP.
