# Spec: Preset Options

Status: ready-for-agent
Spec session: preset-options — spec

## Problem Statement

A world can offer many setup choices: World Options, root traits, entity-owned traits, a persona and a Starting Location. An author often means a few of these choices to go together. Examples are a "Default start", or a "Hardcore start" that picks very hard traits. Today the player has to find and click each value by hand.

The order of clicks also causes trouble. Say Elf is picked, and Elf blocks Evil. The player wants Orc and Evil. Evil is locked until they swap Elf for Orc, so the target setup is valid, but the path to it is not. A one-click bundle that applied its values one at a time would hit the same wall.

## Solution

A fourth World Option type, **Preset**, beside choice, boolean and number. A Preset Option is a choice, such as "Difficulty", whose values (Default, Hardcore) each carry a list of rows. Clicking a value sets every value its rows name, all at once. The setup then settles against the full target state, so click order never matters.

A Preset Option stores nothing. No gate, pin or script can read it, so it can never gate anything. Its radio shows the value whose result matches the current setup. When the setup matches none of its values, no radio is selected.

## Rulings

- **Q1 Targets.** A Preset sets World Option values and trait picks.
- **Q2, Q17 Snapshot or overlay.** Each Preset Option is either a snapshot or an overlay, and every value in it behaves the same way. A snapshot resets unlisted values to the world's defaults first. An overlay keeps the player's other values.
- **Q3 Shown only.** Rows can set shown Options only, never hidden ones.
- **Q4, Q11 Selected value.** A value's radio is selected while the current setup matches that value's settled result. For a snapshot, the whole result must match. For an overlay, only its listed values must hold. Two Preset Options can each show a selected value at once. This state is derived, never stored.
- **Q5 Owned traits.** Rows can pick entity-owned traits as well as root traits.
- **Q6 Other sections.** Rows can also set the Starting Location and the Persona. Library Additions stay out.
- **Q7 Conflicts.** The Preset builds the full target draft and settles it once. Its values count as the latest picks, so it wins every conflict. Unlisted picks that fail go to the cascade-off list.
- **Q8 Bad Preset.** If a Preset's own value fails in its own target state, setup skips that value and names it in the notice. The editor flags that Preset value.
- **Q9 Snapshot reach.** A snapshot resets Options and traits only. Persona and Starting Location stay as they are unless a row names them.
- **Q10 Persona.** A row can name only a persona that the world authors.
- **Q12 Term.** The glossary term is **Preset**.
- **Q13 Option type.** Preset is a World Option type. It stores no value, and no gate, pin or script can read it.
- **Q14 Fields.** Each Preset value has a name, a description and its rows.
- **Q15 Authoring.** Each Preset value holds its rows on the Options tab, in the same place where choice values hold their pins. A row is one target and its value.
- **Q16 Quick Start.** Quick Start stays on the author's defaults. Presets do not change it.
- **Q18 Notice.** After a Preset applies, the player sees a short notice of what changed in other categories. It extends the existing cascade notice.
- **Q19 Trait rows.** A trait row turns a trait on or off.
- **Q20 Setup only.** Preset Options appear on the setup screen only, never in game.
- **Q21 Empty value.** A Preset value with no rows never matches, in either mode. The same applies to a value whose rows are all skipped as stale (Q24).
- **Q22 New Preset.** A new Preset Option, or an Option switched to Preset, starts in snapshot mode with two values, "Value 1" and "Value 2". The values have no rows and empty descriptions.
- **Q23 Option description.** A Preset Option keeps `playerDescription`, shown under its name on the setup screen, the same as for other types.
- **Q24 Stale rows at apply.** Apply skips a row whose target was deleted, is now hidden, is itself a Preset, or no longer accepts the value. The skipped row is listed in the notice result.
- **Q25 Row shape.** The row union is `option` (optionId, value), `trait` (traitId, optional ownerId, on), `location` (locationId) and `persona` (entityId). An absent ownerId means a root trait. Otherwise ownerId is the authored entity id. There is no "you" owner.

## User Stories

1. As a player, I want to click one Preset value, so that a whole start is set up in one click.
2. As a player, I want a Preset to apply even when my current picks block its values, so that click order never locks me out.
3. As a player, I want to read each Preset value's description before I click, so that I know what it changes.
4. As a player, I want the selected radio to show which Preset value my setup matches, so that I know which start I am on.
5. As a player, I want the radio to clear when I change a value the Preset set, so that I can see that I left that start.
6. As a player, I want to adjust picks after I apply a Preset, so that I can make a start my own.
7. As a player, I want a notice of what a Preset changed in other categories, so that changes I cannot see do not surprise me.
8. As a player, I want the notice to name any Preset value that could not apply, so that I know the result differs from the description.
9. As a player, I want an overlay Preset to keep my unrelated picks, so that I can stack a Difficulty on top of my own setup.
10. As a player, I want a snapshot Preset to reset the setup to its listed values, so that I get the same start every time.
11. As a player, I want a snapshot to keep my persona and Starting Location unless it names them, so that my identity stays mine.
12. As a player, I want a Preset to choose my Starting Location when the start needs one, so that a Hardcore start can begin somewhere harsh.
13. As a player, I want a Preset to choose a world persona when the start needs one, so that a start can put me in a set role.
14. As a player, I want two Preset Options, such as Difficulty and Body, to show their selected values at the same time, so that each reads on its own.
15. As a player, I want Quick Start to keep using the world's defaults, so that it stays the fastest way in.
16. As a player, I want no Preset Option in the in-game World Options view, so that the game shows only things that still matter.
17. As an author, I want to add a Preset Option on the Options tab, so that it sits with the setup choices it controls.
18. As an author, I want to choose snapshot or overlay for each Preset Option, so that I decide how it treats the player's other picks.
19. As an author, I want to give each Preset value a name and a description, so that the player knows what each start is.
20. As an author, I want to add rows to a Preset value, each one a target and its value, so that I list what the start sets.
21. As an author, I want a row to set a shown World Option to a value, so that a start can set Options.
22. As an author, I want a row to turn a root or entity-owned trait on or off, so that a start can set traits and remove ones like Easy Mode.
23. As an author, I want a row to set the Starting Location, so that a start can place the player.
24. As an author, I want a row to set a world persona, so that a start can choose the role.
25. As an author, I want hidden Options left out of the row targets, so that a Preset can never set gate state.
26. As an author, I want the editor to flag a Preset value whose own rows fail in its target state, so that I find a broken start before players do.
27. As an author, I want the editor to flag rows that name a deleted trait, Option, location or persona, so that stale rows do not go unnoticed.
28. As an author, I want Preset Options left out of Requirement Rows, pins and scripts, so that I cannot gate on a Preset by mistake.
29. As an author, I want Preset Options to reorder with my other Options, so that I control where they show on the setup screen.
30. As an author, I want to change an Option to or from the Preset type the same way I change other types, so that authoring stays consistent.

## Implementation Decisions

- **World shape.** `WorldOptionType` gains `preset`. A Preset Option carries `mode: 'snapshot' | 'overlay'` and a list of values. Each value has `id`, `name`, `description` and `rows`. A row is a union with one target and its value:
  - Option row: an Option id and a value.
  - Trait row: a trait ref, root or owned, and on or off.
  - Location row: a location id.
  - Persona row: a world persona ref.
  It has no default, no `shownToPlayer` and no mid-game flag. A Preset is always shown at setup and never in game. **This is an additive change to the world export shape.**
- **Save shape.** No change. A Preset stores no value in `worldOptionValues`.
- **Apply.** A new pure function in the entry draft module takes the draft, the world, a Preset Option and a value id. It returns the new draft and a notice.
  - Build the target. For a snapshot, start from the defaults for Options and traits, and keep the current persona and location. For an overlay, start from the current draft.
  - Overlay the rows. Rows on a max-1 group swap the pick as a click does.
  - Settle once through the existing fixpoint, with the Preset's trait picks ordered as the latest picks. This makes them win Not conflicts. Then run the existing short-group fill.
  - Read back each row. A row that did not hold is a skipped value for the notice.
- **Match.** A new pure function returns the value id that a draft matches, or null. Each value's result is computed by applying it to the current draft. For a snapshot, the comparison covers Options and traits, plus persona and location when rows name them. For an overlay, it covers the listed values only. If more than one value matches, the first in authored order is selected.
- **Exclusion from references.** Preset Options are left out of every reader in the World Options module and its callers:
  - the World Option Condition picker and gate evaluation
  - placeholder pin lists
  - script option reads and writes, where a write to a Preset id is refused like an unknown id
  - the mid-game Options list
  - value validation (`acceptsValue` rejects any value)
- **Setup screen.** The World Options category renders a Preset Option as a radio group with each value's description. A click calls apply and puts the result through the same draft update as other changes. The selected radio comes from match. The notice extends the existing cascade notice with a "Set by <Preset value>" section and any skipped values.
- **Editor.** The Options tab type switch gains Preset. Its panel has a snapshot/overlay control and a value list. Each value has a name, a description and a row editor. The row editor offers shown Options, root and owned traits, locations and world personas as targets.
- **Preset check.** A new pure check reports, for each Preset value, the rows that fail in that value's own target state. For the snapshot target it uses the defaults. For the overlay target it uses the defaults plus the rows. It also reports rows whose target no longer exists. The Options tab shows its results as a warning on the value.
- **Glossary.** Add **Preset** to CONTEXT.md as a World Option type. Note that it stores no value and that no gate, pin or script reads it.

## Testing Decisions

- A good test drives the public seam with a real world fixture and the real settle, and asserts what the player or author would see. It does not mock settle.
- **Apply and match (main seam).** This seam holds most cases:
  - The Elf/Orc/Evil case applies from the blocked state.
  - The Preset wins a Not conflict against an unlisted pick, and that pick moves to cascade-off.
  - A snapshot resets unlisted Options and traits, and keeps persona and location.
  - An overlay keeps unlisted picks.
  - A trait-off row works.
  - A max-1 swap works.
  - A short group is filled.
  - A failing row is reported as skipped.
  - Match lights the right value, clears after a change, returns null for no match, and handles the snapshot and overlay rules.
  - Prior art: `entryDraft.test.ts` and `traitGates.option.test.ts`.
- **Setup screen.** In `EnterWorldFlow.test.tsx` style, render a world that has a Preset Option. Click a value, then assert the selected radio, the picked traits in another category and the notice text.
- **World Options module.** Assert that a Preset Option is absent from the condition picker's source, the pin lists, the mid-game list and script read/write. Prior art: `worldOptions.test.ts` and `GameViewer.worldOptions.test.tsx`.
- **Preset check.** Cover a self-contradicting value, an over-full group, an Automatic or pinned trait row, and rows with deleted targets. Each guard must fail when its check is removed.

## Out of Scope

- Library Additions as row targets.
- Hidden Options as row targets.
- Player-library personas as row targets.
- Any stored or in-game record of the Preset that was applied.
- Gating a Preset Option or its values.
- A "capture current setup" authoring shortcut.
- Quick Start changes.

## Further Notes

- The existing setup already settles every change against the whole selection, through a least fixpoint with cascade-off and short-group fill. Apply reuses that path. It does not add a second resolver.
- A Preset row for a trait whose Mode stops the player toggling it, such as Automatic, cannot apply. The Preset check flags it.
- Bundled worlds that fake starts with trait groups are candidates to move to Presets later. That work is not part of this spec.
