# 03: Link overrides in the editor

Status: ready-for-human
Base: 8e1cdf81
Blocked by: 01 — Blueprint shape and module
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: the link's Details panel changes meaning from "edit the original" to "edit this link", with a Reset per field, a footer, a stale marker and a new action. Also threads the effective link into the play runtime.

Parent: [Blueprints spec](../spec.md)

## What to build

Selecting a link edits that link. Default-on, requirements, pins, Player Can Toggle and stat changes are editable and each change becomes an override on the link. Requirements, pins and stat changes override as a whole list. Name and both descriptions are read-only on a link. An **Edit Blueprint** action selects the original, replacing the "Linked from" editing model. A linked group's children stay live; overrides are keyed by original trait id.

Each overridden field shows a **Reset** that returns it to the blueprint. A **Reset to Blueprint** footer drops every override. When the blueprint changed a field after the override was made, the field shows "Blueprint changed" beside its Reset. The tree shows nothing.

In play, a link's Player Can Toggle override decides whether the player can toggle it. A link's stat-change override applies when its persona is played, and the persona switch applies and reverses the effective link's stat changes, never the original's.

## Acceptance criteria

- [ ] Editing a selected link changes only that link; another bearer's link to the same original is unchanged.
- [ ] Reset returns one field; Reset to Blueprint returns all; the stale marker appears only on Details and only when the blueprint's current value differs from the override's snapshot.
- [ ] Name and descriptions are read-only on a link; Edit Blueprint selects the original.
- [ ] Bearer-resolution tests cover effective linked traits with overrides and the persona switch reversing an overridden stat change.
- [ ] Component tests cover Reset, Reset to Blueprint, the stale marker and Edit Blueprint; logic stays in the module from 01.
- [ ] Copy follows the Writing Guide; the stale marker and footer follow the Design System or get the user's approval first.
