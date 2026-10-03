# 18: Surface registry, help for this screen

Status: done
Base: 3b5d9139
Blocked by: 01, 16
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Formaquestion knows what the player has open. When the window opens, it offers the docs section for the current screen, dialog and tab as the first item, and one click shows it.

- A small production registry records the current Surface: the open screen, the top dialog and its active tab. Screens and dialogs report to it when they open, change tab and close.
- The ids are the ones in the surface map from ticket 01. The dev router keeps working unchanged.
- A stack handles nesting: when the top dialog closes, the Surface is the dialog or screen under it.
- The window reads the Surface, looks it up in the surface map and shows "Help for this screen" with the section title. A Surface on the exclusion list shows nothing.
- The registry holds ids only. It holds no world data and no text the player typed.

Prefer one reporting point in the shared dialog and tab components over a call in every dialog. Where a dialog cannot use the shared point, report by hand and say which ones in the commit body.

The Main Menu view file is shared between sessions; stage it through a filtered patch.

Settings → Prompts per-prompt tabs and Endpoints sub-tabs had no surface id when ticket 01 shipped. If tickets 07 and 08 have not added them, report the parent tab for those.

Recommended model rationale: the registry touches every screen and dialog, and a missed close leaves a wrong Surface for the whole session.

## Acceptance criteria

- [x] The Surface is correct on the Main Menu, in the World Editor on each tab, in the game view, and in Settings on each tab
- [x] Opening a dialog over a dialog, then closing it, returns the Surface to the first dialog
- [x] A test fails when a player-facing surface id in the map is never reported by any component, or the gap is listed with a reason
- [x] "Help for this screen" shows the mapped section and opens it in the reader
- [x] A test proves the registry stores ids only
- [x] Unmount of a reporting component clears its entry; the guard is proven to bite
- [x] Changelog: folded into the Formaquestion In Progress entry
- [x] Four gates green
