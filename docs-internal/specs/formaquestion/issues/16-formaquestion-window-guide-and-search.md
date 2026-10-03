# 16: Formaquestion window, guide and search

Status: done
Base: 09b3a024
Blocked by: 14, 15
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A player can open **Formaquestion** on every screen, browse the full guide and search it, with no AI. This is the first shippable slice of the window.

- A fixed button sits at the same place on every screen. F1 opens and closes the window (Q22). F1 and the button are inactive while the welcome animation covers the Main Menu. A tutorial note or an Authoring Tour step does not block F1.
- The window floats above every dialog and stays usable while a dialog is open (Q21). Build the layering approach that ticket 14 proved, and the look the user approved there.
- The player can move and resize the window. Position and size are remembered on the device in browser storage, wrapped so a blocked storage does not break the window. The window stays inside the screen after a browser resize.
- **Contents:** a list of every docs page and its sections (Q25).
- **Reader:** shows a section as formatted markdown. A link to another docs page opens in the reader. A link to an outside site opens in the browser.
- **Search:** the player types words and gets ranked sections, each with its page and heading. A click opens the section in the reader.
- The window stays open and keeps its state when the player changes screens.
- A new docs page describes Formaquestion itself, so the window's own surface passes the coverage test.
- The window gets a dev-router entry. The button and the window get design-system entries for the patterns the user approved.

Rulings Q33–Q44 in the spec settle the structure (one design at two widths, with tabs in the narrow one), the movable edge-tab launcher labeled **Help**, the motion, F1 and Escape, and the layering. Build from ticket 14's "The layering approach, for ticket 16" list, not from the prototype code. Add the ten approved patterns to the Design System as a proposal.

This ticket does not build the ask field, the mobile sheet or the "help for this screen" jump. On mobile sizes the button is hidden until ticket 17.

Recommended model rationale: the layering against the dialog library and the shared root placement touch every screen; a mistake here breaks dialogs app-wide.

## Acceptance criteria

- [x] The button shows on the Main Menu, the World Editor and the game view, and F1 toggles the window on each
- [x] Playwright: with Settings open, the player types in the window's search field, then types in a Settings field, then presses Escape; Settings closes and the window stays
- [x] Playwright: a popover inside a dialog still opens and works while the window is open
- [x] Drag and resize work; position and size survive a reload; the window returns inside the screen after a resize
- [x] The contents list shows every indexed page; a click shows the section
- [x] Search shows ranked sections for a query and an empty state for no match
- [x] An in-docs link opens in the reader; an outside link opens in the browser
- [x] Unmount leaves no timer or listener behind; the test run exits 0
- [x] `verify-ui` evidence in both themes at a realistic viewport
- [x] Changelog line under In Progress
- [x] Four gates green

## Comments

**Built.** The window, the Help tab, the guide and the search are in the app, with no AI call.

| File | Role |
|---|---|
| `src/components/ui/shielded-layer.ts` | The layer on `<body>` at z-65, and the two guards the dialog wrappers use |
| `src/components/formaquestion/Formaquestion.tsx` | The one instance: F1, focus, motion, the stored place, the docs load |
| `src/components/formaquestion/EdgeTab.tsx` | The Help tab: drag, arrow keys, the stored place |
| `src/components/formaquestion/FormaquestionFrame.tsx` | Title bar, Wide View, Close, the resize grip |
| `src/components/formaquestion/GuideBody.tsx`, `GuideParts.tsx` | Narrow and wide layouts; search field, results, contents, reader |
| `src/lib/formaquestion/` | Window geometry, tab place, the guide model. No React |
| `src/lib/docs/docsReader.ts` | Docs links to section ids, the reader's body and the search excerpt |
| `docs/Formaquestion.md` | The page that covers the window's own surfaces |
| `src/lib/docs/docsLinks.ts` | The grammar of a docs link, shared by the coverage checks and the reader |
| `e2e/formaquestion.spec.ts` | 19 Playwright tests |

**Rulings from the spec session (2026-10-01).**

- F1 and the tab are inactive only while the welcome animation covers the Main Menu. A tutorial note does not block F1.
- This ticket ships two tabs, **Search** and **Guide**, and no Clear button. Ticket 20 adds **Ask** as the first tab.
- Under the mobile breakpoint there is no tab, F1 does nothing, and an open window hides with its state kept.
- A press on the Help tab closes an open window, as in the prototype (Q37).
- The contents list is one collapsible row per page with a plain chevron (Q45).
- Ticket 22 owns the `CONTEXT.md` terms Formaquestion, Docs Index and Surface.

**Picks made here.**

- 📦 The dialog wrappers share one leaf helper. The site bundle ceiling went from 49 to 50 on purpose, and a new test keeps the helper a leaf.
- ⌨️ The tab moves with the arrow keys while it has focus. An arrow along the edge moves it, and it turns the corner at the end. An arrow away from the edge sends it to the opposite edge. A screen-reader description says so.
- 🔗 A reader link is a `#docs=<section id>` fragment. The markdown link hardening blocks a relative address, and it keeps a fragment.
- 🔗 A link to a sub-heading opens the section that holds it. The reader does not scroll to the sub-heading.
- ↩️ **Contents** goes back to the list with the section marked. The list keeps the pages the player opened and closed.
- 🧭 Dev route: `#dev?modal=formaquestion&tab=search|guide`, `subtab=<section id>`, `mode=wide|narrow`.

**Design System.** One section, "Pattern: Formaquestion Window", and one showcase reference. It covers patterns 1, 2, 7, 8 and 10. Patterns 3, 4, 5, 6 and 9 are listed there as approved and not built; tickets 17, 20 and 24 add them with their components.

**Guards bite.** Each mutation ran against the suite and was restored.

| Mutation | Tests that failed |
|---|---|
| Wrapper press guard off | Playwright 2 |
| Wrapper close-focus guard off | Playwright 1 |
| `focusin` not stopped | Playwright 4 |
| `wheel` not stopped | Playwright 1 |
| No `aria-live` on the host | Playwright 6 |
| `focusout` into the layer not stopped | Playwright 4 |
| Layer z-index under dialogs | Playwright 5 |
| No `transition-none` on the window | Playwright 1 |
| Escape clears the search field | Playwright 1, Vitest 1 |
| A tab move toggles the window | Playwright 1 |
| No reduced-motion class | Playwright 1 |
| 32 unit and component mutations (F1 while hidden, focus return, timer and listener cleanup, clamp, stored box, links, excerpt, corner turn and more) | Vitest, each at least 1 |

One mutation found a gap: an image whose address names a docs page became a reader link with no test red. A test covers it now.

**Review fold-in.** The two reviewers found five defects, each fixed test-first:

| Defect | Fix |
|---|---|
| A press on a result row, a contents row or a link removed the focused control, so focus fell out of the window and F1 needed two presses | Focus goes to the window frame on the next frame |
| The contents list forgot its open pages when a section opened | The open pages are part of the window's view state |
| A held F1 toggled the window on each key repeat | A repeat is ignored |
| A trip to a mobile width and back clamped the window to that width | No clamp under the mobile breakpoint |
| The window took focus when it showed again after it was hidden | Focus moves in only when the window opens |

Also from the review: the link grammar moved out of the coverage checks into `docsLinks.ts`; the excerpt uses `Hint`; the docs page says mobile, not phone; the search field's placeholder matches its name. New Playwright checks cover the motion values (200ms, 150ms, 75%, the kept last frame), the welcome animation, a tutorial note, the mobile round trip and the page names in the contents list. 14 more mutations ran against these; each one failed a test.

Left as they are: the tab and the window each have their own pointer-drag code (a press with a threshold, and a plain drag); `Formaquestion.tsx` owns the whole life of the one window; result rows keep the prototype's accent hover.

**Coverage.** 96% of statements on the new modules. The tab's pointer drag runs in Playwright only.

**Not covered.**

| Item | State |
|---|---|
| A real screen reader | UNVERIFIED. The accessibility tree only |
| Keyboard move and resize of the window | Not built. The pointer only |
| Nested dialogs, a drawer, touch scroll | Proven on the prototype (ticket 14). Not repeated here |
| A late docs load after unmount | Guarded by the mount flag. No test counts the write |

**Evidence.** Frames in `.scratch/formaquestion-16/frames/` (1600×900, dark and light): the tab on the Main Menu, on the game view and on each edge, search, results, no match, reader, contents, wide layout, above Settings, the Design System reference.
