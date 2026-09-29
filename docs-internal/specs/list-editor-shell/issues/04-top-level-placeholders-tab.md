# 04: Top-level Placeholders tab on the List Editor

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: row-id selection, owner-prefixed labels and the Blueprints edge make the flat search non-trivial.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The top-level Placeholders tab runs on the List Editor. Its search, ignored today, lists every placeholder row that matches: world, owned and copies, each under the label its row shows. Rulings Q2, Q11.

## Acceptance criteria

- [ ] The tree, the **+** menu (Add Group, Add Placeholder, Add Blueprints Group) and the detail router behave as before.
- [ ] Search lists matching world, owned and copy rows by their row labels (`Owner › Name`). Folders and owner nodes stay out.
- [ ] Selecting a search row opens the same pane as selecting it in the tree.
- [ ] Bench tests cover the search. Existing tests pass unchanged.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
