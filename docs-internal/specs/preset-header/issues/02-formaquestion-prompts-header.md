# 02: Formaquestion Prompts header

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

The Formaquestion Prompts header renders from the shared component and offers the full prompt preset action set.

- Delete, Duplicate, Rename, Import, Export as today, plus Reset. Reset resets the active preset's three prompts and their options after a confirm that names the preset. No Publish.
- Below `md` the ⋯ menu replaces the wrapping icon row.
- The hand-rolled icon row and its per-button wiring go.

Spec: Q1, Q2, Q7, Q12; Implementation → Formaquestion Prompts header.

Recommended model rationale: one surface adopting a finished component, plus one new reset action in the help preset store.

## Acceptance criteria

- [ ] The Formaquestion header shows the same icon row as Settings at `md` and the ⋯ menu below it.
- [ ] Reset returns all three prompts and their options to the defaults after a confirm.
- [ ] A built-in preset offers Duplicate, Import and Export only.
- [ ] The Formaquestion prompts test passes on behavior.
- [ ] Changelog line under In Progress.
