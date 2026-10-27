# 15: Art for Valentines

Status: done
Blocked by: 02, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Valentines Survival** has art in one style, and the world shows Image Visibility rules.

- Run the Art Harness (02) with this world's art-direction line from ticket 08, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed. A portrait whose face sits far from the camera and reads garbled is redone with Face Fix, the harness's `--face-fix` option (Q28); check every face before you store.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set complementary rules on slot 0 and slot 1 by script, since play shows the first visible image and an unruled slot 0 always wins. A location rule with no owner reads the played persona.
- **Map Background:** none. This world is not a map world (Q12).
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- **Hana Sakuragi's stored portrait shows a boy with short hair**, against her text and tags (ticket 08 finding). Existing art stays under Q10 only when it matches the entity; replace this one through the harness with the world's art-direction line and record the old image's replacement in the comments.

- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [x] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` claimed in this world's row. (29 images on 27 items; `bundledWorlds.test.ts` row moved, 89 tests green.)
- [x] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite. (`valentinesWorld.test.ts` › the Visibility rules; three mutations below each fail it.)
- [x] The contact sheet is at `.scratch/frames/valentines-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [x] The world file's size before and after is in this ticket's comments (Q13).
- [x] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14). (`npm run fingerprints`.)

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.

## Landed

**Not verified**

- Neither Visibility rule was flipped in a live game; the tests drive play's gate function, not the app.

**For you**

- Open the contact sheet and reject or redo by name: `.scratch/bundled-worlds-expansion-15/frames/valentines-sheet.png`.
- In play, reach the state that flips each Visibility rule and confirm the image changes: the Second-Floor Hallway at Pursuit 60, and The Student at 70 percent Sugar.

## Comments

**Art direction.** Every image used ticket 08's line as the positive prefix, with the Q21 preset. Every portrait ran with Face Fix on (Q28), and every pass carried `nsfw, suggestive, sexualized, revealing clothing, cleavage, bare shoulders, midriff, furry, animal ears, kemono`; student passes added `short skirt, miniskirt, large breasts, underwear`. The sheet shows every student fully clothed and age-appropriate.

**Rulings (user, in this session).** Coach Daizen candidate A; Mr. Kuroda and Mr. Gonda redone until they read as anime, not western cartoon; Ashburn High candidate D; The Student's slot 1 redone closer to slot 0; the world thumbnail keeps its JPEG.

**Rulings (spec session).** Ashburn High#0 is redone as the building exterior, and the thumbnail keeps its bytes: it is the world's hook, not a location's subject, and Q10 replaces only art that contradicts its item's text. This is a deliberate split from Slime, whose thumbnail follows its new backdrop. The two pairs as built: Pursuit raw at 60 on the hallway, Sugar percent at 70 on The Student; `timeGates` stays with its three worlds.

**Replaced (Q10).** Hana Sakuragi#0 was a boy with short hair; now a girl with long pink hair and the heart box (seed 1191099808). Ashburn High#0 was a hallway of boys holding chocolates, not the building its tags describe; now the snowy exterior (seed 1922718044). That old JPEG stays as the world thumbnail.

**Valentines lesson for later art tickets.** "clean lineart" in this style line drew 7 of 24 first-pass images as uncolored pink line sketches; `(monochrome)1.5, (sketch)1.3, uncolored, line drawing, greyscale` in the negative fixed all of them. Adult men came out western-cartoon until the subject used the Danbooru tag `(mature male)1.3` and the negative weighted `(western cartoon)1.5, (cartoon)1.4, (toon)1.4`. "paper hearts in windows" drew one giant floating heart, then a view through a window from inside.

**Redos and stored seeds.** Stored `imageTags` are the plain form and describe the stored art.

| Item | Miss | Weighted subject that worked | Stored seed |
|---|---|---|---|
| Classroom 2-B#0 | a student at a desk, Japanese text | `(empty classroom)1.4, (no humans)1.4` | 42536483 |
| Rooftop#0 | a couple's silhouette | `(school rooftop)1.3, (no humans)1.4, scenery` | 735218574 |
| Gymnasium#0 | uncolored sketch of a crowd | `(school gymnasium)1.3, (festival stalls)1.3` | 959444426 |
| Library#0 | a child reading | `(school library)1.3, (no humans)1.4` | 1866233218 |
| Locker Rooms#0 | uncolored sketch | `(school locker room)1.3, (no humans)1.4` | 1168695890 |
| Art Wing#0 | a teddy bear; a giant jar; a plain classroom | `(art studio)1.4, (easel)1.5, (painting on easel)1.4`, candidate A of two | 1132337595 |
| Ashburn High#0 | a giant heart; a view from inside twice | `(japanese high school building)1.4, facade, from outside`, candidate D of four | 1922718044 |
| The Swarm#0 | uncolored sketch of a hallway | `(crowd)1.4, (many high school students)1.3, (holding gift boxes)1.3` | 1459930745 |
| Kenta Ishida#0 | uncolored sketch | `(headset with microphone)1.3, broadcast room, mixing desk` | 277004251 |
| Mei Tachibana#0 | uncolored sketch | `(holding sketchbook)1.2, art room` | 451499486 |
| Rin Hayama#0 | uncolored sketch | `red armband, (holding clipboard)1.2, long straight black hair` | 236055507 |
| Ren Takeda#0 | text on the shirt | `(track jacket)1.2, running track` | 1802804552 |
| Coach Daizen#0 | a girl; a semi-realistic old man | `(1man)1.3, (adult)1.3, (red tracksuit)1.2, (whistle around neck)1.2`, candidate A of two (user) | 467943765 |
| Mr. Kuroda#0 | near-monochrome; then western cartoon (user) | `1boy, (mature male)1.3, (anime)1.2, stubble`, candidate C of four (user) | 1655745261 |
| Mr. Gonda#0 | near-monochrome; cartoon; like Kuroda; a crossword over the frame (user) | `(mature male)1.3, (gray hair)1.4, (mustache)1.2, (navy peaked cap)1.2`, candidate G of eight (user) | 746780746 |
| The Student#0 | near-monochrome | stored tags, color negatives | 1798864508 |
| Ms. Fujimura#0 | near-monochrome | `(mature woman)1.3` | 1406638882 |
| Haruto Mori#0 | near-monochrome | stored tags, negative adds `maid, frills` | 1030672938 |
| Second-Floor Hallway#0 | held for the pair | `(empty school hallway)1.4, (paper hearts on lockers)1.3, (no humans)1.4` | 360049260 |

**First-pass seeds** (kept): Hana Sakuragi 1191099808 · Best Friend 816022333 · Sora Amagi 1810039802 · Mrs. Okabe 1740495381 · Courtyard 1255363734 · Front Gate 1065092837 · Cafeteria 1620716780 · Bus Loop 2094381884.

**Visibility rules (Q18).** Both pairs use complementary rules, and slot 1 is slot 0's seed with the state's tags added, through a hand-written replay log.

- Second-Floor Hallway: slot 0 (empty hall) at Pursuit < 60, slot 1 (the swarm running at you with gift boxes) at Pursuit ≥ 60, raw. Pursuit is a world stat, so the owner-less rule reads the global scope. Slot 1 drops `empty` and `no humans` and adds `(crowd of students)1.4, (many students running)1.3, school uniforms, (holding gift boxes)1.3, ribbons, motion blur`.
- The Student: slot 0 at Sugar < 70 %, slot 1 (flushed, hand on stomach, chocolate box, smear on the cheek) at Sugar ≥ 70 %, percent, since the Constitution traits set Sugar's max to 100, 125 or 80. Slot 1 adds `(long hair)1.3, (pink hair)1.2, red blazer, red necktie, (flushed face)1.3, (hand on stomach)1.3, chocolate smear on cheek, (holding many chocolate boxes)1.2, dizzy, sweat`. No daypart rule, so `timeGates` stays with its three worlds.

**Bite proofs.** Each mutation of the world file fails the named tests, and the file was restored byte for byte after each: slot 0 of the hallway unruled (the hallway test); the Student's pair on raw units (the Sweet Tooth and Dainty Appetite cases); slot 1's threshold moved to 75 percent (all three Constitution cases).

**Canvas (Q25, Q26).** No node moved; the world has no Map Background (Q12).

**File size (Q13).** `src/defaultworlds/valentines.json`: 942,251 bytes (0.90 MB) before, 36,548,529 bytes (34.86 MB) after, every new image lossless WebP. The thumbnail stays a 223 KB JPEG.

**Follow-up after user review (2026-10-27).** Too many of the cast had pink hair and read as one person. Hana keeps hers; the other eight were redone with a distinct hair color each, two candidates per character, and the user picked each one. Every pass carried `(pink hair)1.5` in the negative and Face Fix on.

| Item | New hair | Pick | Stored seed |
|---|---|---|---|
| The Student#0 | chestnut brown | B | 2009611586 |
| The Student#1 | chestnut brown, sugar high, slot 0's prompt plus the sugar tags | A | 2009611586 |
| Best Friend#0 | light brown, messy | A | 122386762 |
| Kenta Ishida#0 | orange | A | 1675970418 |
| Sora Amagi#0 | silver | A | 863589925 |
| Mei Tachibana#0 | blonde bob | A | 1049314103 |
| Ren Takeda#0 | black, spiky | A | 303865397 |
| Haruto Mori#0 | navy blue | A (B drew a girl) | 206064117 |
| Ms. Fujimura#0 | dark brown, bun | A | 1364530552 |

The Sugar pair's rules are unchanged. File size after the follow-up: 36,723,378 bytes (35.02 MB).
