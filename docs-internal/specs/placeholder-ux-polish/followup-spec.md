# Placeholder UX Polish — Follow-up Spec

Status: done
Status note: (grilled 2026-09-01, five issues, one ticket each under issues/06–10, all shipped 2026-09-01)

Five fixes after the first polish pass shipped in commit 228d734: chip contrast, relative chance
coloring, Object weights, the picker on random-in-effect Variables, and editor labels for placed chips.

## Problem Statement

- A plain-text value chip at 75% is unreadable. The ramp mixes background and text toward primary at
  the same rate, and both land on mid-gray.
- Color shows absolute chance. Four even values read as four half-tone chips, and nothing says which
  value is favored.
- A reference chip at 0% keeps its lightness and only loses saturation. It never reads as benched.
- The editable Object panel still offers a weight pop-out, a box stepper and the eye. An Object applies
  every value, so none of them can change anything. The shared-row branch already hides the pop-out.
- A one-value placeholder whose value nests wildcards (Tavern Name) is a Variable by count. Its chip
  shows no World | Unique picker, so every placement resolves to the same name. The resolver already
  supports a Unique outer chip, only the picker gate blocks it.
- An entity or location whose name is a placeholder chip shows the first three values in its row, the
  canvas and every dropdown. Two entities on the same Unique placeholder are visually identical, and a
  long composed name is a 300-character dropdown line.

## Decisions

### Chip coloring (issues 1 and 2)

| Point | Decision |
|---|---|
| Formula | Relative to the highest sibling: `rel = chance / maxChance` over the values of one placeholder. Benched values (weight 0) are excluded from the max. An even split gives every chip 100. |
| Plain chip at full | The ordinary secondary chip. Nothing changes for an even wildcard. |
| Plain chip below full | Mixes in OKLab toward a **benched look**: muted background, muted-foreground text, reduced opacity. Opacity is the visible cue, since muted and secondary share one background in the shipped themes. |
| Reference chip 1–100 | Identity hue, saturation scaled by relative chance (as today). |
| Reference chip at 0 | Snaps to the same benched look as a plain chip. At 0% a chip is a chip, kind no longer shows. |
| Percent suffix | Stays the real effective chance. Color answers "which is favored", the number answers "how likely". |

### Objects (issue 3)

The editable Object panel hides the weight pop-out (chip path), the box stepper (multiline path) and the
eye. Roll stays: an Object that nests wildcards still gives a useful sample.

### Random-in-effect Variables (issue 4)

- The World | Unique picker shows when the placeholder **reaches a wildcard through its values**,
  transitively, not only when it has 2+ values of its own. Unique on Tavern Name gives each placement
  its own tavern through the existing `chipCtx` chain.
- A plain Object with no nested wildcard loses the picker it shows today. It never draws.
- The noun stays **Variable**. The ⓘ text and the state line say its one value is a template that rolls
  its chips and picks World or Unique like a Wildcard.

### Placement labels (issue 5)

| Point | Decision |
|---|---|
| Default text | A Unique chip reads `Name (A)`. A World chip reads `Name`. After Z comes AA. |
| Author label | Optional, set in the chip pop-out. Replaces the default text. The input shows only while the chip is Unique. Switching to World keeps the label hidden in the token; switching back restores it. |
| Storage | In the token as an encoded segment. Travels with duplicate, paste, entity cards and dictionary files. No orphans to prune. **Export-shape change** to the token grammar in every string field; older builds render such a chip raw. |
| Letter source | Derived at render from document order: entities in list order, then locations, traits, stats, dictionaries, then placeholder values. Always unique, no gaps, nothing stored. Removing or reordering a placement renumbers the ones after it. The letter is a disambiguator, not an identity. |
| Surfaces | In-field chips in every chip field (names, descriptions, the panel's value fields, reference chips). Tree rows and item lists (the read-only pill). Every plain-text surface: dropdowns, the canvas, modal titles, filenames, library cards, community listings, the bench pickers. Plain text keeps braces: `The {Tavern Name (A)} Inn`. |
| Search | Editor search matches the label, the placeholder name and the values. |
| Tooltip | Placeholder name, mode, then the value list. |
| Deleted placeholder | The red `?` stays and appends the label if set. |
| Preview rolls | Rows never show preview rolls. Reroll leaves row labels alone. |

Two entities sharing a **World** chip are identical in play too. That is an authoring smell for the
deferred linter, not a display problem.

## Out of scope

- Keying World rolls by shared row (the open boundary in `ownership-spec.md`).
- The linter for two entities resolving to one name.
- Chance color on in-text chips. Chance coloring stays panel-only.

## Verification

- `chanceColor.test.ts`: relative formula, both ramps, the benched look at 0 for both kinds, the 75%
  plain chip has readable contrast (background and text are not both mid-gray).
- `PlaceholderManager.test.tsx`: an Object offers no weight pop-out, no stepper, no eye; Roll present.
- `chipVocabulary` test: axis present for a one-value placeholder that nests a wildcard, absent for a
  plain Object.
- `placeholders.test.ts`: token codec round-trips a label; re-mint keeps it; a label with `:`, `}` and
  `>` survives.
- Letter index test: document order, gaps close on removal, World chips get no letter, AA after Z.
- Live: the four screenshots from the grilling session re-taken, plus a light-theme frame of the panel.
