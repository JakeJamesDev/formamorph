# 21: Rampage Creature Type Art

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q18, Q21, Q27; Implementation Decisions › Visibility rules, Harness negatives)

## What to build

A City Rampage player who picks Insect, Arachnid or Giant sees their own kaiju, not the reptile. The Creature's gallery holds one image per Type trait, and the one the player picked is the one that shows.

- The Creature's Type group offers Reptile, Insect, Arachnid and Giant, one pick at most, and today the entity has one unruled image that shows a reptile. That image becomes the Reptile slot, with a Visibility rule on The Creature's own Reptile trait. The current art stays as it is (the user likes it).
- Generate three more portraits through the Art Harness with Rampage's art-direction line, one each for Insect, Arachnid and Giant, matching each trait's AI text: the two-legged insect with mandibles and armored plates, the eight-legged spider, and the human as tall as the towers. Each gets a Visibility rule on its trait. Read ticket 10's and ticket 12's comments for the prompting lesson and the Drone pass that needed weighted subject tags; this is the same kind of subject.
- The Type group says "Pick one" but sets no minimum, so a player can pick none, and an all-ruled gallery would then show nothing. Set the group's minimum to one pick so the copy and the rule agree. That is a content change inside the premise (Q4) and needs no probe, since no AI text changes.
- Order the slots so the Reptile image is slot 0, which shows outside play.
- `imageTags` on The Creature describe the Reptile image; each new image's tags live in the run log and the ticket's comments, since one entity holds one tag list.
- Regenerate the fingerprints and the owner-tree parity snapshot if it changes. Generation holds the GPU: ask the user for a window before the live run.

## Acceptance criteria

- [x] The Creature has five images, Reptile in slot 0 with the existing art, Insect, Arachnid, then two Giant images whose rows are Giant plus Masculine and Giant plus Feminine (spec-session ruling). Each image has a Visibility rule; the stripped diff shows only those rules, the four new images, the Type and Presentation minimums, and the fingerprints. (Stripped before/after diff; the owner-tree parity snapshot also gained the two `minPicks` lines.)
- [x] A test picks each Type trait in turn (and both Presentations for Giant) and reads the visible gallery through play's gate function, seeing exactly that build's image, and is shown to bite with a rule removed. (`rampageWorld.test.ts` › "shows The Creature as the … it was built as"; bites below.)
- [x] The Type and Presentation groups each require one pick, shown by the shared suite's Test Bench rows staying empty and the pick-count test for each group. (`bundledWorlds.test.ts` › "raises no Test Bench finding beyond its open list" with no Rampage row, on the pick-group coverage fix 8b2701c83; `rampageWorld.test.ts` › "requires one … pick", bites for both.)
- [x] The contact sheet is at `.scratch/frames/rampage-creature-sheet.png` with the four new images labeled by type, and each seed is in this ticket's comments. (Frame read; the candidate sheet is `rampage-creature-candidates-sheet.png`.)
- [x] The world file's size before and after is in this ticket's comments.

For you: open the contact sheet and reject or redo by type. In play, pick each Type at Enter World and check The Creature's image matches.

## Landed

**Not verified**

- No Type was picked in a live game. The tests read the gallery through play's gate function.

**For you**

- For you: open the contact sheet and reject or redo by type. In play, pick each Type at Enter World and check The Creature's image matches. (`.scratch/bundled-worlds-expansion-21/frames/rampage-creature-sheet.png`)
- The Insect has wings; three passes with weighted wing negatives kept them. Redo by type if the wings matter.
## Comments

**Spec-session rulings.** Giant gets two images, rows Giant plus Masculine and Giant plus Feminine, and Presentation gets a one-pick minimum like Type. The Giants wear ordinary torn street clothes, with the crowd pass's safety negatives. Q28: the Giant passes ran with Face Fix (`adetailer: true`).

**How the candidates were made.** Every image used ticket 05's art-direction line as the positive prefix, with the Q21 preset. The candidates lived in a scratch world whose entities were named by type, so the sheet labels each image by type. A script copied the picked images into The Creature's gallery. Ticket 11's `--face-fix` had not landed, so the Giant passes ran from a hand-written replay log with `adetailer: true` on each job, as ticket 12 did for Downtown Core#1. The user picked each image on the sheet.

**Stored images and seeds.** Stored `imageTags` still describe the Reptile slot; each subject below lives here and in the run logs.

| Slot | Type | Weighted prompt subject | Extra negative | Stored seed |
|---|---|---|---|---|
| 1 | Insect | `(giant kaiju)1.4, (insect monster)1.3, (bipedal)1.3, (wingless)1.4, mandibles, (armored carapace)1.2, spiked arms, (towering over skyscrapers)1.3, no humans, city` | `(wings)1.6, (insect wings)1.5, (flying)1.4, midair, (humans)1.5, (person)1.5, 1boy, 1girl, humanoid, human face, robot, mecha, scorpion, cars` | 175014515 |
| 2 | Arachnid | `(giant kaiju)1.4, (giant spider)1.4, eight legs, hairy legs, mandibles, spider web between skyscrapers, rooftops, city` | `humanoid, human face, arachne, drider, monster girl, 1girl, robot, mecha` | 796453804 |
| 3 | Giant, Masculine | `(giant man)1.4, 1boy, solo, (torn clothes)1.2, jeans, t-shirt, (towering over skyscrapers)1.4, (size difference)1.3, city below, ruined city` | safety negatives plus `furry, animal ears, kemono, (text)1.4, letters, logo, print shirt, extra faces` | 1082820158 |
| 4 | Giant, Feminine | `(giant woman)1.4, 1girl, solo, (torn clothes)1.2, jeans, t-shirt, towering over skyscrapers, city street, from below` | safety negatives plus `furry, animal ears, kemono` | 1201025165 |

**Redos.**

- Insect, pass 1 (`bipedal` unweighted): two flying, winged, scorpion-like insects, and a person on a rooftop.
- Insect, pass 2 (`(bipedal)1.4, (standing)1.3`, wings weighted 1.5 in the negative): it stood on two legs, but at street scale, with a person in the foreground.
- Insect, pass 3 (the stored subject): kaiju scale and no people. Wings stayed on both candidates across all three passes, so "insect" carries wings on this model. The trait text does not rule them out.
- Giant Masculine, pass 1 (the Feminine subject with `giant man, 1boy`): one candidate had "GIANT MAN" printed on its shirt and a second face in the sky. The other read as street height. The user asked for a redo. Pass 2 dropped `city street, from below` for `(towering over skyscrapers)1.4, (size difference)1.3, city below`, and added text and logo negatives.
- Faces: Face Fix left all six Giant faces clean.

**Test Bench row (spec-session ruling).** The `entity-images-all-hideable` rule accepts an all-ruled gallery only when two single Conditions are complementary (X and not X, or one stat's `> n` and `<= n`). It never reads group minimums, so the Type and Presentation minimums do not clear it. A by-design row covered it until the pick-group coverage fix landed on main (8b2701c83, spec-session note); after the rebase onto it, the row came out and The Creature's five images pass the rule as stored. The per-build test through play's gate stays the coverage proof.

**Bite proofs.** With the Insect rule removed, the Reptile, Arachnid and both Giant builds fail: the unruled Insect image shows beside each build's own image. With Masculine dropped from the Giant Masculine row, the Giant Feminine build fails. With Type's `minPicks` removed, the Type pick-count test fails; with Presentation's removed, the Presentation one fails.

**File size (Q13).** `src/defaultworlds/rampage.json`: 55,128,831 bytes (52.57 MB) before, 61,515,643 bytes (58.67 MB) after, all four new images lossless WebP.
