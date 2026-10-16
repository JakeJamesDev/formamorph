# Narration Edit Rescan

Status: done
Status note: Closed 2026-10-16. Tickets 01–02 landed; last landing e1f8e83ef. Gates green on 2026-10-16.
Spec session: narration-edit-rescan — spec

Source: a Supporter suggestion, "Rescan Entities" (Gameplay feedback, 2026-10-12).

## Problem Statement

A player edits a turn's narration. The Entities tab still shows the scene from the old text. A character the edit removed stays listed. A character the edit added does not show, and the game never discovers them.

The stored participants get a partial update today. The edit matches known entity names against the full text. Quoted speech counts as presence, and new names are dropped. So the next turn's choices, the `<IN SCENE>` chip, and stat code `inScene` can read a cast the narration no longer describes.

## Solution

Saving a narration edit rescans that turn automatically. It reads the edited text the same way a live turn reads its narration. There is no new control.

- **Any page:** the turn's stored participants come from the edited text. Discovery runs for new names.
- **The edited page's scene list:** it is rebuilt from the edited text. Viewing that page shows it.
- **The latest page:** the live Entities tab updates too.

Nothing else re-runs. Stats and choices stay as the turn made them. Regenerate Stats and Regenerate Choices still cover that.

## User Stories

1. As a player, I want the Entities tab to drop a character I wrote out of the latest turn, so that the tab matches the story I see.
2. As a player, I want a character I wrote into the latest turn to show on the Entities tab, so that I can see who is present.
3. As a player, I want a new character I named in an edit to be discovered, so that they get a description and portrait row as if the narrator had named them.
4. As a player, I want an edit to an older page to fix that page's stored cast, so that the next three turns' presence reads the right names.
5. As a player viewing an older page I edited, I want its scene list to match the edited text, so that the page is consistent.
6. As a player editing an older page, I want the live Entities tab to stay as the latest turn has it, so that an old fix does not move the present scene.
7. As a player, I want a character named only inside dialogue in my edit to stay off the scene, so that an edit reads presence the same way a live turn does.
8. As a player in staged mode, I want cast members my edit still names to stay on the scene, so that a small fix does not drop the planner's cast.
9. As a player in staged mode, I want an unrevealed cast member to stay listed when my edit keeps their alias, so that a reveal is not forced or lost by an edit.
10. As a player, I want a discovered character to stay known when my edit removes their name, so that a typo fix does not delete a generated description.
11. As a player, I want the next turn's choices to read the edited cast, so that the choices do not act for someone who left.
12. As a world author, I want stat code `inScene` to read the edited cast on the next turn, so that presence checks match the narration.
13. As a player, I want an edit to leave the turn's stat changes alone, so that a text fix does not re-roll my stats.
14. As a player, I want an edit to leave the turn's choices alone, so that a text fix does not replace options I was about to pick.
15. As a player, I want an action edit to leave the cast alone, so that only the narration decides presence.
16. As a player, I want the edit to work without a new button, so that the list is never out of date because I forgot to press it.
17. As a player, I want a suppressed character name to stay undiscovered after an edit, so that my suppression still holds.

## Implementation Decisions

- **One read for live turns and edits.** A new pure function sits beside the Narration Reading. It takes the edited narration, the prior narration, the known entities, the character exclusions, and the page's previous scene list. It returns the turn's participants and the new scene list.
- **Participants** come from the Narration Reading with no planner candidates. Quoted speech is stripped. Narrated names are included.
- **Scene list.** The previous scene list's members stay when the edited text still names them, by a loose match on name or alias. This is the match the live planner-confirmation source uses, but it reads the quote-stripped prose, so a member the edit names only in dialogue leaves. A kept member keeps its reveal flag, and it also reveals when the edit writes the real name. An edit never un-reveals anyone. The narration parse (no cast) adds the rest. A narrated name not yet known joins as revealed, as on a live turn.
- **No stored cast.** The planner's cast is not saved with a turn, and this spec does not add it. The previous scene list stands in for it.
- **Discovery needs no new path.** The Background Pass Queue already scans every turn's stored participants for unknown names. A name written into a turn's participants is discovered with that turn as its source. Suppressed names stay excluded there.
- **Writes on save.**
  - The turn's stored participants are replaced. The digest and diaries are still cleared, as today.
  - The edited page's snapshot scene list is replaced.
  - The live scene list is replaced only when the edited page is the latest page.
- **Ownership.** The exclusions and the snapshot list live in the game view, not in the panel. The save handler gets the rescan as a callback from the view, so the panel does not reach for gameplay state it does not own.
- **Discovered entities are never removed** by an edit. They leave the scene list only. Rollback and regenerate keep their own pruning.
- **Action edits** keep today's behavior: no rescan.
- **No save-shape change.** The snapshot scene list field already exists.

## Testing Decisions

- Tests read external behavior: the returned participants and scene list, and the state the save leaves behind. They do not assert call order or internal helpers.
- **The pure function** is tested in the Narration Reading's test file. Cases: a removed name leaves; an added known name joins; a new name is a participant and a revealed scene row; a quoted-only name stays out; a kept cast member stays by name and by alias; an unrevealed member stays unrevealed; a suppressed name is not a participant.
- **The save** is tested through the game panels harness. Cases: a latest-page edit updates the stored participants, that page's snapshot, and the live list; an older-page edit updates its participants and snapshot and leaves the live list; an action edit changes none of them.
- Prior art: the existing Narration Reading tests, and the game panels harness tests for the narration editor.
- Each guard is proven to bite by putting the old full-text match back and watching the quoted-only and new-name cases fail.

## Out of Scope

- A manual Rescan button.
- Re-running stats or choices after an edit.
- Removing a discovered entity whose name an edit removed.
- Storing the planner's cast with each turn.
- Rescanning on action edits.
- Re-running the staged planner to rebuild the cast.

## Further Notes

- Changelog: one 👤 Fixed line under the Minor bucket.
- Help copy: the How to Play section on editing narration should say the cast updates. Check it during the ticket.
