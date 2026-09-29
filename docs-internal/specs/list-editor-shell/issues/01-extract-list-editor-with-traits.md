# 01: Extract the List Editor with the Traits editors

Status: ready-for-human
Base: f4e04f49
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: this ticket sets the shell's adapter shape and its parts; every later ticket builds on it.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The entity panel's **Traits** tab and the library entity editor's **Traits** tab run on a new generic List Editor. An author sees no change: the same toolbar, tree, flat search, stacked and side-by-side layouts, and details. The shell exposes toolbar, list, detail and footer parts, plus a `ListDetail` wrapper that takes a layout. Rulings Q3, Q9, Q17, Q25, Q26.

## Acceptance criteria

- [x] A `ListEditor` shell owns the search state, the tree-or-flat-search switch, the flat search list, the detail and its footer, clearing a selection the list doesn't hold, and the empty hint. Selection comes in as props.
- [x] The caller supplies an adapter: tree, flat rows with their actions, detail per selection, optional footer, the **+** slot, box text, whether an id is held, and the empty hint.
- [x] The shell exposes its parts for a host that lays them out itself, and a `ListDetail` wrapper with `stacked` and `sideBySide` layouts.
- [x] `EntityTraitsEditor` becomes the Traits adapter on the shell. The mirror and the library Traits tab keep their current behavior, and existing tests pass unchanged.
- [x] `CONTEXT.md` gains a **List Editor** entry.
- [x] `drift.md` exists with its table and the three quirks the spec lists.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
