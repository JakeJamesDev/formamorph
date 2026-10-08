# World Editor Auto Save

Status: ready-for-agent
Spec session: world-editor-autosave — spec

## Problem Statement

The World Editor saves only when the author clicks Save or presses Ctrl+S. An author who forgets to save loses every edit since the last save when the tab closes, the app crashes, or they pick Exit in the unsaved-changes prompt by mistake. Closing or reloading the browser tab shows no prompt at all.

The editor now has undo and a History list. A save no longer needs to be a deliberate checkpoint, because undo reaches back past it. Manual-only saving is now friction with no benefit.

Time-based auto save is a poor fit. An author who writes three paragraphs wants them saved soon. An author who adds a tag or flips a toggle cares less, even if that is more actions.

## Solution

- **Save by amount of change, with an idle backstop.** Each edit adds weighted units to a pending count. Text counts one unit per character changed. A discrete action counts ten. At about 300 units, the editor saves. Any pending change also saves after a 30 s pause.
- **Save shows its own state.** The Save button turns into Saving…, then Saved, then fades back to today's muted Save. A failed save shows Couldn't Save and stays until it resolves.
- **Save becomes a split button.** Its menu holds Export World and an Auto Save toggle, default on. The More world actions menu goes away. Optimize Images becomes its own icon button in Advanced mode.
- **Leaving stays guarded.** The unsaved-changes prompt still shows for pending changes. A browser leave prompt now covers tab close and reload.
- **Two tabs can't overwrite each other unseen.** A tab that sees the world saved elsewhere pauses auto save and offers Reload or Keep Mine.

Research behind the trigger model: Vim refreshes its swap file after 200 characters or 4 s idle. Emacs auto-saves after 300 characters or 30 s idle. VS Code offers a delay, focus loss or window loss. Word's AutoRecover uses a 10 min timer. Cloud editors (Google Docs, Figma) sync every operation. The character-plus-idle pair is the closest match to "save after a lot of change, but never leave a small change unsaved forever."

## User Stories

### Saving

1. As an author, I want my world saved after I write a large amount of text, so that a long writing run is never at risk.
2. As an author, I want a small change saved after I pause, so that one tag or toggle doesn't stay unsaved forever.
3. As an author, I want a run of quick clicks to save without waiting for a pause, so that clicky work is protected too.
4. As an author, I want auto save on by default, so that I'm protected without finding a setting.
5. As an author, I want to turn auto save off from the Save menu, so that I can go back to saving by hand.
6. As an author, I want to set the idle pause in Settings, so that I can trade fewer writes for less risk.
7. As an author, I want Save and Ctrl+S to keep working with auto save on, so that my habit still forces a save now.
8. As an author, I want a new world to stay out of my library until I save it once, so that abandoned test worlds don't pile up.
9. As an author, I want auto save in the in-game world editor too, so that edits during play are as safe as in the menu.

### Save button state

10. As an author, I want the Save button to show Saving… while a save runs, so that I see the editor working.
11. As an author, I want it to show Saved and then fade back to muted Save, so that I get confirmation without lasting noise.
12. As an author, I want a failed save to stay visible on the button, so that I can't miss it.
13. As an author, I want the button to keep its width through every state, so that the app bar doesn't shift on each save.
14. As a screen-reader user, I want each save state announced, so that I get the same confirmation.

### Failure

15. As an author, I want the first failed auto save to show the failure toast with Export World, so that I can rescue my work.
16. As an author, I want auto save to pause after a failure until a manual save works, so that I don't get a toast every 30 s.

### Leaving

17. As an author, I want the unsaved-changes prompt when I leave with pending changes, so that leaving is still my choice.
18. As an author, I want Exit in that prompt to drop only the changes since the last save, so that I know what I'm throwing away.
19. As an author, I want a browser prompt when I close or reload the tab with unsaved changes, so that a stray close doesn't lose work. This holds with auto save on or off.

### Two tabs

20. As an author, I want a tab to notice when the same world was saved in another tab, so that a stale tab doesn't overwrite newer work.
21. As an author, I want that tab to offer Reload or Keep Mine, so that I choose which copy wins.

### History

22. As an author, I want auto saves to stay out of History, so that my undo steps match what I did, not when the timer fired.

### App bar

23. As an author, I want Export World in the Save menu in both modes, so that I find it in one place.
24. As an Advanced author, I want Optimize Images as its own icon button, so that I reach it without a menu.

## Implementation Decisions

### Rulings

| # | Ruling |
|---|---|
| Q1 | Auto Save is on by default. Authors can turn it off. |
| Q2 | Two triggers: amount of change and idle time. No fixed timer. Leaving the editor is not a save trigger (see Q5). |
| Q3 | The Save button itself shows auto save state. Pending: **Save**, enabled. Saving: spinner, **Saving…**. Saved: check, **Saved**, on a muted success tint, then fades after about 2 s to today's muted **Save**. Failed: alert icon, **Failed** (Q27), destructive fill, enabled, no fade; its tooltip says the save failed and a click tries again. Every label stacks in one grid cell, so the face is as wide as **Saving…** and never shifts. A polite `aria-live` region carries the same status. Mobile's icon-only Save morphs its icon the same way. Prototype approved: variant A. |
| Q4 | The Save button and Ctrl+S stay. Both force a save now. |
| Q5 | Leaving the editor with pending changes shows today's unsaved-changes prompt. |
| Q6 | The idle pause defaults to 30 s. |
| Q7 | The change threshold is about 300 units. One character changed is 1 unit. |
| Q8 | Authors can change the idle pause. The threshold is fixed. |
| Q9 | With auto save on, Exit in the unsaved-changes prompt drops only the changes since the last save. Its copy says so. |
| Q10 | A world never saved by hand does not auto save. The first manual save opts it in. |
| Q11 | On the first auto save failure, today's failure toast shows, with Export World on a full disk. The button shows Couldn't Save. Auto save pauses until a manual save succeeds. |
| Q12 | A discrete action (tag, toggle, option pick, image, add, remove, reorder) counts 10 units. |
| Q13 | The in-game world editor follows the same rules. |
| Q14 | A `beforeunload` prompt shows when the tab closes or reloads with unsaved changes. |
| Q15 | A two-tab guard is in scope. |
| Q16 | The idle pause ranges from 10 s to 5 min. |
| Q17 | The browser leave prompt (Q14) shows whenever the world is dirty, with auto save on or off. |
| Q18 | A tab that sees its world saved in another tab pauses auto save and shows a notice with **Reload** (load the other tab's save) and **Keep Mine** (the next save overwrites it). |
| Q19 | An auto save does not move the History Saved marker and does not seal or split a Step. Only a manual save does. |
| Q20 | Save becomes a split button. Its menu holds **Export World** and the **Auto Save** toggle. The **More world actions** menu goes away. **Optimize Images** becomes its own app-bar button, shown in Advanced mode only. |
| Q21 | The idle-pause slider lives in Settings. |
| Q22 | The Auto Save toggle is one app preference for all worlds. It is not stored in the world file. |
| Q23 | Optimize Images is an icon button with a tooltip. It shows a spinner while it runs, and progress shows in the tooltip. |
| Q24 | The Simple-mode Export World icon goes away. Both modes reach Export World from the Save menu. |
| Q25 | The Settings rows sit next to **Authoring Tour**. No new section. |
| Q26 | Settings shows the Auto Save toggle and the idle slider. The slider hides when Auto Save is off, per the settings off-state pattern. The Settings toggle and the Save-menu toggle are one preference. |
| Q27 | The failure label is **Failed**. |
| Q28 | No new color token. The Saved tint is `success` at 20%. Its label and icon use the normal text color, because green text on the tint measured 2.23:1 in light mode. |

### Prototype

Branch `prototype/autosave-button`, final commit `878f9cfb`, launch entry `proto-autosave-button` on 5255. Question: how does Save show auto save state? Verdict: variant A, with Q27 and Q28. `#dev?view=mainMenu&modal=worldEditor&proto=A&sheet=1` shows every variant in every state.

### Facts the design rests on

- `saveWorld` in [GameDataContext.tsx](../../../src/contexts/GameDataContext.tsx) writes the whole world, inline base64 images included, to IndexedDB `worldsDB`. Save is local only; publishing is a separate action.
- `isWorldDirty` is a canonical deep compare against the `savedWorld` baseline. `discardChanges` reloads that baseline.
- History survives a save and marks the saved step (`history.saved`). Merges never cross that marker. Q19 means auto save must save without placing it.
- A new world is not in the library until its first save ([MainMenu.tsx:1474](../../../src/views/MainMenu.tsx)).
- No `beforeunload` handler and no cross-tab guard exist today. Each save fully replaces the record, so the last writer wins.
- [split-button.tsx](../../../src/components/ui/split-button.tsx) already exists in the design system, so the split control is not a new pattern. The fade (Q3) is.

### The change meter

- A pure module measures each committed world change in units: text by characters changed, everything else by the discrete weight. It reads the same committed changes the History recorder sees.
- The meter resets on every successful save, manual or auto.
- The scheduler fires a save when the count reaches the threshold, or when the idle pause passes with a nonzero count. It does nothing while a save runs, while paused by failure (Q11), or while paused by the two-tab guard (Q18).

### Points to check during build

- The in-game editor's Exit does not call `discardChanges` today ([GameViewer.tsx:4804](../../../src/views/GameViewer.tsx)). Q9 needs that path to drop pending changes.
- A comment at [MainMenu.tsx:820](../../../src/views/MainMenu.tsx) assumes the store matches disk when the editor closes. Confirm it still holds.
- The Authoring Tour saves on every Next and anchors on `data-tour-anchor="save"`. The anchor moves to the split button's main half.
- Save's main half is disabled when clean. The menu half stays enabled in every state.

## Testing Decisions

- The change meter and scheduler are pure and take time as a parameter. Unit tests drive them with fake timers: threshold hit, idle hit, reset on save, pause on failure, pause on guard.
- Each pause must be proven to bite: reinstate the missing guard and watch its test fail.
- Integration tests on the editor bench cover: auto save fires and the button walks Saving… → Saved → Save; a failure keeps Couldn't Save and pauses; a never-saved world does not auto save; History's Saved marker does not move on auto save.
- The fade timing is motion. It needs Playwright per-frame sampling, not the Browser pane.
- The two-tab guard gets an e2e test with two pages on one profile.

## Out of Scope

- Saving history or pending edits across a reload or crash.
- Partial or incremental world writes. Each save still writes the whole world.
- Per-world auto save preferences.
- Auto save for anything outside the World Editor (game saves already have their own).

## Further Notes

- Nothing here changes the world or save export shape.
- If `DEFAULT_*` settings get `VITE_DEFAULT_*` twins, the user updates `.env.local`.
