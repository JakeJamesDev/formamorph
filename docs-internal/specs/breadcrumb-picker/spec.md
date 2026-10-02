# Spec: Breadcrumb Picker for Code Template Slots, and Scrollable Selects

Status: ready-for-agent
Spec session: breadcrumb-picker — spec
Status note: 7 tickets in issues/. 01, 02 and 07 start in parallel. 03 follows 01. 04 and 05 follow 03. 06 follows 01 and 03.

## Problem Statement

An author fills in a Code Template in the **Code Templates** dialog. Its stat, trait, entity and placeholder slots use a plain Select. Each Select shows one flat list of names.

| What the author sees | What goes wrong |
| --- | --- |
| A flat trait list | No groups and no owners. A world with a deep Traits tree becomes one long, unordered-looking column |
| The `trait(persona)` list | Traits from every persona entity merge into one deduped list. The author can't tell which entity holds which trait |
| A long list | Radix hides the scrollbar. Only the chevron buttons at the top and bottom scroll it, so a long list is slow to move through |
| The placeholder list | It offers owned and child placeholder names that `placeholders["X"]` can't reach (Q5) |

The **Add Requirement** picker in a trait's **Requires** field already solves the first two problems. It lists rows in tab order with a right-aligned breadcrumb (`Owner › Group`). That code is inline in one component, and the Design System doesn't describe the pattern.

The breadcrumb has its own flaw. When the path is long, it never shrinks, so it crushes the name: `T… Lineage and Bloodlines › Storm Touched`. Rows become impossible to tell apart.

## Solution

A shared **Breadcrumb Picker**: a searchable single-select popover. Rows come in tab tree order. Each row shows its name and, on the right, where it lives.

- The Code Template slot fields open a Breadcrumb Picker from a trigger that looks like today's Select trigger.
- Each slot lists only names its generated code can reach. Each row's breadcrumb shows its place in the matching editor tab.
- The name always reads. A long breadcrumb collapses its middle segments, and the full path shows in a hover tooltip.
- Add Requirement moves onto the same component, with no change in behavior.
- The Design System gains a **Breadcrumb Picker** pattern and a showcase entry. Lists of world content use it. Short fixed option sets keep Select.
- Every plain Select shows the shared styled scrollbar. Its overlay chevron buttons go away.

## Rulings

Settled in the grilling session on 2026-10-02. A ruling reopens on new evidence, never on a new opinion.

| # | Ruling |
|---|---|
| Q1 | The plain `trait` slot (`traits["X"]`) lists world traits only. Entity-owned traits stay out, because the sandbox `traits` map holds world traits only and the generated code would not resolve. |
| Q2 | The `trait(persona)` slot lists each persona-capable entity's traits. Each row's breadcrumb leads with the entity name, then that entity's own groups. |
| Q3 | A trait name that two persona entities share shows once under each holder. Both rows pick the same value, because `persona.traits` reads by name. |
| Q4 | The entity slot (Entity folders), the placeholder slot (Placeholder folders) and the `trait(entity)` slot (that entity's own trait groups and links) all show their tab position in the breadcrumb. |
| Q5 | The placeholder slot lists only what `placeholders["X"]` reaches. Verified: the map's top-level keys are the world's own rows only. Owned placeholders are reached through their owner, and child placeholders through their parent path. The slot reads those top-level keys, so owned and child names drop out of today's list. |
| Q6 | Nesting shows as tab-order rows with a right-aligned breadcrumb, as Add Requirement does now. No indented group headers. Reconfirmed after a side-by-side mockup. |
| Q7 | Plain Select shows a scrollbar by undoing Radix's scrollbar hiding, so the global native style (which matches ScrollArea) applies. No nested ScrollArea. |
| Q8 | Plain Select drops its overlay chevron scroll buttons. Wheel, drag and keys still scroll. |
| Q9 | A slot opens its picker from a trigger that looks like today's SelectTrigger. It shows the picked value, or the slot's "Pick a …" prompt. |
| Q10 | The pattern is called **Breadcrumb Picker**. Reopened on new evidence: "Searchable Group Picker" already names the Dialog-based Library Group chooser. |
| Q11 | Lists of world content (stats, traits, entities, placeholders) use the Breadcrumb Picker. Short fixed option sets keep Select. |
| Q12 | Add Requirement moves onto the shared Breadcrumb Picker and becomes its reference build. Its second page, where the author picks a bearer, stays its own, built on the shared list. |
| Q13 | The spec audits the other Selects that match the Q11 rule and lists them. Each moves later, in its own ticket, once the user chooses it. |
| Q14 | The search field always shows, whatever the list length. |
| Q15 | When the breadcrumb is long, the name keeps its width up to about 65% of the row. The breadcrumb truncates and collapses its middle segments. A hover tooltip shows the full path. (Option B plus the tooltip, chosen from a mockup of four layouts.) |
| Q16 | Test seams: the Code Templates dialog test, the Requires field test, and one component test for the shared row. A verify-ui frame checks the scrollbar look. |

## User Stories

1. As an author, I want the trait slot to list traits in the order of my Traits tab, so that I find a trait where I expect it.
2. As an author, I want each trait row to show its group path, so that I can tell which part of my tree it comes from.
3. As an author, I want the plain trait slot to offer only world traits, so that the generated code always resolves.
4. As an author, I want the `trait(persona)` slot to show which persona entity holds each trait, so that I pick the trait I mean.
5. As an author, I want a trait that two personas share to show under each of them, so that I find it from either entity.
6. As an author, I want either of those rows to generate the same code, so that my choice of row doesn't matter.
7. As an author, I want the `trait(entity)` slot to show the picked entity's own group path, so that a large entity tree stays readable.
8. As an author, I want the entity slot to show each entity's Entity folder path, so that a big cast reads like my Entities tab.
9. As an author, I want the placeholder slot to show each placeholder's folder path, so that it reads like my Placeholders tab.
10. As an author, I want the placeholder slot to offer only placeholders the generated code can reach, so that a template never inserts a broken name.
11. As an author, I want the stat slot to stay a simple list, so that a world with no stat groups doesn't gain empty breadcrumbs.
12. As an author, I want to type to filter any slot's list, so that I reach a name without scrolling.
13. As an author, I want the search to match a row's breadcrumb as well as its name, so that typing a group or entity name narrows the list to it.
14. As an author, I want group rows to be impossible to pick, so that a slot always holds one real name.
15. As an author, I want the slot trigger to look like the other fields in the form, so that the form stays consistent.
16. As an author, I want the trigger to show my picked name, so that I see the slot's value without opening it.
17. As an author, I want an empty slot to show its "Pick a trait…" style prompt, so that I know what it asks for.
18. As an author, I want the picked row to show a check when I reopen the picker, so that I see the current value in context.
19. As an author, I want a long trait name to stay readable when its path is long, so that I can tell rows apart.
20. As an author, I want a long path to keep its first and last segments, so that the owner and the nearest group still show.
21. As an author, I want to hover a row to see its full path, so that I can read what the collapse hid.
22. As an author, I want a "Nothing to pick" line when a slot has no options, so that an empty list doesn't look broken.
23. As an author, I want a "No matches" line when my search finds nothing, so that I know to change the search.
24. As an author, I want arrow keys and Enter to work in the picker, so that I can fill a template without the mouse.
25. As an author, I want Escape to close the picker without a change, so that I can back out safely.
26. As an author, I want a picked entity to clear the trait slots tied to it, as it does today, so that a stale trait never stays.
27. As an author on mobile, I want the picker to fit the screen and stay usable, so that I can fill templates on a small device.
28. As an author, I want the template editor's Preview tab to use the same pickers, so that I see the exact interface my template will present.
29. As an author, I want Add Requirement to keep working exactly as it does now, so that my trait gates are unaffected.
30. As an author, I want Add Requirement's long paths to collapse the same way, so that its rows are readable too.
31. As a user, I want every dropdown with a long list to show a scrollbar, so that I can drag through it and see where I am.
32. As a user, I want that scrollbar to look like the other scrollbars in the app, so that the interface feels consistent.
33. As a user, I want the dropdown to stop hiding rows under chevron overlays, so that the first and last rows are always visible.
34. As a user, I want the mouse wheel and keyboard to keep scrolling dropdowns, so that nothing I rely on breaks.
35. As a developer, I want one shared Breadcrumb Picker, so that the next world-content list doesn't copy the row and section code again.
36. As a developer, I want the Design System to say when to use a Breadcrumb Picker and when to use a Select, so that new screens pick the right control.
37. As a developer, I want a live showcase entry for the Breadcrumb Picker, so that I can see its states without a world.
38. As a developer, I want a list of the other Selects that should move, so that the follow-up work is visible and can be chosen one at a time.

## Implementation Decisions

**The Breadcrumb Picker component**
- A shared UI component built on the existing Popover and cmdk Command parts. It takes sections (an optional heading and rows). Each row carries a unique key, the value it picks, its name, its breadcrumb segments, and an optional disabled flag.
- It is single-select. Group rows don't exist as rows. A group appears only as a breadcrumb segment.
- Rows are unique by key, not by value. That lets Q3's shared persona trait appear under each holder while both rows pick the same value. Every row whose value equals the current value shows the check.
- Search matches the row's name and its full breadcrumb text, case-insensitive substring, in tab order without sorting. This is the filter Add Requirement uses today.
- Two trigger modes: a Select-style field trigger (Q9) and a caller-supplied trigger, such as Add Requirement's outline button.
- Callers can replace the list page. Add Requirement's bearer page uses this and keeps its own back button and search.
- The list part (search field, sections, rows, "No matches") is shared too. The bearer page renders its own header, then that shared list with one section of bearer rows (Q12, settled for ticket 01).
- A row can carry an optional right-aligned meta hint, separate from its breadcrumb. A hint gets no tooltip and no collapse. The bearer page's "Whoever has the trait" uses it.

**Row layout (Q15)**
- The name comes first and doesn't shrink below its natural width, up to about 65% of the row. Past that it truncates.
- The breadcrumb takes the rest, right-aligned, in meta text, and truncates.
- A breadcrumb of three or more segments renders as `First › … › Last`. The collapse is by segment count, not by measured width, so it is deterministic and testable. A path of one or two segments renders in full.
- The full breadcrumb shows in a hover tooltip on the row, through the shared themed tooltip. A row with no breadcrumb has no tooltip.
- A world row with no group shows `World` in the plain trait slot, as Add Requirement does. Stat rows show no breadcrumb (stats have no groups).

**Slot options in the Code Templates dialog**
- The slot-options builder returns Breadcrumb Picker sections instead of a flat name list. One source per slot type:
  - `stat`: the world's stats minus the stat being edited, no breadcrumb.
  - `trait` (untied): world traits in tree order, breadcrumb from world trait groups (Q1).
  - `trait(persona)`: each persona-capable entity's traits in its own tree order. The breadcrumb leads with the entity's code name (Q2, Q3).
  - `trait(entity)`: the picked entity's traits (owned and linked), breadcrumb from that entity's own groups (Q4).
  - `entity`: keyed entities in Entities-tab order, breadcrumb from Entity folders (Q4).
  - `placeholder`: the placeholder path map's top-level keys only, breadcrumb from Placeholder folders (Q4, Q5).
- Names stay code names, as today: the picked value is what the sandbox keys.
- All four name slots move onto the Breadcrumb Picker together, in ticket 03 (Q11). Slots whose sources land later show their current flat rows until then. Tickets 04 and 05 change row sources only (settled for ticket 03).
- The entity data the dialog receives today carries trait names only. It needs each trait's group path and each entity's folder path. Extend the editor-side entity name builder so the template dialog and the code completions keep reading one source.
- Daypart, choice, number and text slots don't change. Daypart and choice keep the plain Select (Q11: short fixed sets).
- The dialog's mobile template selector keeps the plain Select. Templates are not world content.

**Requirement options**
- The requirement options builder already produces rows in tree order with a `where` path. It returns breadcrumb segments instead of a joined string, so the shared row can collapse them. The `World` and `Persona` labels stay.

**Plain Select (Q7, Q8)**
- The shared Select content stops hiding the native scrollbar and drops its two scroll buttons. The global native scrollbar style already matches ScrollArea's 10px arrowless look.
- Every Select call site gets this, including the month and year picker and the mobile fallback of the segmented option switcher. Call sites that set their own max height keep it.

**Design System**
- Add a **Breadcrumb Picker** pattern section: purpose, composition, the row layout and collapse rule, states (default, picked, disabled, empty, no matches), keyboard behavior, responsive behavior, and production mapping.
- State the Q11 rule. Tell it apart from Searchable Group Picker: that one is a Dialog for an unbounded destination list with create and rename. The Breadcrumb Picker is a popover form control.
- Update the Code Template Selection and Detail pattern so its parameter form names the Breadcrumb Picker.
- Add a showcase entry with a fixture tree that has deep paths, a long name, a shared persona trait, an empty slot and a no-match search. Add its dev-route entry.

**Audit (Q13)**
- List every Select call site that offers world content (stats, traits, entities, placeholders, locations, dictionaries). Put the list in a ticket, one row per call site. Each move to the Breadcrumb Picker is a separate later ticket, chosen by the user.

**No export-shape change.** No world, save or template-pack field changes. Templates keep storing only their code.

## Testing Decisions

- A good test drives the rendered control the way an author does: open the picker, read the rows, type, pick, and check what the form or generated code now holds. It never asserts class names, internal state or the options builder's private shape.
- **Seam 1: the Code Templates dialog test.** It is the existing seam and carries most of the coverage. Use a world fixture with nested trait groups, two persona entities that share a trait name, an entity with its own groups, Entity and Placeholder folders, and an owned trait. Cover:
  - The plain trait slot lists world traits in tree order with breadcrumbs, and it never lists the owned trait (Q1). Prove the guard bites: let owned traits in and watch the test fail.
  - `trait(persona)` lists per-entity rows with the shared name under both entities. Either row generates the same code (Q2, Q3).
  - `trait(entity)`, entity and placeholder slots show their folder breadcrumbs (Q4). The placeholder slot leaves out what code can't reach (Q5).
  - Search by a group name narrows to that group's rows.
  - Picking an entity still clears its tied trait slots.
- **Seam 2: the Requires field test.** It stays green with no change to its assertions after Add Requirement moves (Q12). New assertions cover only the collapse on a deep path.
- **Seam 3: one Breadcrumb Picker component test.** Cover the collapse rule (one, two, and three-plus segments), the full-path tooltip, the check on every row that holds the current value, the empty and no-match lines, and keyboard pick and Escape.
- **Plain Select:** a test confirms the scroll buttons are gone and a long list still scrolls by keyboard. A verify-ui frame in both themes shows the scrollbar on a long Select. jsdom can't render scrollbars, so the frame is the evidence.
- Prior art: the existing Code Templates dialog and Requires field tests, the Radix jsdom notes, and DrillPicker's row and section assertions.

## Out of Scope

- Moving any other Select onto the Breadcrumb Picker. Q13 lists them; each is its own later ticket.
- Indented group headers or collapsible groups (Q6).
- Stat groups. Stats have none, and this spec adds none.
- Changing what the sandbox `traits`, `persona` or `entities` maps expose.
- Multi-select, and picking a group as a value.
- The multi-select component, which already supports groups.
- Measuring width to decide the collapse. The collapse is by segment count.

## Further Notes

- **Q5 source.** The placeholder slot reads the top-level keys of the shared placeholder path map, the same resolver the code completions and the sandbox use. Today it lists every name in the world's placeholder list.
- **Mockups.** The grilling session compared flat breadcrumbs with indented headers, and four ways to lay out a long breadcrumb, as inline mockups. They are not saved in the repo.
- **New visual pattern.** The Breadcrumb Picker already ships in Add Requirement, so the Design System entry documents an approved look. The collapse and tooltip are new and were chosen in this session (Q15).
