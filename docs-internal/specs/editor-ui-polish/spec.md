# World Editor UI Polish: Square Add Buttons, Mobile View Toggle, Canvas Context Menu

Status: ready-for-agent

## Problem Statement

Three rough edges in the World Editor:

1. Add buttons are inconsistent — the main editor add button is a square icon button, but the panel-level add buttons (connections, placeholders, stat messages, stat descriptors) are labeled text buttons of varying widths, so the editor's add affordance doesn't look like one thing.
2. The List/Canvas view toggle shows text labels on mobile, where horizontal space in the add/search bar is scarce.
3. Right-clicking the location canvas opens a context menu that is clipped by the panel's overflow-hidden ancestors, often making it unreadable or unusable near panel edges.

## Solution

1. Convert the four labeled add buttons in World Editor panels to square icon-only Plus buttons (rounded corners kept), with the former label preserved as tooltip and accessible name.
2. On mobile only, render the List/Canvas toggle as icon-only (List and Map icons); desktop keeps today's text labels.
3. Rebuild the canvas context menu on the Radix ContextMenu primitive so it portals above all panels, collision-flips at viewport edges, and gains keyboard navigation and touch long-press for free.

## User Stories

1. As a world author, I want every add button in the editor to be a square + button, so that the add affordance is visually consistent across panels.
2. As a world author, I want the square add buttons to keep rounded corners, so that they match the app's existing button styling.
3. As a world author hovering an icon-only add button, I want a tooltip with its old label, so that I still know what it adds.
4. As a screen-reader user, I want icon-only add buttons to keep an accessible name, so that the conversion loses no accessibility.
5. As a mobile world author, I want the List/Canvas toggle to be icon-only, so that the add/search bar fits on a narrow screen.
6. As a desktop world author, I want the List/Canvas toggle unchanged, so that the labels I know stay put.
7. As a mobile user, I want the icon toggle items to carry accessible names, so that the icons are not label-less controls.
8. As a world author, I want the canvas right-click menu to render above the panel, so that it is never clipped by the panel edges.
9. As a world author right-clicking near a viewport edge, I want the menu to flip/shift into view, so that every menu item stays reachable.
10. As a world author, I want the menu's existing sections and items (pane, node, selection variants; checkbox and radio behaviors) to work exactly as before, so that the rewrite changes presentation only.
11. As a world author, I want right-drag panning to still not open the menu, so that navigating the canvas stays smooth.
12. As a keyboard user, I want arrow-key navigation and Escape-to-close in the canvas menu, so that it behaves like every other menu in the app.
13. As a mobile world author, I want long-press on the canvas to open the context menu, so that canvas actions are reachable on touch.
14. As a world author, I want clicking elsewhere to dismiss the menu, so that it never lingers.

## Implementation Decisions

- Scope is the World Editor only; add buttons elsewhere in the app are untouched. The main editor add button is already a square icon button and is not modified.
- The four converted buttons are the panel adds for location connections, placeholders, stat update messages, and stat descriptors. Each becomes an icon-size Button with a Plus icon; the former label moves to `aria-label` and `title`.
- Mobile detection for the toggle uses the existing `useIsMobile` hook (the World Editor already branches its layout on it), not CSS breakpoints. Icons are lucide `List` and `Map`, rendered only in the mobile branch; item labels become `aria-label`s there.
- The canvas context menu is rebuilt on the Radix ContextMenu primitive: new dependency `@radix-ui/react-context-menu` plus a shadcn-style wrapper component in the ui component library, following the repo's existing popover/select wrapper conventions.
- The canvas frame becomes the ContextMenu trigger. ReactFlow's pane/node/selection context-menu callbacks set which target the menu describes before Radix opens it; the existing stationary-click guard continues to suppress the menu after a right-drag pan.
- The pure section model (`canvasMenu` builder: sections, exclusive/radio vs checkbox items) is unchanged; the renderer maps it onto Radix Item / CheckboxItem / RadioItem primitives instead of raw buttons.
- Manual coordinate math (frame-relative left/top) is deleted; positioning, portaling, collision handling, dismissal, and focus management come from Radix.

## Testing Decisions

- Good tests here assert external behavior, not markup details. The only logic seam is the pure `canvasMenu` section builder, which is already covered by its existing test file; that seam and its tests are unchanged and remain the single tested seam.
- No new unit tests: items 1–2 are pure presentation, and the menu rewrite is rendering-only. Radix portals in jsdom are known-flaky in this repo, so no jsdom render test for the menu.
- All three changes are verified in the live preview via the dev-router at realistic viewport sizes (desktop and mobile presets), both themes for the restyled buttons, with static-frame/DOM evidence per the UI quality bar — including a right-click near each panel edge to prove the clipping fix.

## Out of Scope

- Add buttons outside the World Editor (gameplay panels, modals, main menu).
- Sharp-cornered ("literally square") styling — rounded corners stay.
- Desktop changes to the List/Canvas toggle.
- Any change to canvas menu contents, ordering, or behavior semantics.
- A generalized dropdown-menu component or migration of other custom menus.

## Further Notes

- Adds one new runtime dependency (`@radix-ui/react-context-menu`) and one new ui wrapper component.
- Radix gives touch long-press to open the menu on mobile as a side benefit; it is accepted, not separately built.
- No world/save export shape is touched.
