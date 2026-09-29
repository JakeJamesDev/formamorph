# 05: Scoped placeholder editor in the entity and dictionary panels

Status: ready-for-human
Base: 7b73793c
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the first real placeholder adapter, with World Editor-held selection and the copy fix.

Parent: [List Editor Shell spec](../spec.md)

## What to build

An entity's Placeholders tab works like its **Traits** tab: a search box, a **+** that reads "Add Placeholder to <entity>" and takes its name from the search text, and details that slide in over the list. The open placeholder survives a switch to Profile and back. A Blueprint copy opens its copy editor. The dictionary panel's Placeholders tab works the same way. Rulings Q1, Q4, Q5, Q6, Q7, Q12, Q14.

## Acceptance criteria

- [x] Both panels use the stacked layout and fill the pane.
- [x] **+** is one add action named from the search text; the box clears and the new placeholder's details open.
- [x] Search lists matching rows flat through the shared match; an empty match shows a no-match line.
- [x] The World Editor holds one placeholder selection per panel. Another entity tab and back keeps it; a new owner returns to the list.
- [x] A copy row opens the copy editor through the shared router.
- [x] Bench tests cover each point for the entity panel and the dictionary panel.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Record any behavior drift found in `drift.md` (Q18), with the old behavior kept.
