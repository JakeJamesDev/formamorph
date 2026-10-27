# 16: Art for Veilwood

Status: done
Blocked by: 02, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Veilwood** has art in one style, and the world shows Image Visibility rules and a Map Background.

- Run the Art Harness (02) with this world's art-direction line from ticket 09, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed. A portrait whose face sits far from the camera and reads garbled is redone with Face Fix, the harness's `--face-fix` option (Q28); check every face before you store.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set complementary rules on slot 0 and slot 1 by script, since play shows the first visible image and an unruled slot 0 always wins. A location rule with no owner reads the played persona.
- **Canvas layout (Q25):** the content ticket placed every location by the lore. Set the Map Background frame so the drawn map agrees with those positions, and generate the map from the same layout: a place that is north on the canvas is north on the map. You may move nodes to fit the map as long as the overall layout stays similar (Q26); record each move in the comments.
- **Map Background (Q12):** one generated map image behind the Locations canvas. Set its frame in the editor so the drawn map lines up with the placed locations, and set the opacity. The world's coverage row claims `mapBackground`.
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` and `mapBackground` claimed in this world's row. (`bundledWorlds.test.ts` row; `.scratch/veilwood-check.mjs` found no item without an image.)
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. (`veilwoodWorld.test.ts` › the Visibility rules: Attention 45 and 46, every daypart. The Wanderer's threshold moved to 45 and evening moved to the Hollow's day slot each went red.)
- [x] The contact sheet is at `.scratch/frames/veilwood-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] The Map Background shows behind the Locations canvas and the in-game Map at `.scratch/frames/veilwood-map.png`, 1280 wide, light theme. (Playwright frames on the worktree's dev server: the full-screen canvas in `veilwood-map.png`, the Change Location Map after a new game in `veilwood-ingame-map.png`.)
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.

## Landed

**Not verified**

- No Visibility rule was flipped in a live game. The tests read the rules through play's gate functions, `visibleImages` and `visibleLocationImages`.

**For you**

- For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.
- The contact sheet is at `.scratch/bundled-worlds-expansion-16/frames/veilwood-sheet.png`.
- Judge the map: `veilwood-map-overlay.png` draws each node's box on it; `veilwood-map.png` and `veilwood-ingame-map.png` show it in the app. Like Sugarscape's, it is a map of flat regions (img2img over a sketch), not a terrain painting.
- The Wanderer is seen from behind with the hood up, so the persona has no face or gender. Slot 1 shows the same traveler running through the water.
- Weakest subjects: Lantern Moths is one glowing moth, not a swarm; Ghost Chanterelle is a pale ruffled mushroom, not a funnel; Sunkwater Belfry shows hanging bells over a misty valley, not a tower room; The Eastern Edge is an open rocky slope with few trees.
- The new portraits are paintings on charcoal; the seven stored portraits are 3D renders on the same charcoal. Check that they sit well together in the Entities panel.

## Comments

**Art direction.** Every location and entity image used ticket 09's line as the positive prefix, with the Q21 preset. Every new portrait except the Wanderer added `(simple background)1.4, (dark charcoal background)1.6, (dark gray background)1.4, isolated subject, centered` to the line, to match the stored portraits' backdrop (ticket 09 note).

**Kept (Q10).** The Veilwood#0 and the seven animated portraits (Ember Speckle, Midnight Shimmer, Ember Spire, Night Veil, Cerulean Vex, Shadow Raptor, Dread Crawler) are byte for byte unchanged, as is the thumbnail. None contradicts its text, so none was replaced.

**Veilwood lessons for later art.**

- The Kemono model reads "beast" as the subject: the Wanderer grew fox ears and a tail. Glowing eyes in a prompt bind to the subject's face, in text-to-image and in img2img, so a predator watching from the fog could not be drawn behind a person in six tries.
- A tag that names the subject can be written into the image as a caption: `(lone traveler)` drew "LONE TRAVELER" in a corner. Replaying without the tag at the same seed removed it.
- "Chanterelle" and "trumpet-shaped" drew a brass trumpet and mushrooms in glass vessels. "Cathedral" drew Gothic spires. "Gloomcap" (via its mushroom tags) drew one giant central mushroom four times.
- The first-pass portraits came out on light gray until the backdrop tags went to 1.6.

**Extra negatives per pass.**

| Pass | Extra negative |
|---|---|
| Places | `humans, person, character, 1girl, 1boy, multiple views, comic panels, panel border, split screen, speech bubble, text, watermark`; redos add the miss they fix, such as `giant mushroom, single mushroom, building, church, spire` or `ribbon, cloth, floating object, bird, kite` |
| Portraits | the place set plus `forest, trees, landscape, white background, light gray background`; redos add `butterfly, trumpet, instrument, glass, vase, pot, red cap, amanita` and similar |
| The Wanderer | `nsfw, child, loli, shota, teenage, petite, multiple people, face, mask, looking at viewer, long hair, glowing face, glowing body, animal ears, tail, furry, kemono, anthro, yellow jacket, western cartoon, cartoon`, the panel set, and for slot 1 `signature, title, caption, logo, words` |

**Stored seeds.** One candidate per round; the stored `imageTags` are the plain form and describe the stored art.

| Item | Miss before | Weighted prompt subject | Stored seed |
|---|---|---|---|
| The Drowned Hollow#0 | first pass | `(flooded forest clearing)1.4, (arching tree roots)1.3` | 1678998638 |
| The Drowned Hollow#1 (variant) | new slot | slot 0's subject plus `(night)1.5, (darkness)1.4, (pairs of glowing yellow eyes between the trees)1.5, moonless` | 1637653299 |
| Gloomcap Thicket#0 | one giant mushroom, four times; then a pod | `(fern thicket)1.5, (dense bushes)1.5, (overgrown forest floor)1.4`, mushroom words dropped | 806092366 |
| Blackwater Channels#0 | first pass | `(swamp waterways)1.4, (still black water channels)1.3` | 430097039 |
| The Hollow Fig#0 | a log with an eye | `(interior of a giant hollow tree trunk)1.5, (strangler fig roots)1.2`; drew the tree from outside, retagged | 1332445827 |
| The Surveyor's Camp#0 | first pass | `(inside a giant hollow tree)1.4, (abandoned campsite)1.4` | 1043752318 |
| The Veilbreak#0 | an arch; then a floating ribbon three times | `(break in the forest canopy)1.4, (bright shaft of sunlight)1.4, (rocky ridge beyond the trees)1.3` | 827822306 |
| The Gloam Cathedral#0 | red toadstools; then Gothic spires; then a figure | `(no humans)1.6, (forest of giant pale mushrooms)1.5, (tall mushroom stalks like columns)1.4` | 255766181 |
| The Predator Dens#0 | first pass | `(bone-strewn dry ground)1.4, (thorn thicket)1.3` | 301700352 |
| Sunkwater#0 | first pass | `(drowned village)1.5, (flooded cottages)1.3, (church bell tower)1.3` | 1624623155 |
| Sunkwater Belfry#0 | a hallway; then a room with no bell | `(huge bronze bell)1.7, (hanging bell)1.5, wooden belfry beams` | 425269040 |
| The Eastern Edge#0 | a person in a dense forest; then a stream | `(no humans)1.4, (open rocky hillside)1.5, (few scattered trees)1.4` | 181593631 |
| The Surveyor's Cache#0 | a stone oven with fire | `(small stack of stones)1.5, (cairn)1.5` | 90921753 |
| The Wanderer#0 | a green glowing face; then a woman's face (persona has no set look) | `(adult)1.3, androgynous, (from behind)1.5, (hood up)1.5, (face hidden)1.3` | 1008154166 |
| The Wanderer#1 (variant) | a different person; img2img glowed the figure; eyes bound to the hood; fox ears; a caption | slot 0's subject plus `(running)1.5, (fleeing through a dark flooded forest)1.4, (splashing water)1.4, motion blur`, without `(lone traveler)` | 32309252 |
| Lantern Moths#0 | one butterfly; then a bug with a face | `(small swarm of moths)1.5, (moths circling a soft glowing light)1.4`; drew one moth, retagged | 707036026 |
| The Surveyor's Journal#0 | light background | `(open field journal)1.5` | 470265612 |
| Ghost Chanterelle#0 | a chibi girl; a trumpet twice; mushrooms in vessels | `(pale white funnel-shaped mushrooms)1.5, (wavy ruffled cap edges)1.4, (growing on a mossy log)1.3` | 50044127 |
| Bleeding Tooth#0 | light background; then a red cap | `(white lumpy fungus)1.5, (droplets of red liquid on the white surface)1.4` | 1136150639 |
| Sporeburst Puffball#0 | a black ball | `(puffball mushrooms)1.5, (cluster of round white puffballs)1.4` | 1073124566 |
| Bark Frogs#0 | a whole tree, tiny frogs | `(frogs)1.6, (three small tree frogs)1.4` | 1792712847 |
| Mire Leeches#0 | a clawed bug; then tentacles | `(leech)1.6, (black worm)1.5, (segmented slug-like body)1.4` | 529292715 |
| The Drowned Bell#0 | light background | `(bronze church bell)1.5` | 1683744973 |
| The Map's Other Half#0 | a hand holding it | `(torn paper map)1.5, (no humans)1.4` | 702589795 |
| The Bone Midden#0 | light background | `(pile of old bones)1.5` | 1320940499 |
| The Surveyor's Blazes#0 | a cross of logs | `(tree trunk)1.4, (orange paint mark painted on the bark)1.5` | 1214631794 |

**Face Fix (Q28).** Not used. No new portrait shows a face: the Wanderer is seen from behind, and the rest are creatures and objects.

**Visibility rules (Q18).** Both pairs use complementary rules, so the image swaps in play.

- The Wanderer: slot 0 (wading) at Predator Attention < 46, slot 1 (running) at Predator Attention ≥ 46, raw unit. 46 is where the Stalked band starts (bands are `value ≤ threshold`). Predator Attention is a world stat, so the rule needs no owner.
- The Drowned Hollow: slot 0 at dawn, morning, midday and afternoon, slot 1 (eyes in the dark) at evening and night, the dayparts Night Hunt is on.

**Map Background (Q12, Q25, Q26).** Image-to-image over a region sketch, seed 3003, strength 0.45, through the app's lossless WebP encoder. Frame x −120, y −120, width 1760, height 1204; opacity 0.6. No Q26 moves: every node sits on its region in `veilwood-map-overlay.png`.

- No text-to-image attempt: ticket 14's 30 failed candidates made the sketch route the first try.
- Round 1, strength 0.6 and 0.72, seeds 3001 to 3003 (`veilwood-map-candidates.png`): 0.72 lost the layout; 0.6 kept it but drew close-up ponds and lily pads.
- Round 2, a denser sketch with high-altitude words, strength 0.45 and 0.55 (`veilwood-map-candidates-2.png`): 0.45 kept every region; 3003 keeps the Thicket and the Cathedral grove apart.
- The sketch is `veilwood-map-sketch.png`, drawn by `veilwood-map-sketch.py`; the one-off img2img script is `veilwood-map-img2img.mjs` (ticket 14's, with a size option).
- The stored map's prompt: `top-down illustrated cartography, muted teal and moss green palette, soft cyan and amber bioluminescent glow, high detail, (fantasy world map)1.3, (from high altitude)1.4, (aerial view)1.4, (top-down)1.3, (no humans)1.4, tiny trees, dense dark drowned forest canopy, winding black water channels, flooded clearing in the west, grove of pale glowing fungus pillars in the north, giant fig tree in the center, gray rocky ridge in the northeast, drowned village with tiny rooftops in a dark lake in the south, thinning trees and an open pale slope in the east`, with the extra negative `text, letters, labels, watermark, people, character, perspective, horizon, sky, paper map, parchment, border, frame, robot, vehicle, humans, person, animal, grid, tiles, squares, texture, lily pad, water lily, pond, close-up, leaves, flower, portal, ripples`.

**Visibility test block.** Lifted into `bundledWorldHarness` as `statAt`, `atDaypart`, `entitySlots` and `locationSlots`; Slime, Sugarscape, Rampage and Veilwood use them. Emberwatch keeps its own `statAt`, since it builds the gate under a chosen persona. The harness's owner scope in `statAt` changes no verdict: with it removed, the Slime and Sugarscape owner-stat tests stay green, because play's gate reads the stat either way.

**Review fold-ins.** `statAt` now reads an owner's stat only from that owner, so a world stat can't be filed under an entity by mistake. `entitySlots` and `locationSlots` each carry their own TSDoc. Named, not folded: `veilwoodWorld.test.ts` still has its own loader beside the harness, so the world parses twice; and `evening || night` repeats in three world tests.

**Fingerprints.** The regeneration keeps the old Veilwood pair (`e04430bd…` source, `0dbd2a67…` shipped) and adds the new one (`7cac54c8…`, `cb0f6e08…`). It drops `09f95080…` and `2210ef9a…`. The generator walks every commit, so those two belong to no committed revision and were written from an uncommitted tree.

**File size (Q13).** `src/defaultworlds/veilwood.json`: 6,325,487 bytes (6.03 MB) before, 40,095,781 bytes (38.24 MB) after, every new image and the map lossless WebP. The thumbnail stays the stored WebP.
