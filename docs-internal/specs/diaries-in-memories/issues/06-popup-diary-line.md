# 06: Popup Diary Line

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A character's popup shows one quiet line under the description, such as "Bram's diary · 5 entries" (spec Q7). Clicking it closes the popup and opens Memories on that character's diary, through the route ticket 04 owns. The line shows only when the character's name has at least one entry the AI reads, for authored and discovered characters alike.

- The count matches the diary view's default list: entries the AI reads, not quiet or deleted ones.
- Update the wiki page that describes the character popup, if it lists the popup's contents.

## Acceptance criteria

- [ ] A character with entries shows the line with the right count; one without shows nothing.
- [ ] Clicking the line opens Memories on that character's diary.
- [ ] Deleting or restoring entries changes the count the next time the popup opens.
- [ ] Frame `.scratch/frames/popup-diary-line.png`, dark theme, 1440×900.
- [ ] A changelog fragment, or folded into ticket 04's entry if that one is still unreleased.
