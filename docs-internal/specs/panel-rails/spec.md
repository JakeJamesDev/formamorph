# Panel Rails

Status: ready-for-agent
Spec session: panel-rails — spec

## Problem Statement

In game on desktop, the left and right panels each take a quarter of the window. The player can't put either one away. The narration stays squeezed between them even when the player only wants to read and type. The only way to clear the screen is Hide UI, which removes everything, including the narration.

## Solution

Each side panel collapses on its own to a thin rail of labeled tab icons. A thin toggle strip on the panel's inner edge collapses it, and the same strip on the rail docks it again. Clicking a rail icon opens that tab in a drawer over the narration, pulled out of the rail. A dot on the Stats, Traits and Inventory icons tells the player something changed while the panel was collapsed. The narration keeps a reading width and stays centered as the space around it grows. Each device remembers which sides are collapsed.

## User Stories

1. As a desktop player, I want to collapse the left panel, so that the narration gets more room.
2. As a desktop player, I want to collapse the right panel, so that the narration gets more room.
3. As a desktop player, I want to collapse each side on its own, so that I keep the panel I use and put away the other.
4. As a desktop player, I want to collapse both sides at once, so that I can read with almost nothing around the story.
5. As a desktop player, I want a thin toggle strip on each panel's inner edge, so that the control doesn't crowd the panel's top row.
6. As a desktop player, I want the strip to show a chevron when I point at it, so that I can tell what it does.
7. As a desktop player, I want the strip to name its action in a tooltip, so that I know whether it collapses or docks.
8. As a desktop player, I want the same strip on a collapsed rail's inner edge, so that I dock the panel from where I collapsed it.
9. As a keyboard player, I want to reach the strip with Tab and use it with Enter or Space, so that collapsing works without a mouse.
10. As a desktop player, I want a collapsed side to leave a rail of its tab icons, so that every tab stays one click away.
11. As a desktop player, I want each rail icon labeled under the icon, so that I don't have to learn the icons.
12. As a desktop player, I want the left rail to show Entities, Notes, Memory and Logs, so that it matches the docked left panel.
13. As a desktop player, I want the right rail to show Stats, Traits, Inventory and Location, so that it matches the docked right panel.
14. As a desktop player, I want Back and Music at the top of the left rail, so that I can still leave the game and mute music with the panel collapsed.
15. As a desktop player, I want the right rail to show icons only, with no clock or persona row, so that the rail stays thin.
16. As a desktop player, I want a rail icon to open its tab in a drawer over the narration, so that I can check it without docking the panel.
17. As a desktop player, I want the drawer as wide as the docked panel, so that the tab looks the same in both places.
18. As a desktop player, I want the drawer attached to the rail it came from, so that I can see where it belongs.
19. As a desktop player, I want the open drawer's rail icon highlighted, so that I know which tab is showing.
20. As a desktop player, I want a click outside the drawer to close it, so that I return to the story with one click.
21. As a desktop player, I want Escape to close the drawer, so that I can close it from the keyboard.
22. As a desktop player, I want a second click on the open icon to close the drawer, so that the icon works as a toggle.
23. As a desktop player, I want a click on another icon of the same rail to switch the drawer to that tab, so that I can move between tabs fast.
24. As a desktop player, I want a dialog opened from the drawer to leave the drawer open under it, so that I come back to the same tab.
25. As a desktop player, I want Escape in that dialog to close only the dialog, so that I don't lose the drawer too.
26. As a desktop player, I want a dot on the Stats icon when a stat changes while the right panel is collapsed, so that I know to look.
27. As a desktop player, I want a dot on the Traits icon when my traits change while the right panel is collapsed, so that I notice a new or lost trait.
28. As a desktop player, I want a dot on the Inventory icon when my inventory changes while the right panel is collapsed, so that I notice gained or lost items.
29. As a desktop player, I want a dot to stay until I open that tab, so that I can't miss a change by looking away.
30. As a desktop player, I want opening a tab to clear only its own dot, so that the other dots still tell me what changed.
31. As a desktop player, I want no dots on the left rail, so that the rail doesn't nag me about every turn.
32. As a desktop player, I want the narration to keep a comfortable reading width, so that lines don't stretch across a wide window.
33. As a desktop player, I want the narration centered in the space between the panels or rails, so that the page looks balanced.
34. As a desktop player, I want the device to remember which sides I collapsed, so that the game opens the way I left it.
35. As a desktop player on a second device, I want that device to keep its own choice, so that a small laptop and a wide monitor can differ.
36. As a desktop player, I want Take Me There into a collapsed side to open that tab's drawer, so that the help window still takes me to the right place.
37. As a desktop player, I want a tutorial step into a collapsed side to open that tab's drawer, so that the step can point at its target.
38. As a desktop player, I want Hide UI to hide the rails and strips too, so that the art shows with nothing over it.
39. As a desktop player, I want Show UI to bring back the rails as I left them, so that hiding the UI doesn't dock my panels.
40. As a desktop app player, I want the right strip to start below the header line, so that it never covers the window buttons or the header's buttons.
41. As a mobile player, I want the Story, Game and Status tabs unchanged, so that nothing moves on my phone layout.
42. As a player, I want no keyboard shortcut to collapse a panel, so that no key I press while typing hides a panel by accident.
43. As a returning player, I want both panels docked until I collapse one, so that the game looks the way I know it.

## Implementation Decisions

**Rulings (grill, 2026-11-06):**

- Q1: a collapsed side becomes a thin icon rail, not a full hide.
- Q2: the left and right panels collapse independently.
- Q3: the collapsed state persists per device.
- Q4: the narration is capped at a reading width and centered.
- Q5: a rail icon opens its tab as an overlay drawer over the narration.
- Q6: Back and Music stay at the top of the left rail.
- Q7: the right rail shows tab icons only, with no clock or persona row.
- Q8: Stats, Traits and Inventory get a dot after a change, until that tab is opened.
- Q9: a toggle on each side docks and collapses it.
- Q10: the drawer closes on an outside click, Escape, or a second click on its icon.
- Q11: Take Me There, a tutorial step or a dev-route into a collapsed side opens the drawer on that tab.
- Q12: Hide UI hides the rails.
- Q13: the left rail gets no dots.
- Q14: no keyboard shortcuts.
- Q15: prototype first.

**Prototype verdict (2026-11-06):** variant B. The rail is labeled, with the label under each icon, and the drawer sits flush against the rail. The user moved the toggle from a header chevron to a thin strip on each panel's inner edge. The strip shows a grip line at rest and a chevron on hover and focus. The prototype's rail is 4.5rem wide and its strip is 0.75rem wide. These are starting values, not rulings.

**Calls made while prototyping (open to the user):**

- The drawer is as wide as the docked panel: a quarter of the window, with the panel's own minimum width.
- A dialog opened from the drawer leaves the drawer open. Escape closes the dialog first.
- A dot appears only for a change made while that side is collapsed. A change while the panel is docked shows in the panel itself.
- Dots live in memory for the game session. They aren't saved and don't persist.

**Modules:**

- **Panel rail.** It renders a side's tab icons with labels, the open-tab highlight and the dots. The left rail also takes the Back and Music controls at its top. It is new, desktop only, and replaces the docked panel in the GameViewer row when that side is collapsed.
- **Edge toggle.** It is the thin strip between a side (panel or rail) and the narration. It toggles that side and carries the "Collapse Panel" or "Dock Panel" label. It replaces any chevron in the panel's top row or the header.
- **Panel drawer.** It holds the existing left or right panel content for one tab, attached to its rail. It owns the close rules: outside click inside the game view, Escape when no dialog is open, and a second click on the open icon. A click inside portaled content (a dialog or popover opened from the drawer) doesn't close it.
- **Panel layout prefs.** It is a per-device preference module beside the existing ones (the Locations Canvas prefs are the pattern), built on the persistent-state hook. It holds two booleans: left collapsed and right collapsed. Both default to docked.
- **GameViewer.** It owns the collapsed state, the open drawer (side, tab), and the dot set. It selects the right panel's tab through the existing Gameplay active-tab state when a right drawer opens. It uses the left panel's existing requested-tab input for a left drawer. Back and Music move into shared elements so the left panel row and the left rail render the same controls.
- **Surface requests.** The Surface landing in GameViewer opens the drawer when its target tab sits on a collapsed side. The help window and tutorial routes need no change.
- **Dot detection.** It compares the player's stats, traits and inventory after each settled turn and after a script or panel write. Any change on a collapsed right side adds the matching dot. It reads runtime state only and never writes GameDataContext.
- **Narration column.** The middle column centers its child and caps it at a reading width in every layout, docked or collapsed.

**Not changed:**

- Mobile layout and its Story, Game and Status tabs.
- Save and world export shapes. The collapsed state lives in device storage only.
- Hide UI's own button and behavior. It now also hides the rails and strips.

## Testing Decisions

- **One seam: the GameViewer test harness.** Tests render the game view, click the edge toggle and rail icons, and assert what the player sees. They don't reach into the rail or drawer components. Prior art: the GameViewer header-actions and Surface-request tests.
- **A good test** checks only what a player can see or do: roles, names, labels and visible text. It never checks class names, state variables or component structure.
- **Cases to cover:**
  - Collapse and dock each side through its strip, and the strip's label in each state.
  - The rail's tabs on each side, and Back and Music on the left rail.
  - A rail icon opens the drawer on its tab. A second click, Escape and an outside click each close it. A dialog opened from the drawer leaves it open.
  - A dot appears after a turn changes a stat, a trait or the inventory while the right side is collapsed, and clears when that tab opens. No dot appears for a change while docked.
  - The collapsed state survives a remount on the same device and defaults to docked.
  - A Surface request into a collapsed side opens the drawer on that tab.
  - Hide UI hides the rails and strips. Show UI brings them back as they were.
  - The mobile layout shows no rails or strips.
- **Turns** run through the harness's mocked endpoint, the same way the GameViewer pass tests drive stat, trait and inventory changes. A test never sets a dot by hand.
- **Layout and visual checks** (reading width, centering, strip placement below the header line, both themes) use the verify-ui skill on the dev-router, not jsdom.

## Out of Scope

- Mobile changes.
- Keyboard shortcuts (Q14).
- Dots on the left rail (Q13).
- Resizable or draggable panel widths.
- Collapsing the World Editor's or any other Surface's panels.
- Saving the collapsed state in the save file or syncing it across devices.

## Further Notes

- Prototype branch: `prototype/panel-rails` (7d090a2a7, then a8cb9acd0 for the edge toggle). Run it from that worktree with the `proto-panel-rails` launch entry on port 5300, and pick variant B with `variant=B` on the dev route.
- The question the prototype answered: what the collapsed rail, the drawer, the dots and the toggle look like. Variant B with the edge strip won over a slim icon-only rail (A) and a floating edge dock with full-height sheets (C).
- Tooltip and label copy ("Collapse Panel", "Dock Panel", the rail labels) goes through the Writing Guide before it ships.
