# 14: Prototype, the window above dialogs

Status: ready-for-human
Status note: Prototype built and proven on `prototype/formaquestion-window` (`d487605e`). The layering works. The user approves the layering approach, picks a window structure and a launcher, and rules on five open decisions. See Answer.
Base: 9edac2fd
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A throwaway prototype answers two questions before any window ticket starts:

1. **Can a floating window stay usable while one of our dialogs is open (Q21)?** Our dialogs make everything outside them inert, trap focus and lock scroll. The prototype mounts one window at the app root and proves, in the real app with the real dialog components:
   - the player can click and type in the window while a dialog is open
   - the player can click and type in the dialog behind the window
   - Escape closes the top dialog and leaves the window open
   - a popover inside a dialog still opens above the dialog and works
   - nested dialogs still work
   - the window is in a sensible place in the tab order, and a screen reader does not see it as hidden
2. **What do the window and its button look like (Q13, Q22)?** Show the fixed button on the Main Menu, the World Editor and the game view, and the floating window with its three parts: conversation, search results, reader with a contents list. Show drag and resize. Show the mobile full-screen sheet as a static frame. Fake the content; no AI call and no docs index.

Use the `/prototype` workflow: its own worktree, branch and port. Follow the design system for everything that has a pattern already. List each thing that is a new pattern.

If the first approach to question 1 fails, try the dialog library's full option space before reporting a limit. Report what was tried.

Hand over with static frames in both themes and a Playwright run that proves each bullet of question 1. The user approves the look and the layering approach, or redirects. The approved decisions go into the spec as rulings, and the new patterns go to the design system as a proposal.

Recommended model rationale: the inert scope, focus trap and scroll lock of the dialog library are the largest technical risk of the effort.

## Acceptance criteria

- [x] Each bullet of question 1 has a Playwright assertion that passes, or a written finding of what failed and what was tried
- [x] The layering approach is written down in a few sentences that ticket 16 can build from
- [x] Static frames show the button on three screens and the window in both themes, at a realistic viewport
- [x] A static frame shows the mobile sheet
- [x] Every new visual pattern is listed for approval
- [x] No production file changes outside the prototype branch
- [x] Status moves to `ready-for-human` for the user's approval

## Answer

| | |
|---|---|
| 🌿 Branch | `prototype/formaquestion-window`, commit `d487605e` |
| 📁 Worktree | `.claude/worktrees/prototype-formaquestion-window` |
| ▶️ Run | Launch entry `proto-formaquestion-window` (port 5216). From the worktree: `npx vite --port 5216 --strictPort --force` |
| ✅ Proof | `npx playwright test -c playwright.prototype.config.ts prototype.spec` → 27 pass |
| 🖼️ Frames | `npx playwright test -c playwright.prototype.config.ts frames.spec` → `.scratch/formaquestion-window/review/` in the worktree |
| 📖 Start here | `src/prototype/formaquestion/README.md`, then `helpLayer.ts` |

### Question 1: yes, the window stays usable above every dialog

> **Verdict:** one window at the app root works above our real dialogs, alert dialogs, nested dialogs and drawers. No dialog changes its modality.

#### The layering approach, for ticket 16

1. **One host element on `<body>`**, made once at start. The window and the launcher render into a mount element inside it through a React portal. The host has `z-index: 65`: above dialogs, popovers and selects (50), below the chip typeahead (70) and tooltips (80).
2. **The host shields itself from the four things that have no library option.**

   | A modal dialog does this to everything outside it | The answer |
   |---|---|
   | Sets `pointer-events: none` on `<body>` | Layer children set `pointer-events: auto` |
   | Marks every other body child `aria-hidden` | The host has `aria-live="off"`. The `aria-hidden` package keeps every `[aria-live]` node |
   | Traps focus: `focusin` and `focusout` listeners on `document` | `focusin` stops at the host. A `focusout` that moves focus into the layer stops at `<body>` |
   | Locks scroll: cancels `wheel` and `touchmove` on `document` | Both stop at the host |

3. **The dialog wrappers handle the two things that do have a library option.** `dialog.tsx`, `alert-dialog.tsx` and `drawer.tsx` read a `data-help-layer` mark on the host.
   - `onPointerDownOutside` and `onInteractOutside`: a press in the layer does not close the dialog.
   - `onCloseAutoFocus`: a dialog that closes does not take focus from the layer. The caller's own handler still runs.
4. **An overlay that the window opens must render inside the layer** (`portal={false}`, or a portal container inside the host). A popover portaled to `<body>` lands under the window.
5. **The launcher lives in the same layer.** On mobile there is no F1, so the launcher is the only way to open help from inside a dialog.

React handles each stopped event first. Its listeners sit on the mount element inside the host, and on the portal containers under `<body>`.

#### What the proof shows

| Ticket bullet | Result | Test |
|---|---|---|
| Click and type in the window while a dialog is open | ✅ | takes clicks and typing; scrolls with the wheel; scrolls by touch |
| Click and type in the dialog behind the window | ✅ | leaves the dialog behind it usable; a dialog under an overlapping window |
| Escape closes the top dialog and leaves the window open | ✅ | Escape closes the top dialog; a dialog that closes does not take focus |
| A popover inside a dialog still opens above it and works | ✅ | a popover and a select inside the dialog |
| Nested dialogs still work | ✅ | nested dialogs; an alert dialog above a dialog; works above a drawer |
| Sensible tab order, and a screen reader does not see it as hidden | ✅ | a screen reader sees the window; with no dialog open |

Seven controls remove one shield part each and show the failure that part prevents. One baseline shows that the touch swipe scrolls with no dialog open.

#### Findings for ticket 16

- 🔁 **Tab order.** The layer follows the page: launcher, then window. With a dialog open, Tab from the dialog cannot reach the window, because the dialog loops Tab. F1 or a press moves focus in. Tab past either end of the layer returns to the dialog, never to the page behind it.
- 🎯 **The first press guard was wrong.** A `pointerdown` stop at the host kept the dialog open, but popovers and menus dismiss from the same `document` event, so they stayed open too. The wrapper guard replaced it.
- 🧩 **A caller's close handler runs first.** Several call sites refocus their own opener in `onCloseAutoFocus` (the preset confirm in Settings is the tested one). The wrapper records the focused layer element before the caller runs, then returns focus to it.
- 📦 **The wrappers cannot import a help module.** The account site bundles `dialog.tsx`, and `site/bundleBoundary.test.ts` failed on the import (50 modules, ceiling 49). The prototype uses a DOM mark and repeats a three-line helper in three files. Ticket 16 picks: raise the ceiling for one leaf helper, or keep the mark inline.
- 🔎 **The `aria-live` rule is not in the `aria-hidden` docs.** It is in its source (`hideOthers`, issue 10 in its comment), at version 1.2.4. A control test guards it. The fallback is a MutationObserver that removes `aria-hidden` from the host.
- ⬇️ **A `focusout` stop at the host is not needed.** The stop at `<body>` covers moves between two layer controls.

#### Not proven here

| Item | State |
|---|---|
| A real screen reader (NVDA, TalkBack) | UNVERIFIED. Only the accessibility tree was checked |
| A real phone: the on-screen keyboard over the sheet, real touch | UNVERIFIED. Touch scroll ran through emulated touch events |
| The Android back button with the sheet open | Not built |
| Context menus (a second copy of the focus and dismiss packages under `react-menu`) | Not tested. The shield stops events before `document`, so it does not depend on the copy |
| Other options of the dialog library | Read in source, not run, because the first approach worked: `modal={false}` (removes the dim sheet, the trap and the lock for every dialog), `DismissableLayerBranch` (covers only the press, and two package copies exist), a paused focus scope |

### Question 2: the look

All frames are in `.claude/worktrees/prototype-formaquestion-window/.scratch/formaquestion-window/review/`. Desktop frames are 1600×900. Mobile frames are 375×812. Switch live with the bar at the bottom of the prototype, or with `?fq=A|B|C&fqButton=icon|pill|tab&fqState=ready|busy|noai`.

#### Window structure (pick one)

| | Structure | Default size | Frames (`-dark` and `-light`) | Trade-off |
|---|---|---|---|---|
| **A** | **Tabs**: Ask · Search · Guide, one part at a time | 400×560 | `window-A-ask`, `-search`, `-reader`, `-contents`, `-above-settings`, `-moved-and-resized` | Smallest and clearest. A source opens the Guide tab, so the conversation leaves the view |
| **B** | **One Field**: one field asks and searches; matches show above it; the reader stacks on top | 400×560 | `window-B-ask`, `-matches`, `-reader`, `-contents` | Least chrome, and the no-AI state needs no second field. Enter always asks, which can surprise a player who wanted to search |
| **C** | **Two Panes**: a rail with search and contents, a pane with the conversation or the reader | 720×520 | `window-C-ask`, `-reader`, `-search` | Best for reading the guide. It covers the most of the dialog behind it |

Recommendation: **A**. Stories 7 and 8 need the dialog behind the window to stay in view, so the small window matters most.

Other frames: `state-turn-running-dark`, `state-no-ai-dark`, `state-no-ai-B-dark`, `switcher-bar-dark`, `mobile-sheet-A-ask`, `mobile-sheet-A-reader`, `mobile-sheet-B-ask-dark`, `mobile-sheet-C-ask-dark`, `mobile-sheet-C-contents-dark`.

#### Launcher (pick one)

Frames: `launcher-<icon|pill|tab>-<main-menu|world-editor|game>-<dark|light>`, and the same with a `mobile-` prefix. The app controls under each launcher are measured in `launcher-collisions-desktop.json` and `launcher-collisions-mobile.json`.

| Launcher | Desktop: covers | Mobile: covers |
|---|---|---|
| `icon`: round button, bottom right | GitHub Repository link (Main Menu), Re-generate Stats (game) | More (Main Menu), **Send** (game) |
| `pill`: labeled button, bottom right | Patreon and GitHub links (Main Menu), Edit Stats (game) | Replay Intro and More (Main Menu), the **action field**, About How to Play and **Send** (game) |
| `tab`: tab on the right edge, at mid height | Nothing | The edge of one world card (Main Menu), the edge of one field (World Editor) |

Recommendation: **`tab`**. No corner is free on all three screens. The bottom-right launchers cover Send on mobile.

#### New visual patterns, for approval

| # | Pattern | Where |
|---|---|---|
| 1 | **Fixed launcher** above every layer | All screens |
| 2 | **Floating window**: title bar that drags, corner grip that resizes, non-modal, above dialogs | Desktop |
| 3 | **Full-screen sheet** for a non-modal surface | Mobile |
| 4 | **Source link**: a "Page › Heading" chip under an answer | Conversation |
| 5 | **Not-from-the-guide notice**: a warning-tinted line above an answer | Conversation |
| 6 | **Question bubble**: the player's question, right-aligned on `muted` | Conversation |
| 7 | **Search result row**: heading, page, two-line excerpt | Search |
| 8 | **Reader**: page name, heading, body, an On This Page list, a Back row | Guide |
| 9 | **Send reason**: a help line under the field when Send is unavailable | Ask field |

Existing patterns and components in use: `Button`, `Input`, `Textarea`, `Tabs`, `ScrollArea` (Standard: Scrollbars), `Tip`, `CompactSelectionRow` (Compact Selection Lists) for the contents lists, the typography roles, `MarkdownRenderer`, the semantic `warning` token, the shared focus ring.

### Open decisions for the user

| # | Decision | The prototype does |
|---|---|---|
| D1 | **F1 with the window open and focus elsewhere.** The spec says F1 toggles | Moves focus into the window. A second F1 closes it. With a dialog open, F1 is the only keyboard way in |
| D2 | **Escape with no dialog open and focus in the window** | Nothing. Only F1 and Close close the window |
| D3 | **Launcher label.** Q27 names the feature Formaquestion; a new player looks for Help | Shows "Formaquestion" on the pill and the tab |
| D4 | **The launcher above dialogs.** It then also sits over dialog content | In the layer, above dialogs |
| D5 | **The chip typeahead (z-70) paints above the window** when the two overlap | Left as is |

After approval, the rulings go into the spec and the approved patterns go to the Design System as a proposal.
