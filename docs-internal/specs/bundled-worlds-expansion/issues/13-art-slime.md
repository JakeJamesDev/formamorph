# 13: Art for Slime

Status: done
Blocked by: 02, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Slime Outbreak** has art in one style, and the world shows Image Visibility rules.

- Run the Art Harness (02) with this world's art-direction line from ticket 06, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed. A portrait whose face sits far from the camera and reads garbled is redone with Face Fix, the harness's `--face-fix` option (Q28); check every face before you store.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set complementary rules on slot 0 and slot 1 by script, since play shows the first visible image and an unruled slot 0 always wins. A location rule with no owner reads the played persona.
- **Map Background:** none. This world is not a map world (Q12).
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` claimed in this world's row. (`bundledWorlds.test.ts`; the Test Bench image rules report no findings. The branch predates main's 38a3c7dc3, which drops the script-switched rows; main's suite with this ticket's row change passes every Slime case against this world.)
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. (`slimeWorld.test.ts` › the Visibility rules: Assimilation 39 and 40, and all six dayparts. Moving the threshold to 41 and dropping evening from slot 0 turned both red.)
- [x] The contact sheet is at `.scratch/frames/slime-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). (`npm run fingerprints`)

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.

## Landed

**Not verified**

- No Visibility rule was flipped in a live game. The tests read the rules through play's gate functions, `visibleImages` and `visibleLocationImages`.

**For you**

- For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.
- The contact sheet is at `.scratch/bundled-worlds-expansion-13/frames/slime-sheet.png`.
- The Resident turns translucent green at Assimilation 40. The Resident reads as a young adult in this model's anime style; redo by name if the face reads too young.
- The Night Pharmacy shows its lit counter at evening and night, and a shut storefront in daylight from dawn to afternoon. The day image has blinds, not a roll-up shutter.
- The Loudspeakers came out as a horn and speaker stacks on a pole, not municipal horn speakers. Three prompts did not get the municipal kind.
- Green Slime has two small eye dots. Four candidates, two with `face, eyes` negatives, all drew them.
- The world thumbnail is now Ashburn's new backdrop; check it on the world card.

## Comments

**Art direction.** Every image used ticket 06's line as the positive prefix, with the Q21 preset.

**Rulings (spec session).** The Resident's pair reads its own Assimilation at raw 40, since no trait changes its max. The Night Pharmacy's pair follows Hollis's Counter Open dayparts. Ashburn's JPEG and Green Slime's WebP stay (Q10); Ashburn's tags now describe its stored street. No entity is a child; every person pass ran with the safety negatives.

**User ruling (2026-10-26).** Redo Ashburn and Green Slime too, so every image shares one style. This replaces the Q10 keep above. The world thumbnail is Ashburn's new backdrop, byte for byte, as in Rampage, Sugarscape, Valentines and Veilwood.

**Extra negatives per pass.**

| Pass | Extra negative |
|---|---|
| First pass, every item | `nsfw, suggestive, sexualized, revealing clothing, cleavage, bare shoulders, midriff` |
| Redo, people | `multiple views, comic panels, 4koma, panel border, split screen, speech bubble, child, loli, shota, teenage, petite`, plus the first-pass set |
| Redo, slimes and places | the panel set plus `humans, person, character, 1girl, 1boy`; Amber Creeper adds `ghost, face`; The Ward Mimic adds `face` |
| Gus Marrow (redo 2) | the panel set plus `child, teenage, shorts, nsfw` |
| The Loudspeakers (redo 2) | the scene set plus `street` |

**Slime lesson for later art tickets.** The word "comic" in this world's style line made the model draw multi-panel pages (four of 27 first-pass images). The panel negatives fixed every one. The model also drew every adult as a teenage anime girl until the subject led with weighted age tags, such as `(old woman)1.4` or `(mature female)1.4`.

**Redos and their stored seeds.** Two candidates per redo; the stored one is named. The stored `imageTags` are the plain form and describe the stored art.

| Item | Miss | Weighted prompt subject | Stored seed |
|---|---|---|---|
| The Resident#0 | a teenage girl | `(adult)1.3, (young adult)1.1, androgynous, (looking at own hands)1.2` | 13738257 |
| The Resident#1 (variant) | new slot | slot 0's subject plus `(translucent skin)1.4, (green-tinged skin)1.3, glowing veins at wrists and temples`, at slot 0's seed | 13738257 |
| Hollis Pratt#0 | a young girl | `(old woman)1.4, (elderly)1.3, wrinkles, gray hair` | 877178041 |
| Neighbor#0 | a young woman | `(middle-aged)1.4, adult, androgynous, bathrobe` | 709277947 |
| Dee Halloran#0 | a teenage girl | `(mature female)1.4, adult, radio host` | 1688990735 |
| Dr. Ines Varga#0 | a teenage girl | `(mature female)1.4, adult, doctor` | 137268854 |
| Sergeant Abena Okonjo#0 | a masked squad, no face | `(mature female)1.4, (dark skin)1.2, (face shield pushed up)1.3, solo`, Face Fix on | 1717903125 |
| Father Tomas Reyes#0 | comic panels | `(1man)1.3, (middle-aged)1.3, (priest)1.3, (clerical collar)1.3` | 860014064 |
| Quarantine Watch#0 | comic panels | `(hazmat suits)1.3, face shields, multiple people` | 979672615 |
| The Ward Mimic#0 | comic panels with people | `(green slime)1.4, slime shaped like a sleeping person, (no humans)1.3` | 1472377668 |
| The Gutter Swarm#0 | comic panels, one blob | `(many slimes)1.4, (swarm)1.3` | 454141677 |
| Amber Creeper#0 | a yellow ghost girl | `(amber slime)1.4, (orange translucent slime)1.3` | 1149649680 |
| The Loudspeakers#0 | no speakers; then a street of poles | `(loudspeaker)1.5, (megaphone)1.3, (from below)1.3, close-up` | 1421472435 |
| Ashburn General#0 | an ambulance in a corridor | `(hospital building)1.3, exterior, ambulance bay` | 1280901301 |
| The Marquette District#0 | a person in the street | `(empty street)1.3, (no humans)1.3` | 757348568 |
| The Night Pharmacy#1 (variant) | new slot; then lit windows that read as dusk (review) | `(daytime)1.4, (bright gray daylight)1.3, (closed metal roll-up shutters over the door and windows)1.5, (lights off)1.4, dark windows`, negatives add `night, lit windows, glowing windows, interior lights, neon sign` | 1448118445 |
| Gus Marrow#0 | a blank face far from the camera, in shorts | `(old man)1.4, (elderly)1.2, (hip waders)1.4, cowboy shot`, Face Fix on | 1853579316 |
| Ashburn#0 | old JPEG in another style (user ruling) | stored port-city tags, scene negatives | 1594892554 |
| Green Slime#0 | old WebP in another style (user ruling); then a face | stored tags, scene negatives plus `face, eyes, mouth, kawaii, mountains, sky` | 853595392 |

**Face Fix.** Ticket 11's `--face-fix` had not landed, so the Okonjo and Gus Marrow redos set `adetailer: true` in their hand-written replay logs (the provider's second pass).

**Face Fix follow-up (user ruling).** Every image that shows a character was made again with `--face-fix --replay`, at its stored seed and its exact prompt and negative, read back from InvokeAI's stored graph. Nine images changed, only inside the face box: The Resident#0 and #1, Hollis Pratt, Neighbor, Dee Halloran, Dr. Ines Varga, Father Tomas Reyes, Quarantine Watch and The Night Pharmacy#0. The Chemical Works and The Storm Sewers show silhouettes with no face to detect, so they did not change. File size: 34,869,154 → 34,882,154 bytes.

**First-pass seeds** (kept): Crescent Row 1064674608 · Ashburn High Shelter 1828561145 · The Night Pharmacy#0 370189932 · Harborfront 1431550394 · The Chemical Works 1798129466 · The Causeway Bridge 988307392 · St. Anselm's 28874856 · The Storm Sewers 248531787 · KASH Radio 1101966075 · The Bloom 1904674017 · The Fog Veil 723588434 · The Signal Slime 385377807.

**Retagged to the art.** Ashburn High Shelter, The Marquette District (no checkpoint drawn), Ashburn General The Signal Slime (slime below the mast, not wound around it), The Chemical Works and The Storm Sewers (a lone figure), and The Night Pharmacy (a pharmacist at the counter) kept their images and got tags that describe them, as did every redo.

**Visibility rules (Q18).** Both pairs use complementary rules, so the image swaps in play.

- The Resident: slot 0 at Assimilation < 40, slot 1 (translucent green skin) at Assimilation ≥ 40, raw unit. The rule reads the Resident's own stat.
- The Night Pharmacy: slot 0 (lit counter) at evening and night, slot 1 (shut storefront by day) at dawn, morning, midday and afternoon. A daypart rule reads the story clock, so it needs no owner.

**File size (Q13).** `src/defaultworlds/slime.json`: 547,728 bytes (0.52 MB) before, 34,869,154 bytes (33.25 MB) after, every image and the thumbnail lossless WebP.
