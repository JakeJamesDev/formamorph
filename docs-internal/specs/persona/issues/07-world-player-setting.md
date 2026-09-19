# 07: World Player Setting

Status: ready-for-human
Base: 4139c508
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Persona](../spec.md)

**What to build:** The world overview gains one setting with the values Open, Fixed, and Cast, edited in the World Editor. Open allows any persona. Fixed preselects None and keeps Quick Start at None, and the player can still pick. Cast limits every picker to the world's own personas and preselects the first.

**Rationale for the model:** one setting, one editor control, and an extension of pure preselect rules that already exist. A mid-tier model at medium effort fits.

## Acceptance criteria

- [ ] An absent value means Open, so every existing world behaves as before.
- [ ] The World Editor shows the setting as a value control, not tabs, with help copy in the UI help copy pattern. It is an Advanced control, and a value other than Open counts as Advanced data for the notice beside the mode switch.
- [ ] Fixed: None is preselected and Quick Start uses None, unless the player made a pick in that world before.
- [ ] Cast: the enter-world picker and the in-game picker list only the world's personas, offer no None, and preselect the first. A Cast world with no marked entity behaves as Fixed.
- [ ] Pure tests cover all three values for the step, for Quick Start, and for the in-game picker, together with the remembered pick and the global default.
- [ ] The Persona category stays hidden when the setting and the available personas leave nothing to pick.
- [ ] The response states the export-shape change: one additive field on the world overview.
- [ ] The control is checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

The player's remembered pick wins over Fixed on purpose: the setting guides and does not block.
