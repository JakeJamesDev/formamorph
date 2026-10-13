# 10: Review Fold-In

Status: done
Blocked by: 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: small, named fixes across known files, plus tests the spec's Testing Decisions already call for.

Parent: [Chip Options spec](../spec.md)

## What to build

The second review's findings, folded in as one unit.

Should-fix:

- The Image Tag Prompt field in Settings hands Chip Options the preview values it already has, so the Subject chip's pane renders instead of opening empty.
- The help surface map routes the dialog to the Guide's Chip Options section, not the chip editor section.
- The Stats chip's Range, Descriptor and Description tooltips use the Entities and Persona wording, verb-first, so the same three pieces read the same on every chip.

Nits:

- Registry help strings that now show as tooltips follow the Writing Guide (copy-sweep the registry).
- The Name-content tip is per chip, or reworded, since Persona Name also sends pronouns.
- Hovering a control whose output is absent in the scene dims nothing.
- The Prompts Guide page's row table gains a Mode row for single-axis chips.
- Switching scope drops a stats id that means nothing in the new scope.
- Comments that still say "pop-out" say Chip Options: the prompt variable registry, the chip vocabulary, the token chip, the drill picker, the placeholder field, the editable chip, the chip, world search and the history field.

Tests:

- The lore exception (Q37): an in-game Preview of a Dictionary chip reads the sample lore.
- Host wiring: Settings, the World Editor and the game each hand Chip Options the scene the spec names (Q22), as one test per host or a sweep over every prompt field.
- A kept rendered-values snapshot beside the token corpus, so the byte-equal proof from ticket 01 stays a test.
- Mobile stacking: the panes stack below the small breakpoint.

Rulings: Q22, Q33, Q37.

## Acceptance criteria

- [ ] The Subject chip in Image Tag Prompt opens Chip Options with a rendered pane.
- [ ] The help window's Take Me There for Chip Options lands on the Chip Options section.
- [ ] The Stats chip's three piece tooltips match the Entities chip's.
- [ ] No source comment says "pop-out" for a chip.
- [ ] The four tests above exist and bite when their behavior is reverted.
