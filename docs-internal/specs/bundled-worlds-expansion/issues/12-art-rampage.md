# 12: Art for Rampage

Status: done
Blocked by: 02, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **City Rampage** has art in one style, and the world shows Image Visibility rules and a Map Background.

- Run the Art Harness (02) with this world's art-direction line from ticket 05, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set the rule by script. A location rule with no owner reads the played persona.
- **Canvas layout (Q25):** the content ticket placed every location by the lore. Set the Map Background frame so the drawn map agrees with those positions, and generate the map from the same layout: a place that is north on the canvas is north on the map.
- **Map Background (Q12):** one generated map image behind the Locations canvas. Set its frame in the editor so the drawn map lines up with the placed locations, and set the opacity. The world's coverage row claims `mapBackground`.
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` and `mapBackground` claimed in this world's row. (`bundledWorlds.test.ts`, the row moved from PLANNED.)
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. (`rampageWorld.test.ts` › the Visibility rules, 39/40 and 74/75; both red with slot 0's rule removed.)
- [x] The contact sheet is at `.scratch/frames/rampage-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] The Map Background shows behind the Locations canvas and the in-game Map at `.scratch/frames/rampage-map.png`, 1280 wide, light theme. (Playwright frames: the canvas full-screen in `rampage-map.png`, the Change Location Map in `rampage-ingame-map.png`.)
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

## Landed

**Not verified**

- No Visibility rule was flipped in a live game. The tests read the rules through play's gate functions.

**For you**

- For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes. (`.scratch/bundled-worlds-expansion-12/frames/rampage-sheet.png`)
- Neonspire Stadium shows an emptied stadium with a helicopter on the field, not the crowd its text describes; redo by name if the crowd matters.
- Judge the map against the canvas: `.scratch/bundled-worlds-expansion-12/frames/rampage-map-overlay.png` draws every location box on candidate 19 in its stored frame. `rampage-map.png` and `rampage-ingame-map.png` show it in the app.
- Downtown Core turns to ruins at Destruction 40; Aegis-One leaves its hangar at Alert Level 75.

## Comments

**Art direction.** Every location and entity image used ticket 05's line as the positive prefix, with the Q21 preset. The map used its own prefix (spec-session ruling): `top-down city map, illustrated cartography, muted concrete gray and slate blue palette, rust red accents, high detail`.

**Extra negatives per pass.**

| Pass | Extra negative |
|---|---|
| Crowds and families (Cedar Hollow Evacuees, Stadium Crowd, Stalled Drivers, Last Ferry, Stranded Commuters) | `nsfw, suggestive, sexualized, revealing clothing, cleavage, bare shoulders, midriff` |
| Redo 1, scenes and machines | `robot, mecha, humanoid robot, lighthouse, tower, reactor core, furnace, jet, airplane` |
| Redo 1, people | the crowd negatives plus `robot, mecha, spaceship, aircraft, warship, cannon` |
| Industrial Yards, Bayline Refinery (redo 2) | `warehouse, box, robot, mecha, furnace, reactor core` |
| Last Ferry, Rooftop Missile Team (redo 2) | `nsfw, suggestive, sexualized, revealing clothing, cleavage, warship, aircraft carrier, battleship, canal, flying, jetpack, midair, robot, mecha` |
| Last Ferry (redo 3) | `nsfw, suggestive, street, road, cars, city street, warship, aircraft carrier` |
| Variants | `hangar, indoors` |
| Downtown Core#1 (replay) | `(humans)1.5, (person)1.5, 1boy, 1girl, solo, figure, corpse, blood` |

No entity is written as a child. The crowd and family passes ran with the safety negatives anyway, and the sheet shows no child in focus.

**Redos and their stored seeds.** Each redo used Compel weights on the subject; the stored `imageTags` are the plain form and describe the stored art.

| Item | Miss | Weighted prompt subject | Stored seed |
|---|---|---|---|
| The Creature#0 | a tower in the water, no creature | `(giant kaiju)1.4, (monster)1.3, reptile, dorsal spines, roaring` | 1138592381 |
| Industrial Yards#0 | one round furnace; then a warehouse box | `(oil storage tanks)1.4, (freight train)1.3, railyard, (cranes)1.2` | 2019926004 |
| Bayline Refinery#0 | one round furnace; then weak | `(oil refinery)1.4, (cylindrical storage tanks)1.3, (flare stack)1.3` | 1882253537 |
| Neonspire Stadium#0 | a machine on the field | `(stadium)1.3, domed roof, floodlights` | 495422506 |
| Drone#0 | a jet | `(quadcopter)1.4, (drone swarm)1.3` | 441286961 |
| General Vasquez#0 | a vehicle, no person | `(1woman)1.3, mature female, (military officer)1.3` | 1589326722 |
| Rooftop Missile Team#0 | a flying machine; then one soldier in midair | `(3 soldiers)1.3, (standing on rooftop)1.3, (rocket launcher on shoulder)1.3` | 4958443 |
| Combat Engineers#0 | tiny people | `(soldiers)1.3, multiple boys, hard hats` | 1841096039 |
| Last Ferry#0 | a warship; a carrier in a canal; a ship on a street | `(ferry)1.4, (on the sea)1.4, harbor, waves` | 21090139 |
| Cedar Hollow Evacuees#0 | one car, no people | `(family)1.3, (crowd)1.2` | 670504582 |
| Refinery Fire Crew#0 | a fire truck, crew tiny | `(firefighters)1.4, multiple boys` | 1734834803 |
| Downtown Core#1 | a person lying in the rubble, twice | variant tags plus `(no humans)1.4, (empty city)1.2`, through a hand-written replay log | 623801977 |

**First-pass seeds** (kept): Harbor District 266549940 · Ferry Terminal 696468029 · Downtown Core#0 1139172078 · Spire Tower 241814021 · Metro Underground 2079035936 · Harborgate Bridge 2095222638 · Old Town 1217885174 · Fort Bastion 519401729 · Cedar Hollow 1047415640 · Battle Tank 2051060009 · Attack Helicopter 1419819286 · Jet Fighter 1511209493 · Aegis-One#0 1319942801 · Channel 8 News Chopper 315114458 · Police Cordon 30684722 · Navy Destroyer 570261562 · Stranded Commuters 113248907 · Stalled Drivers 650663628 · Stadium Crowd 405559356 · Artillery Battery 1051968860 · Dr. Lena Sorensen 1871130802 · Captain Theo Ward 373214243. Neonspire keeps its existing JPEG.

**Visibility rules (Q18).** Both pairs use complementary rules, so the image really swaps in play (spec-session ruling; a lone ruled slot 1 behind an unruled slot 0 never becomes the backdrop, since play shows the first visible image).

- Downtown Core: slot 0 at Destruction < 40, slot 1 (ruined skyline, collapsed towers, fires) at Destruction ≥ 40. Destruction is global, so the owner-less rule reads global scope.
- Aegis-One: slot 0 (hangar) at Alert Level < 75, slot 1 (deployed in ruined streets, seed 824852066) at Alert Level ≥ 75. Slot 1 was made with the tags `giant mecha, military prototype, cockpit` plus `(deployed)1.2, (standing in ruined city street)1.3, battle stance, smoke, rubble`; the stored tags describe slot 0.

**Map Background (Q12, Q25, Q26).** Candidate 19, seed 396050336, not mirrored. Frame x −70, y −240, width 1650, height 1128.95; opacity 0.6. (The message to the spec session named seed 1718919981; that seed is another candidate. The run log `map-c19-*.json` holds 396050336.)

- Six prompt sets, 36 candidates: cartography tags gave islands in open sea; map and aerial tags gave a river through a dense city with no sea edge; "estuary, river flowing into the sea" gave open sea. The bar's bay was not reachable with text-to-image on this model. The spec session accepted candidate 19 with the coast implied off the south edge.
- The river runs north to south between Downtown Core and Old Town, and the drawn bridge lands on the line between them. No district sits on water.
- Per the user's ruling (Q26), the Harbor District moved from (420, 520) to (540, 540), onto the west bank where the river opens south. Its "south shore" text still holds. A lower frame would put Old Town in the river, so the Harbor District sits above the frame's bottom edge.
- The map tags were `(top-down)1.4, (aerial view)1.2, (coastal city)1.4, (river)1.4, river mouth, (bay)1.3, harbor, street grid, docks, airfield, no humans`, with the extra negative `island, archipelago, continent, text, letters, labels, watermark, horizon, sky, people, character`.

**File size (Q13).** `src/defaultworlds/rampage.json`: 708,886 bytes (0.68 MB) before, 55,128,831 bytes (52.57 MB) after, all new images lossless WebP.
