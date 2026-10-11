# 06: Entity Stats in the Stat Panel

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: UI on the GamePanels harness; the one subtle part is lifting the entity view's selection so two places share it.

Parent: [Entity Stats spec](../spec.md)

## What to build

In game, the stat panel shows the player's stats on top and the selected entity's stats below. A dropdown at the top of the panel picks the entity. It shares one selection with the entity view, both ways. It lists present entities, then the rest, then (None), which hides the section. An entity whose name the scene hasn't revealed shows by its player description. Hidden stats never show. Rulings Q5, Q13.

## Acceptance criteria

- [ ] The player's stats show first; the selected entity's visible stats show in a section below, with the same stat rows.
- [ ] The dropdown and the entity view share one selection; a pick in either updates both.
- [ ] The dropdown lists present entities first, then absent entities with stats, then (None).
- [ ] (None) hides the entity section.
- [ ] An unrevealed entity is listed by its player description, never its name.
- [ ] A hidden or switched-off entity stat never shows.
- [ ] The panel follows the design system; a new visual pattern gets the user's approval first.
- [ ] Verified in the preview on a realistic viewport, both themes.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
