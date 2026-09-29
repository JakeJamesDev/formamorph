# 08: Entities tab on the List Editor

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: the entity panel carries nested state (tabs, trait and placeholder selection) that must survive the move.

Parent: [List Editor Shell spec](../spec.md)

## What to build

The **Entities** tab runs on the List Editor with no visible change: the folder tree, the **+** menu, the flat search, the entity panel and its footer actions. Ruling Q10.

## Acceptance criteria

- [ ] The entity tree, group and entity details, link markers, remove confirmation and footer actions behave as before.
- [ ] The entity panel's tab, trait selection and placeholder selection survive as before.
- [ ] Existing entity tests pass unchanged.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
