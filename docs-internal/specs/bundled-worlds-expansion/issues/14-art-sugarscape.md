# 14: Art for Sugarscape

Status: done
Blocked by: 02, 07, 13, 23, 24
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Sugarscape Survival** has art in one style, and the world shows Image Visibility rules and a Map Background.

- Run the Art Harness (02) with this world's art-direction line from ticket 07, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed. A portrait whose face sits far from the camera and reads garbled is redone with Face Fix, the harness's `--face-fix` option (Q28); check every face before you store.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set complementary rules on slot 0 and slot 1 by script, since play shows the first visible image and an unruled slot 0 always wins. A location rule with no owner reads the played persona.
- **Canvas layout (Q25):** the content ticket placed every location by the lore. Set the Map Background frame so the drawn map agrees with those positions, and generate the map from the same layout: a place that is north on the canvas is north on the map. You may move nodes to fit the map as long as the overall layout stays similar (Q26); record each move in the comments.
- **Map Background (Q12):** one generated map image behind the Locations canvas. Set its frame in the editor so the drawn map lines up with the placed locations, and set the opacity. The world's coverage row claims `mapBackground`.
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` and `mapBackground` claimed in this world's row. (31 of 31 items hold art, 33 images plus the map; `bundledWorlds.test.ts` green with the row moved from PLANNED; the harness reports no Test Bench image findings. Sundaelora, Strawberrycream Shores and the thumbnail stay JPEG by the keep ruling; every new image and the map are WebP.)
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. (`sugarscapeWorld.test.ts` › the Visibility rules: Stickiness 74 and 75, and all six dayparts. Moving the threshold to 76 and dropping evening from slot 1 turned both red.)
- [x] The contact sheet is at `.scratch/frames/sugarscape-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] The Map Background shows behind the Locations canvas and the in-game Map at `.scratch/frames/sugarscape-map.png`, 1280 wide, light theme. (Playwright frames on the worktree's dev server: the full-screen canvas in `sugarscape-map.png`, the Change Location Map after a new game in `sugarscape-ingame-map.png`.)
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). (`npm run fingerprints`)

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.

## Landed

**Not verified**

- No Visibility rule was flipped in a live game. The tests read the rules through play's gate functions, `visibleImages` and `visibleLocationImages`.

**For you**

- For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.
- The contact sheet is at `.scratch/bundled-worlds-expansion-14/frames/sugarscape-sheet.png`.
- Judge the map: `sugarscape-map-overlay.png` draws each node's box on it; `sugarscape-map.png` and `sugarscape-ingame-map.png` show it in the app. It is a map of dessert regions (img2img over a sketch), not a terrain painting.
- The Cursed reads as a young adult in this model's anime style; redo by name if the face reads too young.
- Weakest subjects: Saltlick Stones is one tall salt crystal, Toffee Slide a cracked toffee slab, Rock Candy Bats one crystal-winged bat with a large crystal, Puffmallow Toad a capped golden toad, The Daylight Seam a glowing split stump.
- The Stalefront's night slot draws the seam as a dark door with a red glow, not a plain crack.

## Comments

**Art direction.** Every location and entity image used ticket 07's line as the positive prefix, with the Q21 preset. The Stalefront's night slot swaps `golden hour sunlight, soft hazy glow` for `dim moonlight`.

**Rulings (spec session).** Keep the stored renders (Q10). Sundaelora keeps the image it shared with The Sugarscape; The Sugarscape gets a realm-wide backdrop. The Cursed's pair reads its own Stickiness at raw 75; The Stalefront's pair follows the Daylight Seam's dayparts; the Daylight Seam gets none. The Cursed is an adult, androgynous, fully clothed, with the safety negatives on every pass. Map over The Sugarscape Group's interior. User ruling (2026-10-26, after 30 failed map candidates): the map is image-to-image over a region sketch.

**Sugarscape lesson for later art tickets.** The words `photorealistic food textures` in the style line made the model draw one cake on a plate for 20 of 24 first-pass items. Leading each subject with weighted scene or animal tags, `(scenery)1.4` or `(toad)1.5`, plus the still-life negative fixed most of them. "Door" draws a building door even with door negatives.

**Extra negatives per pass.**

| Pass | Extra negative |
|---|---|
| First pass, every item | `nsfw, suggestive, sexualized, revealing clothing, cleavage, bare shoulders, midriff, multiple views, comic panels, panel border, split screen, speech bubble, child, loli, shota, teenage, petite` |
| Redos, sweet places and creatures | the first-pass set plus `cake, cupcake, layered cake, plate, single dessert, still life, food photography, close-up, table, indoors, room, window, wooden door, humans, person, 1girl, 1boy`; round 2 adds `water, blue river, bottle, box, ice cream cone, hay, gray rocks` |
| Redos, stale places and creatures | the sweet set plus `pink, pastel, colorful, frosting, chocolate, sweets, candy, rainbow`; the Daylight Seam adds `door, doorway, arch, door frame, stone wall, building, ruins, green, plants` |
| The Cursed | the first-pass and still-life sets plus `pajamas, long hair, multiple people`; slot 1 adds `clean clothes, crown, candles, hat, clean` |
| The Sugarscape (round 3) | the sweet set plus `painting, anime, purple mountains, ice cream cone` |

**Stored seeds.** One candidate per round; the stored `imageTags` are the plain form and describe the stored art. Kept from the first pass: Brittle Ram 377637611. Kept stored renders: Sundaelora, Strawberrycream Shores, Cream Cyclone, Gummy Bear, Peppermint Pouncer, Sprinkle Swarmers, Cookie Brawler.

| Item | Miss before | Weighted prompt subject | Stored seed |
|---|---|---|---|
| The Sugarscape#0 | Sundaelora's image; then a cone on gray rock; then purple painted mountains | `(rolling pastel pink and mint ice cream hills)1.5, (lollipop trees)1.2, (thin gray strip on the far horizon)1.2` | 135924037 |
| The Candy Dunes#0 | a cake; then plain sand | `(pastel sugar sand dunes)1.3, (giant striped hard candy rocks)1.4` | 77684422 |
| The Stalefront#0 | a cake in a room | `(gray)1.4, (desaturated)1.3, (glowing door-shaped crack of daylight standing in the ground)1.3` | 63297035 |
| The Stalefront#1 (variant) | new slot | slot 0's subject at night: `(night)1.5, (dark sky)1.3, (dark door-shaped crack standing in the ground)1.3, (unlit dark crack)1.3`, at slot 0's seed | 63297035 |
| Fudge Creek#0 | a sundae; then a water river | `(brown chocolate river)1.5, (melted fudge stream)1.3` | 585277111 |
| The Licorice Forest#0 | a hanging truffle | `(forest)1.3, (twisted black licorice trees)1.3` | 851730718 |
| The Marshmallow Marsh#0 | s'mores on a table | `(swamp)1.3, (marshmallow ground)1.2` | 1631840869 |
| The Toffee Ridge#0 | a cake; then gray rock | `(glossy translucent amber toffee cliffs)1.5, (golden caramel rock)1.3` | 810718298 |
| The Caramel Caves#0 | a cake | `(cave interior)1.4, (dripping caramel stalactites)1.3` | 1704364622 |
| The Leftover Wastes#0 | a cake | `(gray wasteland)1.4, (desaturated)1.4` | 942675445 |
| The Cursed#0 | a young woman indoors in pajamas | `(adult)1.4, (androgynous)1.3, solo, (outdoors)1.3, cowboy shot, short hair, (traveler's coat)1.2` | 33301392 |
| The Cursed#1 (variant) | new slot; then barely sticky, with a crown | slot 0's subject plus `(covered in dripping pink frosting)1.6, (melted caramel dripping down the coat)1.6, (syrup dripping from hair)1.5`, at slot 0's seed | 33301392 |
| Gingerbread Waypost#0 | a cake under a sign | `(signpost)1.4, (gingerbread man shaped signpost)1.3` | 265851294 |
| Saltlick Stones#0 | a cake; then hay bales | `(white salt crystal boulders)1.5, (pure white rocks)1.3` | 685155203 |
| The Daylight Seam#0 | a cake by a door; then a door twice | `(vertical rift of white light)1.5, (glowing crack)1.4, split in a gray crust cliff` | 332390779 |
| Fudge Otters#0 | an otter on a cake plate | `(otters)1.4, animal focus` | 1740611533 |
| Licorice Constrictor#0 | a willow tree | `(snake)1.4, (black licorice snake)1.3` | 265801552 |
| Jelly Bean Beetles#0 | a candy cushion | `(beetles)1.5, (insects)1.3` | 1394585648 |
| Puffmallow Toad#0 | a cake; then a brown frog | `(toad)1.4, (white marshmallow body)1.5` | 1049006383 |
| Fluffbog#0 | a stacked cake | `(sinkhole)1.4, (bog)1.3` | 1191773182 |
| Rock Candy Bats#0 | a cake; then falling bottles | `(bats)1.5, (clear crystal wings)1.4` | 890646759 |
| Caramel Seep#0 | a cupcake | `(cave floor)1.3, (flowing molten caramel)1.4` | 1329165910 |
| Toffee Slide#0 | a cake; then a box in a canyon | `(rockslide)1.5, (falling amber toffee shards)1.4` | 571601152 |
| Crust Crawlers#0 | a crab on a cake | `(crab)1.5, (gray)1.3, (desaturated)1.3` | 745499079 |
| Stale Moths#0 | a moth on a cake | `(moths)1.5, (swarm of gray moths)1.3` | 438946493 |

**Review fold-ins.** Five tags moved back toward their subjects while still describing the art: The Toffee Ridge drops the stray creature; Puffmallow Toad, Rock Candy Bats, Crust Crawlers and Stale Moths keep their candy or stale material. The Visibility test block now repeats Slime's shape twice; a third world should move it into `bundledWorldHarness`.

**Owner-term guard.** One new image's base64 spelled "holder" by chance, so `ownerTermGuard` now strips `data:` URIs before it matches; the new "image bytes" case fails with the strip removed.

**Prepare and ticket 24.** Prepare twice died in the affected tests with the main vitest process at its 4 GB heap limit (exit 134, about 246 s), every reported file green. User ruling: the clean fix is its own unit, ticket 24 (tests never transform world images); this ticket waits for it and reruns prepare on top. Ticket 24 landed at a4c1f6adb.

**Face Fix (Q28).** Not used. The Cursed's two faces read clean at full size; no other entity has a face to fix.

**Visibility rules (Q18).** Both pairs use complementary rules, so the image swaps in play.

- The Cursed: slot 0 at Stickiness < 75, slot 1 (frosting and caramel all over the coat) at Stickiness ≥ 75, raw unit. The rule reads the Cursed's own stat.
- The Stalefront: slot 0 (the seam lit with daylight) at dawn, morning, midday and afternoon, slot 1 (the seam dark under stars) at evening and night. A daypart rule reads the story clock, so it needs no owner.

**Map Background (Q12, Q25, Q26).** Image-to-image over a region sketch, seed 3001, strength 0.6, through the app's lossless WebP encoder. Frame x −60, y −304, width 1900, height 1300; opacity 0.6. No Q26 moves: every node sits on its region in `sugarscape-map-overlay.png`.

- Text-to-image: five prompt sets, 30 candidates, `sugarscape-map-set-1.png` to `-5.png`. Set 1 (`top-down candy land map`) drew one dessert in a forest clearing six times. Set 2 (`world map`) drew abstract continents and spiky splats. Set 3 (`aerial view, landscape from above`) drew a round clearing with robots. Set 4 (`fantasy map`) drew a paper map lying on snow. Set 5 (`aerial photograph`, no "map") drew craters, a plane and square forts. Every set put one object in the center.
- Image-to-image (user ruling): a flat block sketch at strength 0.7 to 0.88 kept the blocks as texture tiles (`sugarscape-map-i2i-a.png`). An illustrated sketch with tree dots, peaks, waves and dune arcs (`sugarscape-map-sketch.png`, drawn by `sugarscape-map-sketch.py`) at strength 0.6 and 0.72 gave six maps that keep the compass (`sugarscape-map-i2i-b.png`); 3001 at 0.6 has the river and the fewest stray figures. The one-off script is `sugarscape-map-img2img.mjs`.
- The stored map's prompt: `top-down illustrated cartography, glossy candy surfaces, pastel pink cream and mint palette, warm chocolate brown accents, high detail, (aerial view)1.4, (top-down)1.3, candy land terrain, dark licorice forest, glossy amber toffee mountains, white marshmallow swamp, mint and pink ice cream hills, winding chocolate river, pale sugar sand dunes, strawberry cream sea, (gray stale wasteland)1.3, colors draining to gray, (no humans)1.4`, with the extra negative `text, letters, labels, watermark, people, character, perspective, horizon, sky, paper map, parchment, border, frame, robot, vehicle, humans, person, animal, grid, tiles, squares, texture`.

**File size (Q13).** `src/defaultworlds/sugarscape.json`: 2,427,855 bytes (2.32 MB) before, 39,267,231 bytes (37.45 MB) after, every new image and the map lossless WebP. The thumbnail stays the stored JPEG, which is Sundaelora's image.
