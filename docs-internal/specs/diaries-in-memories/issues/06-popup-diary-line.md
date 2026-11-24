# 06: Popup Diary Line

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A character's popup shows one quiet line under the description, such as "Bram's diary · 5 entries" (spec Q7). Clicking it closes the popup and opens Memories on that character's diary, through the route ticket 04 owns. The line shows only when the character's name has at least one entry the AI reads, for authored and discovered characters alike.

- The count matches the diary view's default list: entries the AI reads, not quiet or deleted ones.
- Update the wiki page that describes the character popup, if it lists the popup's contents.

## Acceptance criteria

- [x] A character with entries shows the line with the right count; one without shows nothing. (DOM read "Bram's diary · 5 entries"; `EntityModal diary line` tests)
- [x] Clicking the line opens Memories on that character's diary. (live click: popup closed, "Bram's Diary" tab selected)
- [x] Deleting or restoring entries changes the count the next time the popup opens. (`readEntryCount` tests)
- [ ] Frame `.scratch/frames/popup-diary-line.png`, dark theme, 1440×900. (stored at 800×600, see Landed)
- [x] A changelog fragment, or folded into ticket 04's entry if that one is still unreleased. (`docs-internal/changelog.d/diaries-in-memories-06.md`)

## Landed

**Not verified**
- Frame at 1440×900: the Browser pane rendered the page at 800×600, so the stored frame is that size, dark theme.
- Deleting or restoring entries changing the popup's count in the live app: covered by `readEntryCount` unit tests (delete, restore) only; the popup reads the layer fresh each time it opens.

**For you**
- Open a character popup on a save with diaries: check the line's weight and spacing under the description (`.scratch/diaries-in-memories-06/frames/popup-diary-line.png`).
