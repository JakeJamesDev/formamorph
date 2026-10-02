# 03: Template Slots on the Breadcrumb Picker

Status: ready-for-human
Base: c4162ead
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

In the **Code Templates** dialog, the stat, plain trait and entity slots open a Breadcrumb Picker from a Select-style trigger (Q9). The trigger shows the picked name, or the slot's "Pick a …" prompt.

- `stat`: the world's stats minus the stat being edited, no breadcrumb.
- `trait` (untied): world traits only, in Traits-tab tree order, with a breadcrumb from world trait groups. An ungrouped trait shows `World` (Q1).
- `entity`: keyed entities in Entities-tab order, with a breadcrumb from Entity folders (Q4).
- Extend the editor-side entity name builder so it carries each entity's folder path. The template dialog and the code completions keep reading one source.
- The template editor's Preview tab uses the same pickers. Daypart and choice slots keep the plain Select.
- Picking an entity still clears its tied trait slots. `trait(persona)`, `trait(entity)` and `placeholder` keep their current lists until tickets 04 and 05.

## Acceptance criteria

- [x] The Code Templates dialog test opens each of the three slots, reads rows and breadcrumbs, picks one, and checks the generated code.
- [x] The plain trait slot never lists an entity-owned trait. The guard bites: let owned traits in and the test fails.
- [x] A search by a group name narrows the trait list to that group's rows.
- [x] Mobile: the picker fits the dialog and stays usable (verify-ui frame).
- [x] The four gates are green.
