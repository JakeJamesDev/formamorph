# Spec: Live Scene Pin Lag

Status: in-progress

## Problem Statement

A Start or Before stat write can move a pin on an entity's **name** or **Stranger Name** (a stat band's Placeholder Pins). The turn's requests read the new name one turn late.

- **Repro.** Sunmeadow Town, day one disguised: Zoroark's hidden Illusion stat is set at Start timing. Its band pins her name and Stranger Name to "A Familiar Face". The opening narrator request still names her "Zoroark" and labels her "The Fox of the Woods". Her Today line in the same request already reads the disguise.
- **Cause.** `liveChipScene` re-resolves each entity's texts under the before box's pins (`resolveEntityTexts`). It starts from `sources.allEntities`, which `useResolvedWorld` already resolved under the live pins. Names are resolved at the source, so `name` and `aliases` never re-resolve, and `strangerName` holds no placeholder by then. The stranger label map (`strangerLabels`) is built from those live names too.
- **Scope.** Every world whose Start or Before code moves a pinned name. Descriptions, summaries and pronouns already follow the box.

## Solution

- The before box (`SceneWrites`) carries the cast resolved under its own pins, the same way it already carries the stats resolved under them. `turnCodeView` builds it with the pipeline the live cast uses, so live and box names cannot resolve differently.
- The box also carries the stranger labels read from that cast.
- `liveChipScene` reads the box's cast and labels over the live ones. A runtime character keeps its live entry: its name never carries a placeholder.

## Rulings

- **Q1.** App fix, not a world workaround. Sunmeadow keeps its day-one roll at Start timing. (User, via the sunmeadow-new-faces spec session.)

## Out of scope

- The persona's own name under a box write. The bug report names the cast only.
- Turn code that reads names outside the Chip Scene (prose matching, the stat pass's owner list). It keeps the live cast; a lag there is its own report.

## Tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | [Box Cast Names](issues/01-box-cast-names.md) | None |
