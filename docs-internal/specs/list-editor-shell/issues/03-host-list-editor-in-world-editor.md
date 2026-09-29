# 03: Host List Editor parts in the World Editor

Status: ready-for-human
Base: 3b03ae6e
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: it builds the World Editor seam every tab ticket reuses, including per-tab selection and navigation into it.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The top-level **Traits** tab runs on the List Editor inside the World Editor's resizable split and mobile push. Each top-level tab keeps its own selection, so Traits → Stats → Traits reopens the trait. Traits search now finds owned traits and Links as well as world traits, each under the label its row shows. Rulings Q2, Q9, Q21, Q22.

## Acceptance criteria

- [x] The World Editor places the shell's parts in its desktop split and its mobile push. The footer bar, palette bar, Bench and In Play panes stay outside the shell and work as before.
- [x] The Traits tab's tree, drill-in **+** menu, help button, details and Link footer behave as before.
- [x] Traits search lists world traits, owned traits and Links as flat rows; groups and entity nodes stay out.
- [x] Each top-level tab holds its own selection. Find, Bench and tour navigation set the target tab's selection.
- [x] Bench tests cover per-tab selection and the widened Traits search. Other World Editor tests pass unchanged.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
