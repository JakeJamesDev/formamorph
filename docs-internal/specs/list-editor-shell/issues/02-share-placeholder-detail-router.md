# 02: Share the placeholder detail router

Status: ready-for-human
Base: 3b03ae6e
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a mechanical extraction out of the World Editor, pinned by the existing Blueprints and placeholder tests.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The World Editor's top-level Placeholders tab picks its detail pane through one shared component. An author sees no change: a group opens its group panel, an owner node its owner panel, a Blueprint copy its copy editor with the Reset and Edit Blueprint footer, and any other row the placeholder manager. Ruling Q4.

## Acceptance criteria

- [ ] One component takes a placeholder selection (row ids, with the bare-id fallback), renders the group, owner, copy or manager pane, and exposes the copy footer.
- [ ] The World Editor's Placeholders tab uses it, and its inline placeholder detail branches and copy footer logic are gone.
- [ ] The component works with a scoped store, where only the copy and manager branches apply.
- [ ] Existing World Editor Blueprints and placeholder tests pass unchanged.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
