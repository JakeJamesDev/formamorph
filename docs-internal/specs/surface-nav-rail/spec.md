# Surface Nav Rail

Status: ready-for-agent
Spec session: surface-nav-rail — spec

Supersedes the desktop and help rulings of `world-editor-edge-rail` (its Q1, Q3, Q7, Q11, Q15, Q16). That effort's Q5, Q8, Q12 and Q13 still hold where this spec does not replace them.

## Problem Statement

The World Editor and Community Creations navigate their sections in two different ways, and neither fits the screen well.

- The World Editor's tabs run in a horizontal strip inside the list card. At half-pane widths the labels run tight, and new tabs have no room. The first edge rail moved them outside every card, where it read as a separate widget beside the panel. It was rolled back.
- Community Creations uses a labeled column that starts below a full-width header. It reads as half a ribbon, and its active style differs from the editor's.
- The editor's header row is crowded and unordered: Find, the `?` help, the Test Bench and a wide Simple/Advanced segmented control, all at the same weight, in a row that spans only the list card.
- The `?` help topics are a second store of help text. They drift from the docs, and Morphie now answers the same questions better.
- Save and Export World sit in the list card's footer, although they act on the whole world.
- The back arrow sits at a different spot, and at a different size, on each screen.

## Solution

One **Nav Rail** pattern serves both surfaces on desktop. It sits inside the surface it drives, below a full-width header. Its groups are split by plain lines, it collapses from icons with labels to icons alone, and it is a real tab list.

The World Editor gets an editor-wide **app bar** above both panes:
- Left: back and the title, with the save state.
- Center: Find and the Test Bench.
- Right: the mode, then the world actions and Save.

The `?` help is gone everywhere. The mode becomes a **Mode Select**, a fixed-width picker that says what each mode does. Settings uses the same control.

On mobile, both surfaces navigate with the **Sections bar**, grouped exactly like the rail. Community's mobile header puts Filters, as an icon with its chevron, where refresh was; refresh moves into the Filters panel.

Every surface header shares one geometry, so the back arrow lands on the same point everywhere.

## Rulings

Q1–Q17 come from the grilling; Q18–Q32 from the prototype rounds (`prototype/world-editor-tabs`).

| # | Ruling |
|---|---|
| Q1 | One spec covers the rail pattern, the World Editor app bar and Community Creations, with tickets per surface |
| Q2 | Ships in the next release |
| Q3 | Both rails start expanded |
| Q4 | The expanded or collapsed state is remembered per surface, on this device. It is a per-viewer convenience, so losing it is harmless |
| Q5 | The World Editor's `?` help button is dropped |
| Q6 | The Mode Select replaces the Simple/Advanced segmented control in the World Editor and in Settings |
| Q7 | Optimize Images stays in the Advanced world-actions menu, beside Export World. A Test Bench finding for it is a separate idea |
| Q8 | The rail is a real vertical tab list: arrow keys move along it, each icon is a tab, the panels stay in their card. Editor tests that find tabs by role keep working |
| Q9 | No `?` on desktop or mobile. The World Editor's help topics are deleted, and docs that point at the `?` are updated |
| Q10 | Scripts and Tools do not ship. The Logic group stays in the registry and draws nothing until it holds a tab |
| Q11 | Mobile is redesigned in this spec |
| Q12 | On Community Creations the whole header (title row, filter bar, contest banner) spans the window, and the rail starts below it |
| Q13 | Mobile navigates with the Sections bar on both surfaces. The rail-in-a-drawer variant was rejected |
| Q14 | Mobile was prototyped before its details were ruled (Q27–Q29) |
| Q15 | Desktop and mobile ship together |
| Q16 | While the Test Bench is embedded in the list card, the rail stays drawn and disabled |
| Q17 | Below a width threshold the rail draws collapsed without changing the stored choice, and expands again when the window widens |
| Q18 | Placement. World Editor: the app bar spans both panes, and the rail is the list card's first column, full card height. Community: the rail is the first column below the header, beside the results |
| Q19 | Grouping. World Editor: Overview alone, then Stats, Entities, Locations, Traits, then Dictionary, Placeholders. Community: Worlds, Entities, Dictionaries, Avatars, then Prompts, then Contest. Groups are split by a plain line, with no captions, on the rail and on the Sections bar alike |
| Q20 | The collapse toggle sits at the rail's foot. Collapsing and expanding animate the width in 200 ms; labels stay mounted, clip against the moving edge and crossfade on the same curve. No row changes layout between states |
| Q21 | A collapsed rail shows the tab's name in a flyout on hover or keyboard focus. The active tab carries a primary accent bar on the rail's edge |
| Q22 | The World Editor app bar reads, left to right: back, **World Editor**, the save state; Find and the Test Bench centered on the window; the Mode Select; Export World as an icon in Simple, or a world-actions menu holding Export World and Optimize Images in Advanced; Save. The world's name is not shown |
| Q23 | The save state reads "Saved" or "Unsaved changes". A world that has never been stored shows none |
| Q24 | The Mode Select is 7.5rem wide whatever its value. Its list describes each mode: "Just the essentials" and "Every tool and field" in the editor, "Every setting" in Settings. The advanced-features dot rides its trigger |
| Q25 | On desktop the list card's footer holds only the tab's own actions (Entities and Dictionary), and draws nothing on other tabs. Mobile keeps its footer with Export World, Optimize Images (Advanced) and Save |
| Q26 | One back button for every surface header: a borderless ghost icon button with a 16px arrow, named Back. Every surface header has 12px sides with its first row centered in 56px, and the same back-to-title spacing |
| Q27 | The World Editor's mobile header reads: back, Find, the Test Bench, the Mode Select |
| Q28 | Community's mobile header reads: back, search, Filters. Filters is an icon button with its turning chevron and a count badge when filters are on. Refresh moves into the Filters panel: the sort select fills that row, with the order toggle and refresh at its right edge |
| Q29 | On mobile, Community's section dropdown is replaced by the Sections bar under the header |
| Q30 | Find stays a button that opens the Find bar. Embedding the Find widget in the app bar was tried and rejected: the widget is too complex for the bar |
| Q31 | Rejected on the way: the rail outside every card, back or a title in the rail's top slot, an expand toggle in the top slot, group captions, identity tiles on the title, the world's name in the bar, a labeled switch, word or icon toggles, icon segments for the mode, and a rail drawer on mobile |
| Q32 | On desktop, Community's header row ends with the sort select, the order toggle and refresh, refresh furthest right: the same order as mobile's Filters panel (Q28). The search box fills the space between the title and that group |
| Q33 | Ticket 02 lifts the World Editor's desktop header and tour bar out of the card into a full-width row above the panel group, so the back button meets the shared offset. Ticket 05 turns that row into the app bar. Mobile keeps its card header |
| Q34 | While the rail is auto-collapsed (Q17), the foot toggle stays drawn and disabled, with an "Expand" flyout. It never writes the stored choice in that state |
| Q35 | The rail has no change handler. It takes the active value only for the accent bar; the host's vertical tab root owns the change (Q8) |
| Q36 | The collapsed rail's flyouts use the shared tooltip, with its timing, so no host card can clip them |
| Q37 | Every ticket's changelog fragment carries its own lead. Prepare refuses a repeated lead, so the shared-lead plan was dropped after ticket 02 |
| Q38 | Community's desktop title has no Globe icon, so both surfaces' titles start at the same x beside the back button |

## User Stories

1. As a world author, I want the editor's tabs on a rail inside the list card, so that navigation reads as part of the panel and not as a widget beside it.
2. As a world author, I want the rail expanded with labels at first, so that I learn what each icon means.
3. As a world author, I want to collapse the rail to icons, so that the list gets more width once I know the icons.
4. As a world author, I want the rail to remember my choice on this device, so that I set it once.
5. As a world author, I want collapsing to settle smoothly, so that the panel doesn't snap or jump.
6. As a world author, I want the rail to collapse on its own in a narrow window, so that the list never gets squeezed, without losing my stored choice.
7. As a world author, I want a tab's name to fly out when I hover a collapsed icon, so that I never guess.
8. As a world author, I want the active tab marked with an accent bar, so that I see where I am at a glance.
9. As a world author, I want Overview alone at the top and the other tabs split by lines, so that the rail reads in groups without captions.
10. As a keyboard author, I want arrow keys to move along the rail, so that it works like a tab list.
11. As a screen-reader author, I want each rail item named by its tab, so that the rail reads as the strip did.
12. As a world author in Simple mode, I want Placeholders hidden as before, so that the mode still hides what it hid.
13. As a world author, I want an empty group to draw nothing, so that no line stands with nothing under it.
14. As a world author, I want an app bar that spans both panes, so that editor-wide controls sit above everything they act on.
15. As a world author, I want to see whether my world has unsaved changes, so that I know when to save.
16. As a world author with a brand-new world, I want no "Saved" label before I have saved, so that the bar never claims something false.
17. As a world author, I want Find and the Test Bench centered, so that the tools I use most sit in the middle of the bar.
18. As a world author, I want Save in the bar, so that I can save from any tab.
19. As a world author in Simple mode, I want Export World as one icon beside Save, so that exporting takes one click.
20. As a world author in Advanced mode, I want Export World and Optimize Images in one menu, so that the bar stays quiet.
21. As a world author, I want the list card's footer to hold only the tab's own actions, so that world actions and item actions don't mix.
22. As a world author, I want the mode as a select that says what each mode does, so that I understand the choice before I make it.
23. As a world author, I want the mode select to keep its width, so that the controls beside it don't shift when I switch.
24. As a world author, I want the advanced-features dot on the mode select, so that I know when Simple hides something this world uses.
25. As a player, I want the Settings window to use the same mode select, so that both screens work the same way.
26. As a world author, I want no `?` button, so that help comes from Morphie and the docs, with one source of truth.
27. As an author using the Authoring Tour, I want each step to still find its control, so that the tour works on the new bar and rail.
28. As an author using the Test Bench embedded, I want the rail to stay in place but disabled, so that the layout doesn't jump and the editor's tab state is kept.
29. As an author using Find, I want a match to still open its tab, so that search navigation works with the rail.
30. As an author using Take Me There, I want routes to Find and to the mode control to still land, so that help routes keep working.
31. As a browser of Community Creations, I want the same rail beside the results, so that both screens navigate the same way.
32. As a browser of Community Creations, I want the header to span the window above the rail, so that search and filters keep their full width.
33. As a browser of Community Creations, I want the rail to start expanded, so that I can read every section name.
34. As a browser of Community Creations, I want the section tutorial to point at the rail, so that the explanation still lands on the control.
35. As a mobile author, I want the Sections bar grouped exactly like the rail, so that the order and splits are the same on every screen.
36. As a mobile author, I want the header to hold back, Find, the Test Bench and the mode select, so that the row fits a phone.
37. As a mobile author, I want Export World and Save in the footer, so that they stay within thumb reach.
38. As a mobile browser of Community Creations, I want the Sections bar instead of a dropdown, so that the sections work as they do in the editor.
39. As a mobile browser of Community Creations, I want Filters as an icon with a chevron where refresh was, so that the header fits one row and shows the panel's state.
40. As a mobile browser of Community Creations, I want refresh inside the Filters panel, next to sort, so that the controls for what I see live together.
41. As a mobile browser of Community Creations, I want the sort select to fill its row, so that the order toggle and refresh line up at the right.
42. As any author or player, I want the back arrow at the same spot and size on every screen, so that leaving a screen is muscle memory.
43. As a developer, I want the rail as one component with its own tests, so that a third surface can adopt it.
44. As a developer, I want the mode select as one component used by both screens, so that the two can't drift.
45. As a Design System reader, I want the Nav Rail, the app bar and the Mode Select documented with showcase entries, so that the next surface builds them the same way.

## Implementation Decisions

### Nav Rail (new shared component)

- Takes the groups in order, the active value, a label, a disabled flag, a storage key and a default state (Q3, Q4, Q16, Q35).
- Renders a vertical tab list (Q8). It must sit inside its host's tab root, which wraps the rail and the panels, as the edge-rail effort's Q5 required. Arrow keys move along it.
- Draws a plain line between drawn groups and nothing for an empty group (Q10, Q19).
- Collapse toggle at the foot. The expanded state persists per storage key in browser storage and survives a failed read or write (Q4, Q20).
- Auto-collapse: the host passes whether there is room. When there isn't, the rail draws collapsed without writing the stored state (Q17). The threshold is tuned during the build against the list panel's minimum width, and recorded in the spec.
- Motion, from the prototype: one row layout in both states (icon 11px in, which centers it in the 52px collapsed rail). Width animates 52px ↔ 192px over 200 ms on `cubic-bezier(0.2, 0, 0, 1)`. Labels stay mounted, clip in their own box, and fade on the same duration and curve. Reduced motion skips the animation (Q20).
- Collapsed rows show the tab name in a flyout on hover or focus-visible, never on a pointer focus (Q21). The active row carries the accent bar on the rail's edge.
- The disabled flag disables the tabs only, and disabled tabs show no flyout. The collapse toggle stays usable.
- The shared tooltip has a `disabled` prop, so a tip can turn off without remounting its control and dropping focus.

### Mode Select (new shared component)

- One select used by the World Editor (desktop and mobile) and by Settings (Q6). Fixed 7.5rem trigger showing the current mode. Its list items carry the one-line description (Q24).
- Carries the advanced-features dot and its tooltip. Forwards its ref and attributes to the trigger, so tutorials, tour anchors and Take Me There targets keep landing on it.
- Its tooltip sits on a wrapping element, not on the trigger, so the trigger keeps the ref (the composed-forwardref lint rule).

### World Editor

- Desktop: the app bar is a sibling above the panel group, and the tour bar sits under it (Q18, Q22). The list card's first column is the Nav Rail inside the tab root. The card's former header row is gone on desktop.
- The app bar's side columns share the leftover width equally, so the center group sits on the window's center line.
- Save state: shown only once the world is stored. The saved baseline alone is not the signal, because a new world gets a baseline before its first save. The store exposes a "stored" fact the bar reads (Q23).
- World actions: Simple shows the Export icon; Advanced shows a menu with Export World and Optimize Images, including its progress label (Q7, Q22).
- Footer: on desktop only the selected-content actions and the add split button, on Entities and Dictionary. Mobile keeps the full footer (Q25).
- The `?` and its help-topic lookup leave both layouts. The World Editor topics are deleted from the help-topic store (Q5, Q9).
- Mobile: the header row reads back, Find, Test Bench, Mode Select (Q27). The Sections bar keeps its place under the header (Q13).
- The tab registry keeps each tab's group and icon. Group captions are no longer drawn anywhere, so the group's label is only needed if another consumer wants it.

### Community Creations

- Desktop: the whole header spans the window as one block with one bottom border: the title row, the filter bar and the contest banner, all on the header's 12px sides. Below it, the rail is the first column beside the results and the pager (Q12, Q18). The rail replaces the labeled landscape column, with the rail's active style.
- Desktop title row: back and title, the search box filling the free space, the quarantine control, then sort select, order toggle and refresh, refresh last (Q32).
- The section tutorial anchors on the rail.
- Mobile: the header's first row reads back, search, Filters. Filters is an icon button with the chevron and the count badge (Q28). The Filters panel's first row holds the sort select (filling), the order toggle and refresh. The Sections bar under the header replaces the section dropdown (Q29).

### Sections bar

- Draws the same grouping as the rail: a plain line between groups, no captions (Q19). Both hosts feed it the same groups they feed their rail.

### Shared back button and header geometry

- One back button component on all four headers (Q26). Every surface header uses 12px sides with its first row centered in 56px. On mobile the editor card draws no top border of its own under the window's.

### Docs and Design System

- The Design System guide gains Nav Rail, the surface app bar and Mode Select, each with a showcase entry, documented before adoption. Sections Bar is updated to draw lines without captions.
- The World Editor guide drops the strip, the `?` and the footer Save/Export, and names the rail and the app bar. The Settings guide names the select.
- Changelog: each ticket's fragment is its own Major Added 👤 entry, with a lead that names what that ticket adds. Prepare refuses a lead already under 🚧 In Progress, so tickets never share one (Q37).

## Testing Decisions

A good test calls the public seam with real inputs and asserts what an author would see or do. It never reads internal state or mirrors class lists.

- **Nav Rail (new seam).** Renders one tab per item, named by its label. Draws a line between groups and none for an empty group. The active tab is selected and carries the accent marker. Arrow keys move between tabs. Disabled renders every tab disabled. The toggle collapses and expands and the choice survives a remount for the same storage key, but not across keys. Auto-collapse draws collapsed without changing the stored choice. Prior art: the edge rail's tests (history, `1bd374f8`) and the panel tab strip tests.
- **Mode Select (new seam).** Shows the current mode. Picking the other mode calls the change handler. The dot and its accessible name show only when the caller says something is hidden. Settings' existing mode tests move onto it through the Settings harness. Prior art: `SettingsModal.mode` tests.
- **World Editor (existing harness).** On desktop the app bar holds back, title, Find, Test Bench, Mode Select, Export or the menu, and Save, in that order, with no `?`. A top-level tab is found by role in the rail. The footer is absent on Overview. The embedded Bench disables the rail. A new world shows no save state until stored, then "Saved", then "Unsaved changes" after an edit. On mobile the header holds back, Find, Test Bench and Mode Select, and the Sections bar's order and splits match the rail's. Existing tests that pick a tab by role keep passing. Prior art: the tab navigation, header row, list toolbar and bench tests.
- **Community Creations (existing harness).** On desktop, picking a rail tab switches the section, and Contest joins the rail while a contest exists. On mobile, the Filters button shows the chevron and the count, opening it reveals refresh beside sort, and the Sections bar replaces the dropdown. The section tutorial still anchors. Prior art: the switcher and tutorial tests.
- **Guards bite.** Reinstate once: draw a caption in the Sections bar and the grouping test must go red; let auto-collapse write the stored state and the persistence test must go red; show "Saved" on an unstored world and the save-state test must go red.

## Out of Scope

- A Test Bench finding for oversized images (Q7).
- Scripts and Tools themselves (Q10).
- Morphie changes: a "help for this tab" entry is not part of this spec (Q5).
- The detail pane's own tab strips (entity, location, stat, trait).
- Other surfaces adopting the rail or the back button beyond the World Editor, Community Creations and Settings' mode control.

## Further Notes

- **Prototype.** Branch `prototype/world-editor-tabs`, final commit `dbe3c035`, worktree `.claude/worktrees/prototype-world-editor-tabs`, launch entry `proto-world-editor-tabs` on port 5245. Open `/#dev?modal=worldEditor` or `/#dev?modal=community`. The branch has main merged in (`3532597d`). Its rail uses plain buttons; the build makes it a tab list (Q8).
- **Mobile Save and Export.** Q25 carries main's mobile footer forward unchanged. It was not separately ruled in the grilling.
- **Tests to retarget.** Settings and Design System showcase tests that click the Simple/Advanced radios move to the select. EditorSectionsBar's caption expectations change to lines.
- **Release risk.** The first rail was rolled back as too large for a release, and this spec is larger (mobile, Settings). Q2 still says next release.
