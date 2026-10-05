# Stat Code Variable Menu: Drill Down To Every Name

Status: done
Spec session: stat-code-variable-menu — spec
Status note: Closed 2026-10-05. Tickets 01–05 done, last landing 9012da3e, cleanup 077f15c1. Closed without gates; the full suite was green on main after the last landing.

## Problem Statement

The **Variable** menu in a stat code box is one flat list. It began as two rows, another stat's value and this stat's value. Today it holds eleven rows that mix two different choices: which object the code reaches (stats, traits, entities, the persona, dictionaries, the clock) and which lookup on that object. Every row inserts a made-up name in quotes that the author must replace, so the inserted code never runs as inserted. An author who wants an entity's trait reads nine rows to find the one that is close, inserts it, and then types two names over two selections. The menu teaches the sandbox's shape poorly and does not use the names the editor already knows.

## Solution

The **Variable** menu becomes a drill-down. The top level lists the sandbox's globals: **This Stat**, **Stats**, **Traits**, **Entities**, **Persona**, **Placeholders**, **Dictionaries**, **Clock**. A group opens in place, with a Back row, and shows the world's real names in a searchable list with each name's folder trail. A name opens its fields, read from the one list that already describes the sandbox. Picking a field inserts a complete path, `entities.Mira.traits.Wounded.enabled`, in dot form for a plain name and bracket form for a name with a space. The code runs as inserted. The Code Templates editor gets the same menu with one type-over name at each name level, because a template has no world. The flat snippet list goes away.

## User Stories

1. As a world author, I want the Variable menu to open on the sandbox's globals, so that I pick what kind of thing I reach before I pick which one.
2. As a world author, I want a group to open in place with a Back row, so that the menu works at any width and I never lose where I am.
3. As a world author, I want the menu to open at the top level every time, so that the first click is always the same.
4. As a world author, I want **This Stat** as its own top row, so that `self.value` stays one click from the top.
5. As a world author, I want **Stats** to list the stats by their code names, so that I pick Health rather than type it.
6. As a world author, I want a name level to have a search box, so that a world with forty placeholders is still quick.
7. As a world author, I want each name row to show its folder or group trail, so that two names that look alike are told apart.
8. As a world author, I want a stat's fields listed from the same source as completions and the guide, so that the menu never offers a field the sandbox lacks.
9. As a world author, I want `previous` and `delta` to drill further to their own fields, so that every value the sandbox exposes is reachable from the menu.
10. As a world author, I want **Entities** to list the entities, then an entity's fields plus **Traits** and **Placeholders**, so that I reach `entities.Mira.traits.Wounded.enabled` by clicking.
11. As a world author, I want **Persona** to list the persona's fields plus **Traits** and **Placeholders**, drawn from every entity the player may play, so that persona code is as easy as entity code.
12. As a world author, I want **Placeholders** to list the world's placeholders, then each one's fields, so that I reach a placeholder's value by name.
13. As a world author, I want a placeholder's `roll()`, `pin()` and `unpin()` in the menu, so that every member I can call is where its values are.
14. As a world author, I want `pin()` to insert with its text selected, so that I type the pin text right away.
15. As a world author, I want **Dictionaries** to list the dictionaries, then their placeholders, so that dictionary code follows the same path as entity code.
16. As a world author, I want **Clock** to list `day`, `daypart`, `deltaHours`, `elapsedHours` and `previous`, so that I never type a clock field from memory.
17. As a world author, I want the inserted path in dot form for a plain name and bracket form for a name with a space, so that the code is the shortest form that runs.
18. As a world author, I want the inserted path to use each name's code name, so that a name with a placeholder chip inserts as the sandbox reads it.
19. As a world author, I want a field row to show its description on hover, so that I learn what `regen` means without opening the guide.
20. As a world author, I want an empty group to stay in the menu with one row that says it is empty, so that the menu's shape is the same in every world.
21. As a world author, I want to move with the arrow keys, drill or insert with Enter, go back with Backspace or Left, and close with Escape, so that the menu works without a mouse.
22. As a world author, I want typing at a name level to go into the search box, so that I can type the first letters of a name.
23. As a world author, I want the insert to land at the caret and be one undo step, so that the menu behaves as the Slot menu does today.
24. As a world author, I want the menu to read the same names the editor's completions read, so that a rename shows in both at once.
25. As a template author, I want the same drill menu in the Code Templates editor, so that I learn one menu.
26. As a template author, I want each name level in the template editor to insert a selected `Name` to type over, so that a template, which has no world, still gets a complete path.
27. As a world author, I want the Stat Code Guide to say what the menu holds, so that the help window can answer "how do I reference an entity's trait".
28. As a world author, I want no change to completions, diagnostics or the Slot menu, so that the rest of the editor is as it was.

## Implementation Decisions

**1. Tree builder.**

- One pure module builds the menu tree from two inputs: the stat code surface (the global, stat, previous, delta, clock, placeholder, trait, entity, persona and dictionary field lists) and the world names the editor already holds (stat names, this stat's name, placeholders with owners and dictionaries, trait names, entities with their traits and persona flag).
- A node is a group, a name list, a field, or an empty marker. A group holds child nodes. A name list holds rows, each with a code name, a folder trail and a child subtree. A field holds its insert text, an optional selected substring, and the surface entry's info text. An empty marker holds its message.
- The top level is, in order: This Stat, Stats, Traits, Entities, Persona, Placeholders, Dictionaries, Clock. `console` is not offered.
- This Stat's fields are the stat fields, with `self` as the root. Stats drills to a name list, each name to the stat fields with `stats.<name>` as the root. `previous` and `delta` drill to their own field lists; `delta` drills once more to each source's fields.
- A placeholder's fields come from the placeholder field list for its kind. `roll()` and `unpin()` insert complete. `pin()` inserts `pin("")` with the empty text selected. An Object's `pin` inserts `pin([""])`.
- Entities drills to a name list, then to the entity fields plus two groups, Traits and Placeholders, each a name list over that entity's own traits and placeholders. Persona shows the persona fields plus the same two groups; its name lists are the union over every entity flagged as a persona, one row per distinct code name, with the owner as the trail.
- Dictionaries drills to a name list, then to the dictionary fields plus a Placeholders group over that dictionary's own placeholders.
- A path segment is dot form when the code name is a plain identifier, by the same test completions use, and bracket form with a JSON string otherwise.
- An empty name list is one empty marker: "No entities in this world", and so on per group. A group is never hidden.
- In template mode the builder gets no world names. Every name list is one row that inserts the literal `Name` and selects it; the path then reads `stats["Name"].value`. The rest of the tree is unchanged.

**2. Menu component.**

- A new drill menu component replaces the flat insert popover for the Variable button. It keeps the Variable label and icon, opens as a popover under the toolbar, and owns a level stack. Each level renders in the existing drill slide, entering from the right going deeper and from the left going back.
- A group level and a field level render plain rows. A name-list level renders the existing breadcrumb picker list: search box, rows with their trail, an empty message when the search misses. Inside the search box Up and Down stay with the list; Back is reached by Shift+Tab or by Backspace on an empty search (ruling Q19). The menu is 16rem wide at every level (ruling Q20).
- Every level below the top has a Back row first, as the Traits + menu has.
- Picking a field inserts its text through the same insert path the Slot menu uses, with the same selection and undo behavior, and closes the menu.
- Opening the menu resets the stack to the top level.
- Each level below the top opens with focus on its Back row, as the Design System says for drill flyouts; the top level focuses its first row. Escape closes from a capture-phase handler, because a focused field row's tooltip would otherwise consume the first Escape; jsdom does not reproduce this, so the browser check covers it (ticket 02 notes).
- Keyboard: Up and Down move the active row; Enter drills a group or name and inserts a field; Backspace and Left go back one level, except inside a non-empty search box, where they edit the text; Escape closes. The search box takes focus on a name-list level.
- A field row shows its info text in a tooltip. The row's accessible name stays the field name.
- The Slot menu is unchanged.

**3. Call sites.**

- The stat box passes the names it already passes to the editor; the builder takes them from the editor's session. One widening: world traits travel as places (id, name, group path) rather than bare names, so a Traits row shows its group path, or World with none, as the template slot picker does (ruling Q18).
- The template editor renders the same component in template mode. The menu picks template mode from the editor's slots flag, so the swap lands with the menu itself and no intermediate state shows world-mode markers in the template editor (ruling Q17).
- The Tool script editor keeps its flat list. The surface type keeps its snippets field for that caller.
- The stat code snippet list is removed. The surface's snippets field is empty for stat code; the drill tree takes its place.

**4. Docs.**

- The Stat Code Guide gets one paragraph under its editor section: the menu's top level, that a group opens the world's names, and that a field inserts a path that runs.
- The changelog entry from the flat-list change is folded into this feature's entry, not kept beside it.

**5. Shapes.**

- No world or save shape changes.

## Testing Decisions

A good test picks through the menu as an author does and reads what landed in the code, or asks the builder for a tree and reads its leaves. It never reads a component's level stack or a row's class names.

- **Primary seam: the tree builder.** Given a fixture world, assert: the top level order; This Stat roots at `self`; a plain name takes dot form and a spaced name bracket form; a chip-bearing name inserts its code name; `previous` and `delta` drill with the surface's fields; `pin` selects its text and an Object's `pin` takes a list; Persona unions the persona-flagged entities' traits with no duplicates; a dictionary's placeholders are its own; an empty group holds its marker; template mode yields one type-over row per name list; every leaf's info text is the surface entry's. Prior art: the surface tests and the analysis tests.
- **Sandbox guard.** Build the tree over a fixture world and run every leaf's insert text in the executor; each must run clean. In template mode, run each leaf as well, because an unknown name reads as a blank entry and must not throw. This replaces the snippet guard added on 2026-10-05.
- **Menu seam.** In the editor's own test harness: open Variable, drill Stats, pick Health, pick value, and read `stats.Health.value` at the caret; Back returns one level; reopen starts at the top; Enter drills and inserts; Backspace goes back; a field tooltip carries the info text; an empty group shows its marker; the insert is one undo step. Prior art: the editor's insert and Slot tests, and the Traits + menu tests.
- **Template editor.** Open Variable there, drill to a name level, and read the type-over row and its inserted `Name` selection. Prior art: the template dialog tests.
- **Docs.** The guide section renders and the help index picks it up, as the other guide tests do.

## Out of Scope

- The Tool script editor's Variable menu.
- Write-side rows or markers; the stat-code-v6 spec adds those when it lands.
- Remembering the menu's level between opens.
- Offering `console` or any built-in.
- Changes to completions, diagnostics, the Slot menu, or the Code Templates slot pickers.
- A mobile-specific layout; the drill panel already fits a narrow width.

## Further Notes

- Grilled 2026-10-05. Q1 one panel, drill in place; Q2 real names; Q3 full path to every member; Q4 spec and tickets; Q5 searchable list with trail at name levels; Q6 template editor same drill, type-over names; Q7 Tool editor out of scope; Q8 info as hover tooltip; Q9 This Stat is its own top row; Q10 empty group stays with one disabled row; Q11 functions offered, caret inside; Q12 reads only; Q13 Persona unions persona-capable entities; Q14 reopen at top; Q15 arrows, Enter, Escape, Backspace back; Q16 one guide paragraph. Q17 (ticket 02 intent question, 2026-10-05): the menu picks template mode from the slots flag in ticket 02; ticket 04 adds tests and verification only. Ticket 02 landed 2026-10-05 as ebd8bbd3. Q18–Q20 (ticket 03 intent questions, 2026-10-05): world traits carry their group path; Up in the search box stays with the list; 16rem on every level.
- The flat eleven-row list landed on main on 2026-10-05 as a stopgap. This spec replaces it.
- The drill pattern (slide, Back row) and the breadcrumb picker list are existing design-system patterns, so no new visual pattern needs approval.
