# 05: Insert into the Open Stat's Box

Status: ready-for-agent
Blocked by: 02 — Code Block Toolbar with Copy
Status note: Also blocked by take-me-there-targets tickets 02 (Landing Pulse Pattern) and 07 (Landing in World Editor Panels); start only when both are ready-for-human
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q1, Q2, Q3, Q9, Q10, Q12, Q14, Q17, Q18, Q19.

## What to build

Every code block in an AI answer gains an **Insert** control beside Copy. It opens a menu headed by the open stat's name with two items, **Before the AI** and **After the AI**; the fence's slot tag preselects one. Picking an item writes the block into that box through the stat panel's draft, switches the panel to its Code tab, and lands on the box with the Landing Pulse (scroll, focus, one ring). A box that already has code first raises the stat-code templates' replace confirm, same title and copy. With no stat panel open, Insert is disabled with a tooltip that says to open a stat's Code tab. On the mobile sheet, a successful insert closes the sheet as Take Me There does. A flagged answer's blocks get Insert too. Take Me There keeps landing on the Stats list.

The bridge is a module-level single slot like the docs opener: the stat panel registers its stat name and an insert function while mounted and unregisters on unmount; the help window subscribes so Insert enables and disables as panels come and go. The landing uses the two box targets ticket 07 of the targets effort registers; this ticket does not add registry entries.

Check for a parallel session on targets ticket 07 before editing the stat panel or code box: both tickets touch them, with disjoint edits.

Workload: a cross-window bridge, a menu, a confirm, the draft write path and a landing hook, with tests through the stat panel harness. A top model at high effort.

## Acceptance criteria

- [ ] An answer block shows Insert; the menu header names the open stat; items are the two slot labels as the Code tab writes them
- [ ] A fence tagged `before` or `after` preselects that item; an untagged fence preselects none
- [ ] No stat panel open: Insert is disabled and its tooltip says to open a stat's Code tab; Copy still works
- [ ] Inserting into an empty box writes the draft field at once; the panel switches to its Code tab and the box lands with the pulse
- [ ] Inserting into a box with code raises the replace confirm; confirm writes, cancel leaves the box unchanged
- [ ] The write is a draft edit: Discard reverts it
- [ ] Two blocks in one answer each insert into their own box
- [ ] A flagged answer's block has Insert; Take Me There stays hidden on it
- [ ] On the mobile sheet layout a successful insert closes the sheet
- [ ] Unmounting the stat panel disables Insert
- [ ] Guard bites: drop the unregister on unmount once and the harness test goes red
- [ ] Both themes checked in the help window over the World Editor at a realistic viewport
- [ ] Changelog line under In Progress, Added, 👤
