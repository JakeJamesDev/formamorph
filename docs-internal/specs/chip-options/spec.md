# Spec: Chip Options

Status: done
Status note: Closed 2026-10-13. Tickets 01–10 done; last landing 2ead85633. Closed without gates.
Spec session: chip-options — spec

## Problem Statement

A prompt chip's options open in a small popover. The Entities chip already stacks four pieces and three placement fields in it, and there is no room for more. Two efforts need more at once: the stat pass will read the Entities and Persona chips and must ask for "only entities that own stats", and the AI will later read and edit entity traits, which needs the same kind of filter for traits. Adding each as one more single-select piece outgrows the popover and scatters related choices.

The popover also tells an author nothing about the output. The help lines say what a piece does in words. The author has to open the Preview tab to see what a pick sends.

## Solution

Every chip opens **Chip Options**, a centered dialog, in place of the popover. It has two panes.

- **Left: the controls.** Short rows, one per piece. A segmented control picks one. A row of checkboxes picks many. An axis with four or more options is a dropdown. The placement fields (Header, Prepend, Append) sit below a rule.
- **Right: What the AI Reads.** The chip's value rendered with the current picks, header and affixes included in the chip's format. Hovering a control lights the lines or the stat piece it produces and dims the rest.

The Entities and Persona chips gain three groups of pieces:

- **A filter**: keep only entities that own stats, traits, or either. The chip face shows a filter glyph while it is on, with a tooltip naming the picks.
- **Owned traits and owned stats** on or off per entity.
- **Stat detail**: Range, Descriptor, Description, the same three pieces the Stats chip has.

Default prompts do not change. A bare token renders what it renders today.

## Rulings

Settled with the user on 2026-10-12.

| # | Ruling |
|---|---|
| Q1 | The menu is a centered Dialog |
| Q2 | Every chip uses it. A chip shows only the groups it has |
| Q3 | Persona gets the filter too. A filtered-out persona renders nothing, as when no persona is set |
| Q4 | Owned stats on Entities and Persona get the Stats chip's three detail pieces: Range, Descriptor, Description |
| Q5 | No name-style option. In the stat pass the request renames stats to their keys before any chip renders, as the Stats chip does today |
| Q7 | Old token spellings parse forever and map onto the new pieces. The editor writes the new spelling only when a chip is edited |
| Q8 | Owned traits are on for a bare token |
| Q9 | Superseded by Q24. Owned stats may render for every scope |
| Q10 | A prototype settled the layout before the spec (branch `prototype/chip-options`) |
| Q11 | The dialog is named Chip Options in copy, help and the glossary |
| Q12 | This spec ships the dialog, the filter, the traits toggle and stat detail on owned stats. The stat pass reading Entities and Persona chips is a sibling spec |
| Q13 | The filter is a pick-many control, Stats and Traits. Picks read as **or** |
| Q14 | An active filter shows as a filter glyph on the chip face, not in the label |
| Q15 | The glyph's tooltip lists the picks |
| Q16 | Superseded by Q25. A Persona chip whose persona fails the filter renders nothing |
| Q17 | The dialog stays centered on every screen size and scrolls inside |
| Q18 | Prototype variant F wins: controls on the left, the rendered value on the right |
| Q19 | Pick-many rows are inline Checkbox plus label pairs, not pills |
| Q20 | An axis with four or more options renders as a dropdown. Three or fewer stay segmented |
| Q21 | Hovering a control lights what it produces. A stat detail piece lights only its own text inside the stat line |
| Q22 | The right pane renders real data when the editor has it and the authored sample scene when it does not. It never carries a third data set of its own |
| Q23 | Row names: the filter is **Only With**, the per-entity toggles are **Include**, the stat pieces are **Stat Detail** |

Settled with the user on 2026-10-12 after a second review.

| # | Ruling |
|---|---|
| Q24 | Replaces Q9. Owned stats stay off by default for the Sub-Locations and Reachable scopes, as entity-stats Q51 left them. Those scopes get a positive stats-on id; Here and In Scene keep stats on by default. Bare default tokens stay byte-identical and no probe runs |
| Q25 | Replaces Q16. A Persona chip whose persona fails the filter renders what an unset persona renders: the N/A placeholder bare, nothing with a header or affix |
| Q26 | Only With applies under Name content. The name list holds only the entities that pass. Include and Stat Detail stay disabled under Name |
| Q27 | None of the six new ids appears in the chip's label. Only With shows as the glyph; Include and Stat Detail show only in the dialog |
| Q28 | The dialog ships as two tickets: the shell with today's rows, then the Entities and Persona rows |
| Q29 | The What the AI Reads pane is for prompt chips only. Placeholder chips and Tool argument chips open the one-column dialog with their current rows |

Spec-session rulings for ticket sessions.

| # | Ruling |
|---|---|
| Q30 | (ticket 04) The shell keeps today's lock rule, the last non-default toggle on is locked. Ticket 05 switches the dialog to the registry's lock groups |
| Q31 | (ticket 04) The dialog title is Chip Options. The chip's color swatch and label sit in the description line under it |
| Q32 | (ticket 04) The shell's right pane shows the title What the AI Reads over an empty bordered box, no placeholder text. The prototype's raw-token footer is dropped; the footer holds Re-Pick and Edit Value, right-aligned |
| Q33 | (ticket 04) Registry help lines become tooltips: an option's help on its segment or dropdown item, a toggle axis's help on its checkbox label, read-only help on the disabled control, and the Label, Header and Prepend/Append help on their row labels. A chip with no rows keeps the "No options for this variable." line |
| Q34 | (ticket 04) Row names for today's axes are the axis's own label. A single unnamed axis reads Mode. The Stats chip's three toggles form one Stat Detail row. The Entities and Persona stats toggle is one Include row with a Stats checkbox, which ticket 05 extends with Traits |
| Q35 | (ticket 04) Two panes for prompt-variable chips everywhere, scene chips in a Tool template included. One column for placeholder, Tool argument and Formaquestion help-prompt chips |
| Q36 | (ticket 04) Width is max-w-3xl with two panes and max-w-md with one column, both at most 85vh and scrolling inside |
| Q37 | (ticket 01) The lore chip is the one exception to "live values first" in the in-game Preview: it keeps today's fall-through to the sample lore, since a turn activates lore per request. Showing the live scene's enabled lore in Preview is a separate product change, out of scope here |
| Q38 | (ticket 02) The Entities stats axis has three stored states: scope default, off, on. The stats-on id stays out of the chip label like the six new ids; the off id keeps showing "No Stats" as today |
| Q39 | (ticket 02) Ticket 02 hides the six new axes from the dialog behind a registry flag the shell reads. Ticket 05 removes the flag when it adds the rows and switches the dialog to lock groups |
| Q40 | (ticket 03) The Settings sample scene gives Wren one authored stat and one trait, so every Only With spelling renders lines there and the sample test keeps its no-placeholder rule. Only the sample preview changes |
| Q41 | (ticket 09) The ticket writes one changelog fragment with the forward-compatibility note. The spec session folds the five landed Chip Options entries into one and corrects the entity-stats line on main after the ticket lands; a ticket branch never edits the changelog |
| Q42 | (ticket 09) Chip Options gets an entry in CONTEXT.md beside the corrected Chip Values entry, and a row in the player Glossary |
| Q43 | (ticket 09) The forward-compatibility line says "an older version", with no version number. The Design System section lands marked Proposal with its showcase reference; the user approves the pattern at hand-off |

## User Stories

1. As a prompt author, I want the chip's options in a dialog with room, so that related choices sit together and I can read them all at once.
2. As a prompt author, I want to see what a chip sends while I change its options, so that I do not switch to Preview after every pick.
3. As a prompt author, I want the header, prepend and append to show in that rendering, so that I see the whole block the chip puts in the prompt.
4. As a prompt author, I want hovering a control to light the text it produces, so that I learn what each piece does without a help line.
5. As a prompt author, I want to keep only entities that own stats, so that the stat pass reads a cast that has something to update.
6. As a prompt author, I want to keep only entities that own traits, so that a future trait pass reads the right cast.
7. As a prompt author, I want both filters at once to mean either, so that checking more boxes widens the cast.
8. As a prompt author, I want to turn owned traits off per chip, so that a short prompt can leave them out.
9. As a prompt author, I want to pick Range, Descriptor and Description for owned stats, so that entity stats are as terse as the Stats chip can be.
10. As a prompt author, I want the chip face to show a filter glyph with a tooltip, so that I see a filter is on without opening the dialog.
11. As a prompt author, I want my saved presets and world prompts to keep working, so that a grammar change never blanks a chip.
12. As a world author, I want the dialog to render my own entities and stats when the editor has them, so that the sample is my world, not a stand-in.
13. As a player with a custom preset, I want a bare chip to render exactly what it rendered before, so that an update does not change my prompts.
14. As a prompt author on a small screen, I want the dialog centered and scrolling inside, so that it behaves like every other dialog.
15. As a prompt author, I want a long option list as a dropdown, so that the labels never overflow.
16. As a prompt author, I want every chip to open the same dialog, so that there is one place to learn.
17. As a prompt author, I want a Persona chip with the stats filter to render nothing when the persona has no stats, so that the section disappears cleanly with its header.
18. As a help reader, I want the Guide to name the dialog and its rows, so that the help window can answer questions about it.

## Implementation Decisions

- **Container.** A Dialog with the app's standard content shell. One component serves every chip. The pop-out's other faces stay: Re-Pick swaps the body for the drill picker with a Back control, and Edit Value closes the dialog and opens the value. A read-only editor opens the dialog with every control disabled.
- **Groups on Entities and Persona.** Scope (Entities only), the filter, Content, owned Traits and Stats, stat detail, Format, placement. Other chips keep their axes as rows in the same dialog.
- **Pieces as toggle axes.** The filter's two picks, the traits toggle and the three stat detail pieces are toggle axes in the existing registry, encoded as ids in today's dotted variant segment. The grammar gains no new segment syntax. Defaults: filter off, traits on, all three detail pieces on, stats on for Here and In Scene and off for Sub-Locations and Reachable (Q24), so an unchanged token encodes nothing new. The six stored ids are distinct from the Stats chip's `numbers`, `descriptions` and `meaning`, which mean on; the new detail ids mean off.
- **Lock groups.** The registry gains an explicit lock group on a toggle axis. The Stats chip's three pieces and the Entities and Persona Stat Detail pieces each form a group whose last piece on cannot be turned off. Only With, Include and the scope stats toggle belong to no group. Today's rule, which locks the last non-default toggle, goes away with it.
- **Moot pieces.** With Name content the Include and Stat Detail rows are disabled; Only With stays live (Q26). With stats off the Stat Detail row is disabled.
- **Filter semantics.** The filter runs on the roster before rendering. An entity owns stats in force when the scene's owned-stats entry for it is non-empty, and owns traits in force when its owned-traits entry is non-empty. An entity passes when it owns at least one picked kind. The filter ignores the Include toggles. In Scene names with no entity record own nothing and are dropped. On Persona the roster is the one played entity (Q25).
- **Values on demand.** The chip values map becomes a lazy source: a memoized lookup by token key over a scene, instead of a pre-rendered cross-product of every option. Every reader of the map keeps working through that lookup: prompt requests and the user-message templates, the Settings preview pool (live values first, never the sample world's value for an in-game token), Tool templates and the Tool snapshot, Test Bench, the dictionary scan corpus, the stat request merge, the World Editor, and the probe harnesses. This lands first as a prefactor over today's axes with byte-equal request bodies, before any new id exists.
- **Parser.** The parser accepts any dotted combination of ids known to the token's base, in any order. Two ids from one axis, or a repeated id, decode last-wins, as today. A spelling whose ids are valid for another base stops matching and stays text; nothing in a default prompt or bundled world spells one. Old spellings that are valid for their base decode as before (Q7).
- **The chip face.** A filter glyph after the label while a filter pick is on, wrapped in a Tip that reads the picks. The label text does not change, and none of the six new ids joins the label's pick list (Q27).
- **The dialog.** A Dialog with the app's content shell, a `devRoutes` entry and a `surface` id. It opens inside the Settings dialog and the entity editor, so it nests. Per-option help lines from the registry become the control's tooltip; no field goes dead. On narrow screens the two panes stack, controls above the pane.
- **The right pane.** Prompt chips only (Q29). It renders the chip's value through the same renderers the prompt uses: in a game, the live scene the Preview tab reads; in the World Editor, the authored chip scene; in Settings outside a world, the sample scene the Settings preview uses. Settings receives a scene or a render function for this, not a values map. It never ships its own fixture data (Q22). Hover highlighting maps each control to the lines it produces. A stat detail piece maps to the span of its own text inside the stat line, which needs the renderer to report line and span origins, not a parse of the rendered string. Every control has a defined highlight, including "none" for Scope and Format.
- **Docs and help.** The Guide pages that describe the pop-out, the Stats checkbox and Persona content update to the dialog and its rows. In-app copy that says "pop-out" changes too. The glossary gains Chip Options, covering prompt and placeholder chips, and its Chip Values entry drops "a value for every token the registry defines". The Design System gains a section for the dialog and the live-sample pane once the user approves the pattern, with a showcase entry. The unreleased changelog entry that names the Stats checkbox is folded, not joined.
- **Export-adjacent.** The token grammar lives in saved presets, world prompt overrides and bundled worlds. Nothing old stops parsing, and no file is rewritten on load. A world or preset saved with the new ids and opened in 3.0.1 keeps them as literal text, so the raw token reaches the AI there. Accepted; the release notes carry it.

## Testing Decisions

- Tests exercise external behavior: a token in, a rendered value out; a selection in, a token out.
- **Vocabulary**: decode and encode of the new ids, old spellings, and round trips, beside the existing prompt variable tests.
- **Rendering**: the roster renderer with the filter, traits off, each stat detail combination, each scope, each format; the Persona miss case. Beside the existing location context and persona context tests.
- **Values**: every token in a prompt renders, including combinations never seen in a default prompt. The prefactor proves byte-equal request bodies against recorded history, as the earlier prefactor did. An in-game Preview of a novel token shows live data, not the sample world's.
- **Dialog**: open, change each row, read the token; disabled rows under Name content and stats off; the Re-Pick face; the read-only state. Beside the existing VariableNode tests.
- **Hover map**: for a known scene, each control's lines and spans. A changed renderer that breaks the map must fail a test.
- No probe. Default prompts are byte-identical.

## Out of Scope

- The stat pass reading the Entities and Persona chips, and any prompt default change that comes with it.
- Filters that name a particular stat or trait, or compare a stat's value.
- Filters on Location or other chips.
- Wiring real data into the prototype.
- The in-game Preview showing the live scene's enabled lore for the Dictionary chip (Q37).

## Further Notes

- Prototype: branch `prototype/chip-options`, launch entry `proto-chip-options` on 5253, `?variant=F`. Variants B, D and E remain on the branch for the record. The prototype holds its new pieces in memory and uses a fixture cast, which the real build must not (Q22).
- Row names are settled (Q23): Only With, Include, Stat Detail.
