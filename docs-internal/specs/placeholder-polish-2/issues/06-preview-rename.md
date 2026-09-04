# 06 — Roll becomes Preview in the placeholder editor

Status: done
Type: task
Spec: ../spec.md (Preview)

## Task

- `src/managers/PlaceholderManager.tsx`: button label "Preview"; tooltip "Preview a sample of
  this placeholder"; the sample's `aria-label` "Sample preview". Keep the `Dices` icon.
- Field-level Reroll and the Test Bench Reroll are untouched.

## Acceptance

- `PlaceholderManager.test.tsx` sample suite: helper renamed, assertions on the new button name,
  tooltip, and status name. The persists-nothing case stays.
- Changelog 👤 In-Progress entry.
- Four gates green. `graphify update .` run.
