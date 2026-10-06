# UI Consistency

Status: needs-triage
Status note: Opened 2026-10-06 from the user's notes. Each item needs a grill before tickets. The user names the canon where it is unclear.

## Problem Statement

The same element looks or acts differently on different surfaces. Some surfaces also show visual glitches on first load.

## Items

| # | Item | Open question for the grill |
| --- | --- | --- |
| 1 | **Element icons match everywhere.** Traits, entities and the other element kinds show one icon on every surface. | Which icon is canon for each element kind? |
| 2 | **Hover and selected states differ.** The side panel layouts use several colors and styles for hover and selected. Hover and selected must not share a color. | What is the canon hover style and the canon selected style? |
| 3 | **Flicker on first load.** A window flickers the first time it loads and an element highlights or a tooltip shows. | Investigate the cause; no canon question. |
| 4 | **Popup close button outline.** The X button on popups has an outer border and focuses that border when the popup opens. Remove the border and the focus on open. | Where does initial focus go instead? |
| 5 | **List item remove button.** List items have an X button. | Should it be an icon button that turns destructive red on hover? |

Items 1 and 2 are audited in [audit.md](audit.md). Item 3 is parked: Playwright frame sampling did not reproduce it.

## Related

- The Mascot overlay list drag fix (d9f715d0) made those lists match the World Editor drag pattern.
