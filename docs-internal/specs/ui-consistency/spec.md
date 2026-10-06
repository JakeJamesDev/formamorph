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
- **Q7 Nav rail states:** hover is `bg-accent`. Selected is `bg-primary` with `text-primary-foreground`, `font-medium`, the same fill as `EditorRow`. The side bar stays and takes `bg-foreground`, so it reads against the fill in every theme. This replaces the Design System's Nav Rail state rule. A `bg-primary/10` tint was picked first and reopened: renders showed it matches today in the default graphite theme and leaves pale text in blue light (option C in `_coloraudit/nav-rail-options.png`). Stat Code Templates need a new icon, because Q5 gives `LayoutTemplate` to Blueprints.
- **Q8 One side-navigation recipe:** the mobile Sections bar and the Enter World categories take the Q7 states, without the side bar: the mobile list does not select from its left edge.
- **Q9 Dialog close button:** focus still lands on the X when a dialog opens, with no ring. The ring shows for keyboard focus only (`focus-visible:` in place of `focus:` at `src/components/ui/dialog.tsx:82`), so a dialog opened from the keyboard still shows where focus is.
- **Q11 Flat selection lists:** the Settings Tools list and the Code Template library take the Q7 states (no side bar).
- **Q12 Chat choice bubbles:** hover takes a solid border, `bg-primary/25` and the foreground text color; only the staged choice (`data-selected`) takes the full primary fill. Keyboard focus follows hover, plus its ring, so focus never reads as staged. Rendered in `_coloraudit/chat-choices-before-after.png`.
- **Q13 Canvas search results:** unchanged. The highlighted row is the arrow-key target, not a lasting selection, so it matches hover on purpose.
- **Q10 List-row X:** the X on a list row is an icon button that turns destructive red on hover, because it deletes.

Items 1 and 2 are audited in [audit.md](audit.md). Item 3 is parked: Playwright frame sampling did not reproduce it.

## Related

- The Mascot overlay list drag fix (d9f715d0) made those lists match the World Editor drag pattern.
