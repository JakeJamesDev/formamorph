# 07: Reader Back and Forward

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

In Wide View and the full-screen Guide, **< >** Back and Forward buttons move through the reader's view history, as in a browser (Q19–Q22).

- Each reader change is an entry: a section opened from a link, the contents, a search result or a source, and in Wide View a switch to the conversation.
- A new entry drops the forward entries. Back and Forward do not add entries. At either end, the matching button is disabled.
- Each entry keeps its scroll position, and Back and Forward restore it.
- Alt+Left / Alt+Right and the mouse back and forward buttons also move through history while the input is in the help window. The mouse buttons never reach the app's own route history.
- One history lives in the Guide view state. It records in every layout, survives a close and a change between layouts, clears on reload, and holds at most 50 entries.
- The buttons show only in Wide View and the full-screen Guide header.

Spec: Implementation Decisions → Reader history.

Recommended model rationale: a small state model, but scroll restore and the mouse-button capture across Electron and web need care.

## Acceptance criteria

- [ ] Push, Back, Forward, forward entries dropped on a new open, and the 50-entry cap, each tested; a guard is proven to bite.
- [ ] Back restores the entry's scroll position.
- [ ] Alt+Left / Alt+Right and the mouse side buttons move through history inside the window, and a mouse back press does not change the app route.
- [ ] History carries across a close and between Wide View and full screen.
- [ ] Verified through the dev-router in Wide View and full screen; buttons labeled for keyboard and screen readers.
- [ ] Changelog fragment written; four gates green.
