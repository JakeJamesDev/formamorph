# 03: `args` and `instance` globals

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the sandbox prelude, a script-text migration on shipped worlds, and the editor surface all move together.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q1–Q4, Q6, Q11, Q13, Q14, Q16, Q18, Q19).

## What to build

Every script reads an `args` global, frozen and read-only. A World Tool script reads the AI's values there, as today. An item script reads `args.quantity` on all five item timings and `args.target` on When Used. Every other run reads an empty object. Item scripts read the Item Instance the event happened to as `instance`. Once it is gone, `instance` reads it as it was before the event. `self` is the item only, with no `event`. `items[x].instances` replaces `items[x].copies`.

Shipped scripts migrate on world load, in every script home. `self.event.copy` becomes `instance`. `self.event.timing` becomes the script's own timing as a string literal. Every other `self.event.X` becomes `args.X`, and `.copies` on an item entry becomes `.instances`. The bundled Emberwatch source is rewritten to the new names (bundled-worlds skill). Hover cards and the variable tree show `args` with the box's own timing's fields, and `instance`. Test Code and the Test Bench give item timings a fixed sample (Q11). The built-in templates that used `self.event` use the new names. The Scripts guide and reference describe `args` and `instance`, and the help vectors are rebuilt.

This ticket owns the trigger-args value type, the `by` union included (`'story' | 'player' | 'script' | 'rule'`). Tickets 04 and 06 fill it.

## Acceptance criteria

- [ ] An item script reads `instance`, `args.quantity` and `args.target`; `self.event` is undefined (test through the item runs).
- [ ] `instance` reads a gone instance as it was before the event (test).
- [ ] `args` is a frozen empty object in Before the AI, After the AI, At Game Start and During AI Output; a World Tool script's `args` is unchanged (tests).
- [ ] Fields are absent on timings they don't apply to, such as `args.target` on When Gained (test).
- [ ] The migration rewrites each form, leaves look-alike text alone, and is idempotent (tests).
- [ ] Emberwatch's item scripts run as before (its existing script tests pass on the rewritten source).
- [ ] Hover cards and the tree list each timing's fields; Test Code runs an item script against the sample.
- [ ] Each guard is shown to bite by reinstating the bug.
- [ ] The response reminds the user that world script text is rewritten on load.
