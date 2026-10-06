# UI Consistency

Status: needs-triage
Status note: Opened 2026-10-06 from the user's notes. Each item needs a grill before tickets. The user names the canon where it is unclear.

## Problem Statement

The same element looks or acts differently on different surfaces. Some surfaces also show visual glitches on first load.

## Items

| # | Item | Open question for the grill |
| --- | --- | --- |
| 1 | **Element icons match everywhere.** Traits, entities and the other element kinds show one icon on every surface. | Which icon is canon for each element kind? |
| 2 | **Hover and selected states differ.** The side panel layouts use several colors and styles for hover and selected. Hover and selected must not share a color. | What is the canon hover style and the canon selected style? |
| 3 | **Flicker on first load.** A window flickers the first time it loads and an element highlights or a tooltip shows. | Investigate the cause; no canon question. |
| 4 | **Popup close button outline.** The X button on popups has an outer border and focuses that border when the popup opens. Remove the border and the focus on open. | Where does initial focus go instead? |
| 5 | **List item remove button.** List items have an X button. | Should it be an icon button that turns destructive red on hover? |

## Rulings

- **Q1 Trait icon:** `ToggleRight` everywhere. `Sparkles` stays on the built-in placeholder mark and AI actions.
- **Q2 Entity icon:** `User` for one entity. `Users` only where a tab or heading lists many entities.
- **Q3 Stat icon:** `ChartColumn` everywhere.
- **Q4 World icon:** `Earth` everywhere, as in `KIND_ICONS`.
- **Q5 Blueprint icon:** `LayoutTemplate` everywhere, chips included. `Link2` means a linked copy only.
- **Q6 Persona icon:** `CircleUserRound`, so a persona never reads as an entity.
- **Q7 Nav rail states:** hover is `bg-accent`. Selected is `bg-primary` with `text-primary-foreground`, `font-medium` and the primary bar, the same fill as `EditorRow`. This replaces the Design System's Nav Rail state rule. A `bg-primary/10` tint was picked first and reopened: renders showed it matches today in the default graphite theme and leaves pale text in blue light (option C in `_coloraudit/nav-rail-options.png`). Stat Code Templates need a new icon, because Q5 gives `LayoutTemplate` to Blueprints.
- **Q8 One side-navigation recipe:** the mobile Sections bar and the Enter World categories take the Q7 states.

Items 1 and 2 are audited in [audit.md](audit.md). Item 3 is parked: Playwright frame sampling did not reproduce it.

## Related

- The Mascot overlay list drag fix (d9f715d0) made those lists match the World Editor drag pattern.
