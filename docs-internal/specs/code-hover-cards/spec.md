# Spec: Code Hover Cards

Status: done
Status note: Closed 2026-10-14. Tickets 01–16 done; last landing a4bd72913. Closed without gates.
Spec session: code-hover-cards — spec

## Problem Statement

An author who reads stat code can't ask the editor what a name is. The code editor explains a name only while the completion list is open, in one line of plain text. Once the code is written, `self.previous.regen`, `stats.Fatigue` or `traits.Brave` carries no explanation at all.

The editor also knows less than the world does. It gets stat, trait and entity names only, so it can't say what range a stat has, who owns it, what a trait requires, or which values a placeholder rolls. An author leaves the code to look each one up.

A typo gets a "did you mean" in the error text, but the author still retypes the name by hand. Nothing shows where else in the world a name is used.

## Solution

Every code editor shows a hover card, as VS Code's IntelliSense does. A card names what the code points at, shows its type and whether code can write it, and explains it. For a world name it adds the authored details: a stat's range and owner, a trait's requirements and effects, a placeholder's values and weights. Links open the item in the World Editor, list every place the world's code uses it, or open the Guide at the right heading.

The completion list shows the same card beside each option. An error card offers one-click fixes, and Ctrl+. and a lightbulb reach the same fixes.

The card follows the **Standard** preset of the mock in [mock.html](mock.html): Signature, Description, World Details, Allowed Values, Links, Quick Fix. Example and Last Test Run are out.

## Rulings

Settled with the user on 2026-10-12 and 2026-10-13.

| # | Ruling |
|---|---|
| Q1 | Every code surface gets cards: stat code, Tool scripts and the stat code template dialog. World Details show only where the editor has world data |
| Q2 | On touch, placing the caret on a name by a tap opens its card after a short pause. Typing closes it |
| Q3 | A keyboard shortcut opens the card for the name at the caret |
| Q4 | The completion list's info pane shows the same card, always open, as today's info pane is |
| Q5 | A quick fix applies three ways: a button in the error card, Ctrl+. at the caret, and a lightbulb in the gutter |
| Q6 | An authored description shows at most 3 lines. The Open link reaches the full text |
| Q7 | The lightbulb shows in full screen only, where the gutter already is. The compact box keeps the card button and Ctrl+. |
| Q8 | Open leaves full screen, then jumps to the item in the World Editor. The template dialog and the Tool editor don't show Open |
| Q9 | Find All Uses opens a popover that lists every stat whose code uses the name, with the line. A row jumps to that stat's code at that line |
| Q10 | The shortcut is Ctrl+K Ctrl+I (Cmd on macOS). Ctrl+I keeps CodeMirror's select-syntax command |
| Q11 | World Details cover stats, traits, placeholders, entities and dictionaries |
| Q12 | A stat card shows Type, Range, Starts At, Regen, Owner and Shown To. A row at its default value is left out |
| Q13 | Allowed Values for a placeholder show each value's weight. A weight-0 value shows faded |
| Q14 | A name the code declares gets a card with its kind and a Go To Line link. No inferred type |
| Q15 | A trait card shows Mode, Requires, Changes and Bearers. Row name and content amended by Q20 |
| Q16 | This effort rewrites every code surface's info lines in the Writing Guide voice |
| Q17 | Cards show in live editors only. Read-only code previews stay plain |
| Q18 | A template slot gets a card with its type and default |
| Q19 | The card's look is approved as a Design System pattern. The card and the Find All Uses popover join the Design System page and showcase |
| S1 | Tests sit at two seams: the pure analysis model, and the mounted code editor |
| Q20 | The trait card's last row is **Bearers**: every entity that has the trait, directly or through a Link, with **You** for the persona. The glossary avoids "held by" and "Always On"; Automatic shows only in the Mode row, under its player-facing name |
| Q21 | Find All Uses matches the item itself, not its name. The player's Health and Mara's Health are separate. A row names the stat, its box (Before or After) and the line |
| Q22 | Entities and dictionaries get Find All Uses too. Every card with Open has Find All Uses |
| Q23 | The template dialog and the Tool editor hide Find All Uses, as they hide Open (Q8) |
| Q24 | Clicking Find All Uses pins the card open, and the list hangs off it. Escape or a click outside closes both |
| Q25 | Open on an entity's own stat or trait selects the entity, opens its Stats or Traits tab and reveals the row. The library editor hides Open and Find All Uses |
| Q26 | A card on `persona` lists the entities the player can play. The player picks one at Enter World |
| Q27 | Stat rows at a default drop by one fixed table: Regen 0, Starts At equal to the minimum, Shown To both AI and player. Type, Range and Owner always show |
| Q28 | A card shows effective values: a Link's or a Copy's Overrides, then the Blueprint for every other field. These are what the code reads |
| Q29 | The Tools doc gets one heading per Tool global, so Tool cards link to the Guide too |
| Q30 | In a Blueprint stat's box, a card on `owner.stats.X` shows the Blueprint's own values, plus a Bearers row listing who runs the code. Q28's effective values apply where one Link or Copy is meant |
| Q31 | A stat's own `self` lines count as uses in Find All Uses. A Blueprint box with no bearers is still listed, marked No Bearers |
| Q32 | The cards link to the Stat Code Guide's own headings for `self`, `stats` and `owner`: `StatCodeGuide#self`, `#stats`, `#owner`. Owner-route ticket 07 added them (2175dff98) |
| T01-1 | Ticket 01: "completion does not change" means no regressions. Where the old regexes were wrong, completion follows the tree toward what the sandbox has: `owner.traits.X.` offers trait fields, `owner.traits["` offers nothing until the editor knows owner trait names, spaced and `?.` chains offer members, a dot in a comment offers nothing. A root the code declares itself keeps the sandbox list in completion; hover treats it as the author's own name. Each fix gets its own test; existing tests stay unchanged |
| T01-2 | The resolver keeps completion's stat-like heuristic: a variable declared from `stats` or `self` reads as a stat. The card model shows no card for a member the resolved entry doesn't have, so `n.toFixed` on such a variable gets none. Ticket 02 |
| T01-3 | The resolver resolves `owner.placeholders.X`. Completion and cards get owner trait and placeholder names from the box-bound lookup. Ticket 07 |
| T02-1 | The access badge reads **Read-Only**, AP title case like every card label, matching the Design System's Read-Only control. Prose keeps "read-only" |
| T02-2 | A map key the box's name lists lack (`stats.Helth`) gets no card; its diagnostic's error card carries the fix (ticket 09). A host with no name lists still cards the key |
| T06-1 | The Owner row reads the entity's name for an entity's own stat or Link, "World" for a loose world stat, and "Blueprint" for a Blueprint stat in its own box |
| T06-4 | The `self` card adds a Stat row naming the running stat, above the stat rows. Starts At reads the starting value, else the value, else the minimum. Range reads "min – max", with % for a percentage stat. Regen reads in the stat's regen unit ("per story hour") |
| Q34 | A card on `persona.stats.X`: when every playable entity's X shares one Blueprint, it shows the Blueprint's values plus an Owner list (as Q30). Otherwise it shows only the Owner list of who has X, with no value rows. With no playable entity, no World Details |
| Q35 | Shown To covers Hidden only: "AI only" for a hidden stat, dropped at the default. A separate Off row, "Off until a trait turns it on", shows only for a stat that starts switched off. Q12's row set gains it |
| T06-5 | In a Blueprint stat's box, the `self` card carries the Bearers row: `self` and `owner.stats.<self>` reach one stat, so they show one card (Q30) |
| T06-6 | Ticket 06's `owner` card in an owned box shows interim Entity and Stats rows. Ticket 07 replaces them with the entity card's rows |
| T07-1 | A placeholder card's pin state is a **Pinned By** row: every authored Pin source that holds it (trait, location, stat band, value), in Pin precedence order, with the value each pins. Dropped when nothing pins it. No live pin state |
| T07-2 | Placeholder **Owner** reads World, the entity's or dictionary's name, or the owning placeholder's name. **Kind** reads the editor's own kind noun |
| T07-3 | Allowed Values: one line per value, text then ×weight (×1 shown), weight-0 faded, a Copy's effective values. Chips stay as raw `{{...}}` text. At most 12 values, then "and N more". Every comma list on a card uses the same cap |
| T07-4 | **Requires**: one line per Requirement Row in the gate rows' wording, Conditions joined by "and"; each row after the first starts with "or". Dropped when the trait has no rows |
| T07-5 | **Changes**: stat changes as "Stamina max +10" (facet word only for min, max, starting and regen), then stat toggles as "Fatigue on" or "Fatigue off" by direction. Dropped when empty. **Mode** always shows |
| T07-6 | **Bearers** lists **You** when the world's root holds the trait, then each entity whose tree has it, owned or through a Link. Every route lists the Bearers of the trait it reaches |
| T07-7 | Entity card: the player description, then Type (when set), Persona ("Can be played"), Stats, Traits, Placeholders as capped comma lists ("None" when empty). Dictionary card: description, Placeholders, Entries count |
| T07-8 | The `persona` card shows a **Can Play** row of playable entities, and its description carries the library-persona note |
| T07-9 | `clock.daypart` and `clock.previous.daypart` show the six dayparts as Allowed Values, without weights |
| Q36 | Code editing shows only in Advanced mode, so Open never meets a tab Simple mode hides. Open needs no mode handling |
| T11-1 | A Blueprint stat's card (no entity id) matches the Blueprint and every linked copy. A card for an entity's own stat or one bearer's copy matches that owner only |
| T11-2 | A Find All Uses row reads "Stat · Before · Line 3", or "Entity › Stat · After · Line 7" for an entity's own stat or a Link override box. A Blueprint box with no bearers carries a muted No Bearers tag. Rows follow world box order, then line order |
| T11-3 | The link reads Find All Uses with no count, so a card never scans on open. The popover heading carries the count ("3 Uses") |
| T11-4 | The link shows on every stat card that has Open. With no uses, the popover says "No uses in stat code" |
| T12-1 | Find All Uses keeps a name when its card resolves to the searched item. `owner` in an entity's own or Link box is a use of that entity, as `self` is of its stat (Q31); in a Blueprint box it has no item. One row per box and line still holds |
| T12-2 | A world trait matches on every route that reaches its id; an entity's own trait by its id only. A dictionary matches by id |
| T12-4 | Where one route reaches several entities (`persona.traits.X` with several playables, `owner.traits.X` or `owner.placeholders.X` in a Blueprint box), Find All Uses matches when any entity it reaches holds the searched item, as the stat scan does. T12-2 wins over T12-1's card-based wording; T12-1 states the single-target case |
| Q37 | A trait or placeholder card on a route that reaches several entities follows Q34: one shared item shows that item plus a Bearers list; mixed items show only the Bearers list. Ticket 15 |
| T15-1 | On a route that reaches two or more entities, Bearers lists only the reached entities, as Q34's Owner list does. A route that reaches one entity (one playable for `persona`) is not a multi-entity route: it keeps the plain card with T07-6's full Bearers |
| T12-3 | Placeholders follow T11-1: a Blueprint placeholder's card matches the Blueprint and every Copy; a Copy's card matches that Copy only |
| T16-1 | On the `owner` card in an entity's box, the entity's description replaces the `owner` global's info line, as a world name's authored description does on every card. With no entity description, the info line stays |
| T08-1 | The completion pane shows the declared-name card too (Q4: the same card). The card's description reads "Declared on line N", so neither surface loses today's "Declared in this code". The pane leaves out the Go to Line link, which it can't act on; hover keeps it. Ticket 04's tests that pinned no card for a declared name change to expect it |
| O1 | Owner-route lands first. Its `stats` (world stats in every box), `owner`, and writes on every route (its Q1–Q5) are this spec's baseline. Its tickets 01–07 landed on 2026-10-13. Find All Uses waits on its ticket 08 |

## User Stories

1. As an author, I want to hover `self` in stat code, so that I see which stat the code belongs to and its range.
2. As an author, I want to hover `stats.Fatigue`, so that I see Fatigue's type, range, starting value, regen, owner and who it is shown to.
3. As an author, I want to hover `.value` after a stat, so that I see it is a number I can write.
4. As an author, I want a Read-Only badge on `self.previous` and `clock`, so that I don't try to write them.
5. As an author, I want a "Writable After This Run" badge on `traits.Brave.enabled`, so that I know when my write takes effect.
6. As an author, I want to hover `traits.Brave`, so that I see its mode, requirements, stat effects and its bearers.
7. As an author, I want to hover `placeholders.Mood`, so that I see its owner, kind, values and weights.
8. As an author, I want weight-0 values to look faded, so that I know `roll()` never draws them.
9. As an author, I want to hover `clock.daypart`, so that I see the six dayparts it can hold.
10. As an author, I want to hover `entities["Mara"]`, so that I see the entity's description and what it holds.
11. As an author, I want to hover `persona`, so that I see which entities the player can play. Hovering `owner` shows the owning entity, says it is empty in a world stat's box, or lists the bearers in a Blueprint stat's box.
12. As an author, I want to hover `dictionaries.Fauna`, so that I see its description and its placeholders.
13. As an author, I want to hover a method like `roll`, so that I see its parameters and what it returns.
14. As an author, I want to hover a name I declared, so that I see its kind and jump to the line that declares it.
15. As an author, I want a long description cut to 3 lines, so that a card never fills the screen.
16. As an author, I want an Open link on a world name, so that I jump to that item in the World Editor.
17. As an author in full screen, I want Open to leave full screen first, so that I land on the item.
18. As an author, I want Find All Uses on a world name, so that I see every stat whose code reads or writes that exact item.
19. As an author, I want a Find All Uses row to jump to that stat's code box at the line, so that I fix every use quickly.
20. As an author, I want Mara's Health and the player's Health listed apart, so that a search never mixes two owners. A use through `owner.stats`, `entities["Mara"].stats` or `persona.stats` counts as a use of the stat it reaches.
21. As an author, I want the card to stay open while I use its Find All Uses list, so that the list doesn't vanish under my pointer.
22. As an author, I want Open on Mara's own stat to land on that stat's row in Mara's Stats tab, so that I don't hunt for it.
23. As an author, I want a card on a Link to show the Link's own range and regen, so that the card matches what the code reads.
24. As an author, I want a Read in the Guide link, so that I read the full rules for a global.
25. As an author, I want the completion list to show the full card beside each option, so that I pick the right stat before I insert it.
26. As an author, I want an error card to show "Change to Health" on `stats.Helth`, so that I fix a typo with one click.
27. As a keyboard author, I want Ctrl+. to list the fixes for the error at the caret, so that I fix it without the mouse.
28. As an author in full screen, I want a lightbulb beside a line that has a fix, so that I see fixes at a glance.
29. As a keyboard author, I want Ctrl+K Ctrl+I to open the card for the name at the caret, so that I read it without a mouse.
30. As a screen reader user, I want the card announced when it opens from the keyboard, so that I hear the same content.
31. As a touch author, I want a tap on a name to open its card after a short pause, so that I get cards without hover.
32. As a touch author, I want typing to close the card, so that it never covers what I type.
33. As an author, I want the card to stay open while my pointer is on it, so that I can click its links.
34. As an author, I want Escape to close the card, so that I return to the code.
35. As a Tool author, I want cards in the Tool script editor, so that `args` and its members explain themselves.
36. As a template author, I want a slot to show its type and default, so that I know what fills it.
37. As a template author, I want no Open or Find All Uses link in the template dialog, so that I never lose the dialog's work.
38. As an author, I want card text in the same voice as the rest of the help copy, so that it reads as one product.
39. As an author on the light and dark themes, I want cards to use the app's colors, so that they match the editor.
40. As an author in a dialog, I want cards to stay clickable and unclipped, so that the dialog's scroll lock doesn't eat my clicks.

## Implementation Decisions

- **Card model.** A new pure analysis function returns a card model or null for a position in the code. It sits beside the completion and diagnostic functions and takes the same analysis options. The model holds the signature (kind, path, type), an access badge, the description, optional world rows, optional allowed values, links and fixes. The editor only renders it.
- **One resolver.** No shared resolver exists today: completion reads the text before a dot through a chain of regexes, and diagnostics walk the syntax tree. A new tree-based resolver takes a position and returns the kind, the owner, the key and its range. It grows from the tree path the diagnostics already use for entries and owner stats. Completion moves onto it, with its existing tests as the guard. Hover is never built on the text regexes. It covers dot and bracket forms (`stats["Max HP"]`, `entities["Mara"]`). A string that is not a map key, such as `x === "Health"`, gets no card. The completion list's catch-all, which offers stat names inside any string, stays out of hover.
- **Card identity.** The resolver returns what the name is, not only its text: kind, owner and id. `entities.Mara.stats.HP` resolves to Mara's HP, not to the bare name "HP". A code name maps back to its record through the same code-name map the sandbox and the Test Bench use, so the card shows the item the code reads at run time.
- **Routes.** Under owner-route, `stats.X` is a world stat in every box, and `owner.stats.X` is the owner's own stat. A card resolves each route to the stat it reaches: `stats`, `owner.stats`, `entities[x].stats` and `persona.stats`.
- **Access badge.** A surface entry gains an access field (writable, read-only, writable after this run), and the badge reads it. The field derives from the executor's own writable-field lists, so the badge and the sandbox can't drift. `value`, `min`, `max` and `regen` are writable on every route; every other stat field is read-only. The words "Writable" and "Read-only" leave the info lines.
- **Lists without a badge.** The Variable menu and the Tool editor's reference list show info lines but no badge. Both render the access field as text, so neither loses the word.
- **Owner card.** A card on `owner` depends on the box. In an owned stat's box it is the owning entity, with its World Details. In a world stat's box it says the entry is empty here and writes through it are dropped; it has no Open or Find All Uses. In a Blueprint stat's box it lists the bearers the code runs for.
- **Blueprint boxes.** In a Blueprint stat's box, a card on `owner.stats.X` shows the Blueprint's own values and a Bearers row (Q30).
- **Tool editor reference.** The Tool editor's own reference list shows no badge, so its lines keep their access words, or the list renders the access field as text.
- **World lookup.** The editor gets a lookup it calls when a card opens, not full world records up front. Today's name lists stay the only lint inputs, so re-linting still fires on name changes only. The stat code box supplies the lookup from the authored world, bound to its box: it carries the owner's identity (today the entity id stops at the code box) and, for a Blueprint box, its bearers. Cards on `self`, `owner` and `owner.stats.X` need both. The Tool editor, the template dialog and the library editor supply none, so their cards have no World Details.
- **Effective values.** The lookup returns what the code reads: a Link's or a Copy's Overrides, then the Blueprint for every other field. Placeholder weights come from the Copy.
- **Stat rows** read Type, Range, Starts At, Regen, Owner and Shown To. Regen uses the stat's regen unit. An Off row shows for a stat that starts switched off (Q35). Rows drop by one fixed default table: Regen 0, Starts At equal to the minimum, Shown To both AI and player, Off when the stat starts on. Type, Range and Owner always show.
- **Trait rows** read Mode, Requires, Changes and Bearers. Mode uses its player-facing name (Automatic, never the stored value). Requires uses the trait gate rows' wording. Bearers lists every entity that has the trait, with **You** for the persona, the set the requirement picker offers.
- **Persona card.** `persona` lists the entities the player can play. It notes that under a library persona, code reaches the Custom Persona through `entities[...]`, as owner-route's Persona section says.
- **Fixes in diagnostics.** A diagnostic gains a machine-readable list of fixes. Each fix has a label and a text replacement. The "did you mean" suggestion becomes the first fix. Today about ten checks put the suggestion only into message text; every one routes it through the same plumbing that tags a missing name. A suggested name with a space rewrites a dot form into a bracket form, with the rename offer's key splice, which is exported for this. CodeMirror's diagnostic actions render the error card buttons, and Ctrl+. reads the same list.
- **Lightbulb.** A gutter of its own shows a marker on a line whose diagnostics carry a fix. It sits beside the lint gutter and, like it, shows in full screen only.
- **Completion pane.** The info pane draws the same card with a DOM renderer. The card is built only for the option on screen, not for every option on every keystroke.
- **Card rendering.** One renderer draws the card for hover, the keyboard shortcut, the caret pause and the completion pane. It uses the app's popover tokens and mounts on the existing tooltip host, so it keeps its pointer events inside dialogs.
- **Triggers.** A pointer hover opens a card after the standard hover delay and keeps it open while the pointer is on it. Ctrl+K Ctrl+I opens it at the caret. On touch, a tap that places the caret on a name opens it after a short pause, and the hover path doesn't open a second card for the same tap. Typing closes it.
- **Escape.** While a card is open, Escape closes the card and stops there. With no card open, Escape passes through as today, so full screen still closes on it.
- **Screen readers.** A card opened from the keyboard is announced through a live region. Tests read that region.
- **Open.** Open uses the World Editor's select-and-reveal path. For an entity's own stat or trait it selects the entity, opens its Stats or Traits tab and reveals the row; the path grows that row step. From full screen it leaves full screen first. The template dialog, the Tool editor and the library editor hide Open.
- **Find All Uses.** The scan matches the item, not its name, so two owners' stats with one name stay apart. It covers stats, traits, placeholders, entities and dictionaries, across every stat's Before and After code. Stat uses come from the shared route-to-target module that owner-route ticket 08 extracts: it takes a world and returns each reference with its box, its route and the stat it reaches, across every box in the world. The Test Bench and the rename planner use it too. Each reference carries its key range (from/to in the box's code), confirmed by the owner-route spec session; Find All Uses turns it into a line. A route resolves as owner-route rules it: `owner` to the box's owner, `persona` to every entity that can be played. A row names the stat, the box and the line, one row per box and line, not per bearer. A stat's own `self` lines count as uses. A Blueprint box with no bearers is still listed, marked No Bearers (Q31). A row selects the stat, opens the box and moves the caret to the line; the code session grows a call for that. The same hosts that hide Open hide Find All Uses.
- **Pinned card.** Clicking Find All Uses pins the card, and the list hangs off it. Escape or a click outside closes both.
- **Guide links.** Each global's link lives in one table: global to page and heading. Stat code globals target the Stat Code Guide, whose `#self`, `#stats` and `#owner` headings serve those three (Q32); `clock`, `traits`, `placeholders`, `entities`, `persona` and `dictionaries` target their existing sections. Tool globals target the Tools doc, which gains one heading per global. Links go through the existing docs opener, which falls back to the wiki. A test resolves every row through the docs link checks.
- **Copy case.** Card labels use AP title case: Starts At, Shown To, Find All Uses, Go to Line, Writable, Read-Only, Writable After This Run. Both parts of a hyphenated label are capitalized (T02-1). Prose keeps sentence case ("read-only").
- **Copy.** Every code surface's info lines move to the Writing Guide voice: verb-first, second person, no period on a single sentence.
- **Design System.** The card and the Find All Uses popover join the Design System page and the showcase.
- **No export-shape change.** Nothing here touches world or save files.

## Testing Decisions

- A good test reads behavior from outside. It asks the card model for a position and checks what an author would see, or mounts the editor and checks the DOM. It never asserts on private helpers or CodeMirror internals.
- **Analysis seam.** These tests cover what a card says: every global and member resolves to the right signature and badge; world rows come out per kind, and default rows drop; weights show and weight-0 values are marked; a declared name gets kind and line; a slot gets type and default; an unknown name gets no card; fixes carry the right replacement. Prior art: the `statCodeAnalysis` test files, one file per area.
- **Editor seam.** These tests mount the real code editor and cover when a card shows and what its controls do: hover, Ctrl+K Ctrl+I, caret pause on touch, and the completion pane's card; a fix button, Ctrl+., and the lightbulb in full screen only; Open and Find All Uses call their navigation, and Open is missing in the template dialog. Prior art: the CodeArea test file and the code insert tests on the World Editor.
- **Guards bite.** Each guard test is checked by putting its bug back. These need it: the default-row table, `stats.X` in an entity's box resolving to the world stat, the bracket resolver refusing a non-key string, Find All Uses keeping two owners' same-named stats apart and joining aliases of one stat, and the hosts that hide Open and Find All Uses.
- **Copy.** The `copy-sweep` skill reviews the rewritten info lines. The Quick Reference test already reads the surface tables, so it guards that the rewrite keeps every row.
- **Links.** One test resolves every Guide-link row through the docs link checks.
- **Resolver move.** Completion's existing tests pass unchanged on the new resolver before hover uses it.

## Out of Scope

- Example code in cards, and values from the last Test Bench run. Both are mock layers the user left out of Standard.
- Inferred types for names the code declares.
- Signature help while typing arguments.
- Peek, the inline editor of another item.
- Cards in read-only code previews: Guide code fences and template previews.
- A Find All Uses scan of Tool scripts.

## Further Notes

- Owner-route ([its spec](../owner-route-open-stat-writes/spec.md)) changed this effort on 2026-10-13: per-path read-only access was dropped, the `owner` card and route resolution were added, Find All Uses reuses its write scan, and Q30 settles Blueprint boxes. Its surface-table and Guide edits land first, so this effort's copy sweep (Q16) starts from them.
- A second check against owner-route's landed code (tickets 01–06) on 2026-10-13 changed the resolver, Find All Uses, lookup, fixes and access decisions above, and added Q31–Q32.
- **Ticket order** for slicing. Find All Uses is two tickets, stats first, then the other kinds:
  1. Tree resolver and card model; completion moves onto it.
  2. Access field and the info-line copy sweep.
  3. World lookup and World Details rows.
  4. Card renderer, triggers, Escape, live region, completion pane.
  5. Diagnostic fixes, Ctrl+. and the lightbulb.
  6. Find All Uses for stats on owner-route ticket 08's module, with the reveal-at-line call.
  7. Find All Uses for traits, placeholders, entities and dictionaries.
  8. Open with the entity row reveal.
  9. Guide-link table and Tools doc headings, and the Design System entry.
- Escape inside a dialog: a separate fix on main makes Escape close the completion list without closing the dialog, by the same window-capture pattern as the card's Escape. The card and the list each own a listener; merging them into one "close the open popup" handler is optional cleanup, not owed by any ticket.
- Ticket 16 (a4bd72913): Test Code's and the help code test's trait names now follow Traits-tab order, as the editor's do. The code editor still takes a box's analysis options as separate props; the stat code box feeds them from the one shared builder.
- The mock in [mock.html](mock.html) is the visual reference. Its sample world is invented. Its labels are sentence case and its trait row says "Held"; the spec's labels win.
- An agent reviewed the spec against the code on 2026-10-13. Its findings became Q20–Q29 and the decisions on identity, bracket keys, Escape, the lightbulb gutter and lazy completion cards.
- CodeMirror's default keymap binds Ctrl+I to select the enclosing syntax node. That is why the shortcut is a chord.
- "Code surface" here means the list of names one kind of code can reach. It is not the glossary's Surface, which is a screen, dialog or tab.
