# 03: `args` and `instance` globals

Status: ready-for-human
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

- [x] An item script reads `instance`, `args.quantity` and `args.target`; `self.event` is undefined (test through the item runs). `statCodeTurn.itemScripts.test.ts` › instance and args.
- [x] `instance` reads a gone instance as it was before the event (test). `statCodeExecutor.items.test.ts` and the When Lost item-run test.
- [x] `args` is a frozen empty object in Before the AI, After the AI, At Game Start and During AI Output; a World Tool script's `args` is unchanged (tests). `sandboxSnapshot.test.ts`.
- [x] Fields are absent on timings they don't apply to, such as `args.target` on When Gained (test). `statCodeExecutor.items.test.ts` › lists only the fields its timing reads.
- [x] The migration rewrites each form, leaves look-alike text alone, and is idempotent (tests). `scriptTextMigration.test.ts` › migrateItemEvent, plus a migrated script run through `migrateWorld`.
- [x] Emberwatch's item scripts run as before (its existing script tests pass on the rewritten source). Green in the gates' affected tests.
- [x] Hover cards and the tree list each timing's fields; Test Code runs an item script against the sample. `statCodeVariableTree.test.ts` › the names an item timing adds; `statCodeTestRun.timings.test.ts` › Test Code on an item script. Unit-level only, not seen in the preview.
- [x] Each guard is shown to bite by reinstating the bug. Dropped the per-timing filter, the gone fallback, the empty `args`, the item home of the migration and the Test Code sample: each turned its tests red.
- [x] The response reminds the user that world script text is rewritten on load.

## Landed

**Not verified**
- None unticked. The hover cards and the Variable menu were checked through the surface and tree functions, not in the editor.

**For you**
- Open an item's script box in the World Editor: the Variable menu shows **Item Instance** and the timing's **Arguments**, and Test Code runs on one sample instance.
- The Test Bench never runs item scripts (`ruleScripts` lists world, stat and trait boxes only), so Q11's Bench half has nothing to apply to. That gap predates this ticket.
- Test Code's sample carries `quantity` and `target` only; tickets 04 and 05 add `by`, `from`, `to` and `purchase` to it with their fields.
- For ticket 04: the prelude passes non-`target` fields through as frozen values, so `from` and `to` need resolving to the entity, location or `persona` entry there.
