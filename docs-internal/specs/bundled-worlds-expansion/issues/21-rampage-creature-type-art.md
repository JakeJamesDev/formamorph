# 21: Rampage Creature Type Art

Status: ready-for-agent
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

- [ ] The Creature has four images, each with a Visibility rule on one Type trait, Reptile in slot 0 with the existing art, and the stripped diff shows only those rules, the three new images, the Type group's minimum, and the fingerprints.
- [ ] A test picks each Type trait in turn and reads the visible gallery through play's gate function, seeing exactly that type's image, and is shown to bite with a rule removed.
- [ ] The Type group requires one pick, shown by the shared suite's Test Bench rows staying empty and the pick-count test for the group.
- [ ] The contact sheet is at `.scratch/frames/rampage-creature-sheet.png` with the three new images labeled by type, and each seed is in this ticket's comments.
- [ ] The world file's size before and after is in this ticket's comments.

For you: open the contact sheet and reject or redo by type. In play, pick each Type at Enter World and check The Creature's image matches.
