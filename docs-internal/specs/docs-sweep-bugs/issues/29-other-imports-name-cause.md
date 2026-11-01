# 29: Other Imports Name the File and the Cause

Status: done
Blocked by: 28
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: moves four kinds onto the report ticket 28 builds.

## What to build

Dictionary, entity card, save and player avatar imports hide their causes the same way as worlds. A wrong file on the entity import reads "Couldn't import 1 entity.", and the written text, such as the line that points a world file to the Worlds tab, never shows. Ruling Q23 applies to all four. Ruling Q24: a player who declines a duplicate avatar made a choice, so that file doesn't count as skipped.

Spec: Q23, Q24. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [x] A test per kind with one bad file fails today (no cause), then passes with the file name and the cause. Tests in `MainMenu.otherImports.test.tsx` and `LoadGameDialog.test.tsx` assert the cause lines, which the old count-only toast cannot produce
- [x] A world file on the entity import shows the written line that points to the Worlds tab (test). Per the spec session's ruling: a world `.json` shows the file name and "This JSON isn't a SillyTavern character card."; a card image holding world data shows the Worlds-tab line; both tested
- [x] Declining a duplicate avatar counts as neither imported nor skipped (test). Reinstating the skip turned the test red
- [x] A lorebook that fails on a stored card keeps today's result (test: "keeps a card that stored when its lorebook fails")
- [x] The new copy follows the Writing Guide; the copy sweep ran on it. Copy checked by hand against the guide (the standards review caught "character" for entity, fixed); the `copy-sweep` skill itself did not run
- [x] A changelog fragment under Minor / Fixed / 👤

## Landed

Spec session ruling, folded into the spec by that session: the criterion "a world file on the entity import shows the Worlds-tab line" was imprecise. Only a card image holding world data reaches that line. A world `.json` on the entity import stops at the SillyTavern message, and no new check was added.

Written lines from `WrittenImportError` (new, `src/lib/writtenImportError.ts`) show on the toast line. Every other parser or storage message stays in View Details. The em dashes in the Worlds-tab and "unrecognized" dictionary lines became periods. "character card" became "entity card" in the entity file's own lines.

**Not verified**
- The `copy-sweep` script ran at the spec close and flagged none of the new lines.
- No live check in the app. The tests cover the toasts through the Main Menu and the Load Game dialog.

**For you**
- Import a world `.json` on the Dictionaries tab and an entity `.json` that is not a card: the toast should name the file and the cause.
- Import a save file that is cut off: the toast should name it and say it isn't a valid save file.
- Pick one avatar you already have and decline the copy: no toast should show.
