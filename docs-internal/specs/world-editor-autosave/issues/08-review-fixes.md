# 08: Auto Save Review Fixes

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: two save races and dialog interplay across both editor hosts; each fix needs a test that bites.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

The spec review after tickets 01–07 found races and gaps. Fix them as one unit.

### Races

- **A save lands on the wrong world.** The world save never re-checks the open world id after its awaits. An auto save that runs while the author leaves into another world (for example the tour offer) sets the new world's baseline, marks it stored, and makes a never-saved world auto save (breaks Q10). A save whose world is no longer open must not touch the baseline, the stored flag or the discard snapshot.
- **An auto save answers the two-tab dialog.** The save settles heard announcements on any success. If the threshold or idle timer fires after a message lands but before the scheduler effect pauses it, the dialog never shows and this tab overwrites the other tab's save. Only a manual save settles (Q35), and the listener pauses auto save at once, not on the next render.
- **Clean leave doesn't wait.** Leaving with a clean world closes at once in both hosts, while a running save can still land. Both hosts wait for running saves on every leave path, so the store matches disk when the editor closes.

### Dialogs

- **In-game Save & Exit on failure.** The in-game prompt's Save closes the editor even when the save fails. Keep it open on failure, as the menu editor does (Q17).
- **Stacked dialogs.** The unsaved-changes prompt and the two-tab dialog can be open at once. After Reload the leftover prompt still says there are unsaved changes, and its Save trips the other tab. The two-tab dialog closes or supersedes the unsaved-changes prompt.
- **Exit copy.** "Auto Save kept the rest" is false when auto save never joined the world (new world, unedited bundled default, during the tour). Show the auto save copy only when auto save actually ran for this world. Quote the named control per the Writing Guide.
- **Delete dialog copy** tells the author to close the other tab (Q40).
- **Deleted-default tombstone.** Keep Mine after a bundled default was deleted in another tab clears its tombstone, so Settings' deleted-default count is right.

### Save face

- An undo back to clean during the Saved hold must not bring back a stale Saved after a mid-save edit returned the face to pending.
- The Failed face's accessible description says that activating it retries.
- Saved uses the full `success` fill with `success-foreground` text and icon, not the 20% tint (Q41). Remove the Saved contrast assertion from the save-button e2e; keep the Failed and width checks. Update the Design System entry.

### Tests and copy

- Tests that bite (prove each by reinstating the bug): the two races, the clean-leave wait, the Q29 tour pause, the recorder's Q30 merge flag, the two-tab dialog in the in-game host, and the delete dialog's outside press.
- Fix the auto save idle test that races `waitFor`'s faked timeout; advance the full pause.
- The "ends Saved on an edit" integration test must fail without the edit-edge effect.
- Optimize Images tooltip: verb-first, common words, one shared string.
- Shorten the three-line comment beside the Optimize Images button.

Rulings: Q10, Q17, Q29, Q30, Q35, Q38, Q40, Q41.

## Acceptance criteria

- [ ] Each race has a test that fails with the race reinstated.
- [ ] Leaving a clean world waits for a running save in both hosts.
- [ ] Failed in-game Save & Exit keeps the editor open and the leave prompt armed.
- [ ] The two dialogs never show at once.
- [ ] Exit copy is true for every world; the delete dialog says to close the other tab.
- [ ] The deleted-default count is right after Keep Mine.
- [ ] No stale Saved after undo; Failed's accessible description names the retry.
- [ ] Saved shows the full success fill (Q41).
- [ ] Listed test gaps closed; the flaky idle test fixed.
- [ ] Copy passes the copy sweep. Changelog fragment written.
