# 10: Art for Drone

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Reincarnated Drone** has art in one style, and the world shows Image Visibility rules.

- Run the Art Harness (02) with this world's art-direction line from ticket 03, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set the rule by script. A location rule with no owner reads the played persona.
- **Map Background:** none. This world is not a map world (Q12).
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` claimed in this world's row. Node check: 28 of 28 items hold art, 30 images; `bundledWorlds.test.ts` green with the row moved.
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. `droneWorld.test.ts` › "the drone's Visibility rules": Charge 99/100 for both; both fail with the world's thresholds moved to 99.
- [x] The contact sheet is at `.scratch/frames/drone-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments. The drone's cells read `Designation#0` and `Designation#1`.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). `npm run fingerprints`: 141 revisions, 71 fingerprints.

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.

## Landed

**Not verified**
- None. Every criterion is ticked.

**For you**
- For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.
- Neither rule was flipped in a live game. The tests read the rules through `visibleImages` and `visibleLocationImages`, which the game's gallery and backdrop hooks call.
- Open the contact sheet at `.scratch/bundled-worlds-expansion-10/frames/drone-sheet.png`. Reject or redo any image by name.
- The drone has no cannon turret in either image. Four tag passes could not get both wheels and the turret. You picked pair E.
- In play, fill Charge to 100% (Overdrive ready). The drone's gallery gains the powered-up image.
- With Charge at 100%, go to Mossback Hill. The backdrop gallery gains the awake Sentinel.
- Existing art stays (Q10): Magiterra Nova's JPEG and Tiamat's WebP predate the art-direction line and look different from the new images.

## Comments

**Art direction.** Every image used ticket 03's line as the positive prefix, with the Q21 preset.

**Harness changes.** `--negative "<tags>"` appends tags to the pinned negative for one run, and the run log keeps them for `--replay` (spec-session ruling). The contact sheet shows a chip-named item by its placeholder's name, so the drone reads `Designation`.

**Extra negatives per pass.**

| Pass | Extra negative |
|---|---|
| Sabi, Tamsin, Squire Wren | `nsfw, suggestive, sexualized, revealing clothing, cleavage, bare shoulders, midriff, mature female, adult, large breasts` |
| Drone (stored pair) | `(legs)1.5, (arms)1.4, hands, humanoid, caterpillar tracks, car, driver, vehicle windows` |
| Rustjaw redo | `robot, power armor, full armor, helmet` |
| Demon Frontier, Fort Graywatch, The Leviathan (second redo) | `creature, monster, robot, character, white background, simple background, floating island` |

The three children were reviewed on the sheet before storage: age-appropriate and fully clothed.

**Redos and their stored seeds.** Each redo also sharpened the item's `imageTags`, now stored with the art.

| Item | Miss | Stored seed |
|---|---|---|
| Scavenger Wastes#0 | a clean vehicle, no rusted hulks | 1296678800 |
| Rustjaw#0 | a power-armor robot, not a man | 1310914884 |
| Demon Frontier#0 | a calm tree, no blight; then a creature at center | 1346879605 |
| Fort Graywatch#0 | a farmhouse; then a floating island on white | 235632129 |
| The Leviathan#0 | a brass orb; then a creature in a porthole | 607772218 |
| Designation#0 (drone) | legs twice, a military tank, a passenger car | 1149877591 |
| Designation#1 (drone, damaged) | legs, then treads, then a car, then arms | 1166037643 |

The drone's stored tags say `dome body, antenna` where its prompt said `tank turret`, so the tags describe the stored art, which has no turret. Per the spec-session ruling, stored `imageTags` stay plain booru tags. The prompt that made the stored pair was `(non-humanoid robot)1.3, no humans, solo, (four wheels)1.3, tank turret, one-eyed, glowing eye, rounded armor, low to the ground, small, cute`; the Compel weights are InvokeAI syntax only.

**Drone lesson for later art tickets.** Long subject lists after the 11-tag style prefix got diluted. The word "robot" pulled in a humanoid body, and "car" pulled in windows and a driver. What worked was a short subject of real Danbooru tags (`non-humanoid robot` has about 9,000 posts) with Compel weights on the two traits the model kept dropping, `(non-humanoid robot)1.3` and `(four wheels)1.3`, plus weighted limb negatives. The lesson is also in memory for later art tickets, and in the landing message to the spec session.

**First-pass seeds** (kept): Ashfall Capital 182397900 · Undercity Vaults 43707073 · Hulkfall Camp 1194769337 · Blightcrown Peaks 415195203 · The Blight Line 1785571105 · Thornmere 1101030488 · Mossback Hill#0 738203606 · Mossback Hill#1 1419652244 · Archon Vael 396885992 · Ser Halden 274191652 · Mossback Sentinel 1125761283 · Lady Morrow 152380103 · Vault Warden 1002705267 · Glassback Burrower 1867966112 · Blight Drake 2067395019 · Blightspawn 1138650894 · Herald Skarn 1736539013 · Old Corwin 2097128882 · Sabi 370512877 · Tamsin 1559273303 · Squire Wren 219101372.

**Visibility rules (Q18).** Both slot 1 images show while Overdrive is ready, Charge at 100 percent. The drone's rule reads its own Charge. Mossback Hill's rule has no owner, so it reads the played persona. Slot 0 has no rule on both.

**Follow-up after user review (2026-10-26).** The user rejected Blightcrown Peaks, Demon Frontier, and both Visibility images.

- The drone's slot 1 reads as powered up, not damaged, so its rule moved from Health < 30% to Charge at 100%.
- Mossback Hill's two images now show the Sentinel. Slot 0 is the dormant Sentinel crouched in the hillside. Slot 1 is the same subject awake, with its optic and the glyphs lit, made at slot 0's seed with the awake tags added, through a hand-written replay log. Its rule is Charge at 100%, so the Sentinel answers the drone's Overdrive (user's pick).
- Two candidates per item; the user picked each.

| Item | Stored seed | Extra negative |
|---|---|---|
| Blightcrown Peaks#0 | 1516780368 | `machine, vehicle, robot, creature, character, white background, simple background` |
| Demon Frontier#0 | 1671083904 | `castle, building, fort, house, machine, vehicle, robot, creature, character, humans` |
| Mossback Hill#0 | 1957288652 | `humans, girl, child, standing, walking, legs, full body, glowing eyes, glowing, light beams` |
| Mossback Hill#1 | 1957288652, prompt plus `awakened, glowing blue optic, glowing glyphs on the stones, beams of light` | slot 0's, without the glow tags |

Mossback Hill's Sentinel will not render half-buried: four candidates gave a standing, sitting or crouched machine, and the stored tags say crouching.

**File size (Q13).** `src/defaultworlds/drone.json`: 1,311,555 bytes (1.25 MB) before, 39,945,747 bytes (38.10 MB) after, all lossless WebP. After the follow-up: 40,214,926 bytes (38.35 MB).
