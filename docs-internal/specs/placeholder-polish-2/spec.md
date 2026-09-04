# Placeholder Polish 2 — Owner Names, Owner Headings, Preview, Shared Pickers

Status: done
Grilled 2026-09-02. Builds on `.scratch/placeholder-scopes/spec.md` (owners, groups, pins) and
`.scratch/placeholder-ux-polish/spec.md`.

## Problem Statement

After scoped placeholders and folders landed, the placeholder surfaces read like code, not prose.

- The palette bar spends its first slot on the word "Placeholders". The chips are what the author
  came for.
- An owned placeholder displays as `Keeper.Mood`. The dot was a stand-in for a symbol the author
  could not type. It reads as a code operator in a prose tool.
- The Roll button in the placeholder editor sounds like it commits values. It only draws a sample.
- An owner heading in the bar is raw text, so an owner named with a placeholder reads
  `Keeper {Keeper}`, and it carries no icon. Chips under it repeat the owner name in full.
- The Placeholders tab shows an entity icon or a book icon on owner nodes. No other surface does,
  so the author loses that cue in the bar, the pickers, and the Pins dropdown.
- The Pins dropdown and the find bar's placeholder picker are flat lists with no folders, no
  owners, and no icons. The find bar picker also cannot be wheel-scrolled inside the editor dialog.

## Solution

One vocabulary produces sectioned rows for every placeholder-choosing surface. Every surface
renders folders as quiet text headings and owners as quiet text carrying the owner's icon and the
owner's name, with a placeholder inside that name drawn as a neutral pill. Under an owner heading, a
placeholder
shows its bare name. Away from its owner it shows `Keeper › Mood`, the same `›` the app already
uses for folder paths. The bar's toggle is a chevron. The sample button says Preview. The Pins
dropdown and the find bar picker share one sectioned list, and the find bar picker scrolls.

## User Stories

1. As an author, I want the palette bar to open with chips in its first slot, so that the bar
   spends its width on placeholders and not on a label.
2. As an author, I want a chevron with a tooltip as the bar's toggle, so that I still know what the
   bar is without reading a word.
3. As an author, I want the collapsed bar to read "Placeholders (N)", so that a closed bar still
   tells me what it hides and how much.
4. As an author, I want an owned placeholder to read `Keeper › Mood` away from its owner, so that
   nesting looks like nesting everywhere and never like code.
5. As an author, I want the same `›` for folder paths and owner paths, so that I learn one symbol.
6. As an author, I want a placeholder inside its own owner's fields to read `Mood`, so that the
   owner's own text stays short.
7. As an author, I want chip search to accept a typed `.`, space, or `>` where the label has `›`,
   so that I can find `Keeper › Mood` without typing a symbol my keyboard lacks.
8. As an author, I want pasting `›` to still match, so that copied labels work as search text.
9. As an author, I want the sample button to read Preview, so that I know it commits nothing.
10. As an author, I want the Preview tooltip and the sample's accessible name to agree with the
    button, so that a screen reader and a hover say the same thing.
11. As an author, I want the field-level Reroll and the Test Bench Reroll to keep their names, so
    that the controls that redraw session-length preview rolls stay distinct from a throwaway sample.
12. As an author, I want an owner heading in the bar to stay quiet text and wear no chip of its
    own, so that a heading never looks like something I can place.
13. As an author, I want an owner named with a placeholder to show that placeholder as a pill in
    the heading, in a neutral tint rather than its own accent, so that the heading reads as the
    owner's name without offering a chip to place.
14. As an author, I want a folder heading to stay quiet text, so that folders and owners look
    different at a glance.
15. As an author, I want the owner heading to carry the entity icon or the book icon, so that I
    know which kind of owner it is without opening it, and so that an owner and a folder read
    differently at a glance.
16. As an author, I want chips under an owner heading to show only their bare name, so that the
    bar does not repeat the owner name once per chip.
17. As an author, I want chips inside my text to keep the full `Keeper › Mood`, so that a chip
    with no heading above it stays unambiguous.
18. As an author, I want the `{` typeahead and the drill picker to show the same owner heading
    chips with icons, so that every picker matches the bar.
19. As an author, I want the Pins dropdown sectioned by folder and owner, so that I can find a pin
    target in a large world.
20. As an author, I want the Pins dropdown's closed trigger to show the full path with the owner
    icon, so that a chosen target stays clear after the list closes.
21. As an author, I want the find bar's placeholder picker sectioned the same way, so that
    replacing text with a chip uses the same list I see everywhere else.
22. As an author, I want the find bar picker's trigger to show the full path with the owner icon,
    so that I can confirm the replacement target before I press Replace.
23. As an author, I want the find bar picker to wheel-scroll inside the editor dialog, so that a
    long list is reachable with the mouse.
24. As an author, I want the find bar's Create row to stay, so that I can still mint a placeholder
    from the search text.
25. As an author, I want the owner heading to be static, so that the bar's click targets stay
    exactly the chips.
26. As an author, I want tooltips, the Preview sample spans, pin summaries, and search results to
    use the new separator, so that no surface still shows a dot.
27. As an author, I want a world saved before this change to open unchanged, so that a display
    rule never touches my file.

## Implementation Decisions

### Vocabulary rows are the one source

- The placeholder vocabulary's palette row builder is the single seam. Every sectioned surface
  (palette bar, `{` typeahead, drill picker, Pins dropdown, find bar picker) renders its rows and
  nothing else.
- A heading row gains a kind: `folder` or `owner`. An owner heading carries the owner kind
  (`entity` or `book`) and the owner's name as chip-bearing text, never a pre-flattened string.
- Rows under an owner heading carry the bare placeholder name as their label. Rows elsewhere carry
  the full path.
- The owner name separator constant becomes `›`. Nothing else reads it directly. Display-name
  helpers, chip path names, sample span names, pin summaries, tooltips, and plain-text search
  labels all follow through the constant.
- Chip search and the typeahead normalize `.`, space, and `>` in the query to the separator before
  matching. The separator itself still matches.

### Palette bar

- The toggle is a chevron button whose accessible name and tooltip are "Placeholders". Open, it
  shows no text. Collapsed, it shows "Placeholders (N)" as today.
- Owner headings render as quiet muted text with the owner icon, and the owner name rendered
  through the chip text renderer so an embedded placeholder shows as a pill inline. No surface, no
  border: a heading is not placeable, and one shaped like a chip invites a click that does nothing.
- That embedded pill is neutral, not the placeholder's accent, for the same reason.
- Folder headings stay muted text. The icon is what tells a folder heading from an owner's.
- The heading has no hover state and no click handler.

### Pickers

- The `{` typeahead and the drill picker render owner headings with the same quiet text and icon.
- A new shared sectioned list component renders vocabulary rows for popover-style pickers: folder
  text headings, owner headings, bare names under owners, full paths elsewhere. It takes the
  rows, a selected id, and an onSelect. It sets `portal={false}` on its popover so it lives inside
  the editor dialog's scroll lock.
- The Pins dropdown moves from Radix Select to the shared list. Its trigger shows the full path
  with the owner icon.
- The find bar picker moves to the shared list. Its trigger shows the full path with the owner
  icon. The Create row stays below the rows. The picker gains `portal={false}`.

### Preview

- The placeholder editor's sample button reads "Preview". Tooltip: "Preview a sample of this
  placeholder". The sample's accessible name: "Sample preview".
- The field-level Reroll and the Test Bench opening Reroll are unchanged.

### Icons

- Entity owners use the existing `User` icon. Book owners use the existing `BookOpen` icon.
- Icons appear on: bar owner headings, typeahead and drill picker owner headings, Pins
  dropdown rows and trigger, find bar picker rows and trigger. Not on chips inside text.

### Data

- No world or save shape change. Owner names, separators, and headings are display only.

## Testing Decisions

A good test drives the surface the author uses and asserts what the author sees: heading text,
chip labels, icons by accessible name, trigger text, and scroll reach. Never the row shape, never
the constant's value by import.

- Vocabulary rows: extend the existing vocabulary tests. Cases: owner heading carries kind and
  owner kind; rows under an owner carry the bare name; rows elsewhere carry `Owner › Name`; a
  folder heading stays a folder; search matches `keeper.mood`, `keeper mood`, `keeper>mood`, and
  `keeper › mood`.
- Shared section list: one render test. A folder heading renders as text. An owner heading renders
  quiet text with the owner icon and a neutral pill for an owner named with a placeholder. Selecting a
  row fires onSelect with the id. Popover content mounts inside the dialog subtree, not the body.
- Palette bar: existing test updated. The toggle is found by accessible name "Placeholders" with
  no visible text open; collapsed shows the count. Heading and chip reading flips to the new labels.
- Typeahead and drill picker: existing heading tests updated for the owner heading and icon.
- Pins dropdown and find bar: one thin mount test each, proving the trigger text and that the
  shared list receives the world's rows. The find bar currently has no test; this adds its first.
- Preview: the existing sample-roll suite renames its helper and asserts the new button, tooltip,
  and status name. The persists-nothing assertion stays.
- Prior art: `chipVocabulary.test.ts` sectioning cases, `PlaceholderPaletteBar.test.tsx` strip
  readings, `ChipTypeahead.test.tsx` heading cases, `PlaceholderManager.test.tsx` sample roll
  suite, `PlaceholderPinRows` mounts in `TraitManager` tests.
- Gate: typecheck, lint, test, build green per ticket. `graphify update .` after each.

## Out of Scope

- Renaming the field-level Reroll or the Test Bench Reroll.
- A filter box inside the Pins dropdown or the find bar picker.
- Icons on chips inside text.
- A click action on the owner heading.
- Any world or save migration.
- The stale-highlight issue noted in the editor search spec.

## Further Notes

- The `›` separator is the folder path separator already. One symbol for every nesting is the
  point; do not introduce a second glyph.
- The find bar picker's wheel bug is the documented dialog scroll-lock case. `portal={false}` is
  the repo's fix on every other editor popover. Do not reach for a ScrollArea.
- Changelog: one 👤 In-Progress entry per ticket, bold lead standing alone.
