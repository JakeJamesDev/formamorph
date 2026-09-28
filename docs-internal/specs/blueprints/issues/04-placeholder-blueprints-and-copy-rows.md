# 04: Placeholder Blueprints group and copy rows

Status: ready-for-human
Base: 8e1cdf81
Blocked by: 01 — Blueprint shape and module
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: a new system group in the Placeholders tab, a rename of the trait group, a refused move, and a copy row whose value list edits per-value overrides over a live blueprint. The value-list overlay is the tricky part.

Parent: [Blueprints spec](../spec.md)

## What to build

The Traits tab's Templates group is named Blueprints everywhere it shows and is stored under that name. The Placeholders tab gets a matching Blueprints system group from the + menu, at most one, at root, holding world placeholders only. A blueprint placeholder never acts as a World placeholder. Dragging a blueprint out of the group is refused while trait text, blueprint values or copies use it; the inline notice names the uses.

A copy shows under its owner as `Owner.Name`, always the blueprint's name, and cannot be renamed. Its value list is the blueprint's, live. The author rewords one value, changes its weight, removes it, or adds a value of their own; each is an override on that copy. Values the blueprint adds later appear in every copy. Reset per value and Reset to Blueprint on the copy follow ticket 03's pattern. One copy per blueprint per owner.

Creating copies by hand is not this ticket; ticket 05 creates them. This ticket may seed copies in tests through the module from 01.

## Acceptance criteria

- [ ] Both Blueprints groups exist at most once, at root, from the + menu; the trait group's stored name and UI label read Blueprints.
- [ ] A move out of Blueprints is refused with a notice naming each trait, blueprint value and copy that uses it; an unused blueprint moves.
- [ ] A copy row edits text, weight and removal per value and adds own values; a blueprint value added later shows on every copy; a copy's name follows its blueprint.
- [ ] World-transform tests cover the refused move; component tests cover the copy row's overrides and resets.
- [ ] The response names the export-shape changes: the placeholder Blueprints group and the trait group's stored name.
