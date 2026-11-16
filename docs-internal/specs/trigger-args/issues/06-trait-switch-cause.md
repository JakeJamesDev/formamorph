# 06: Trait switch cause

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the switch diff mixes causes; attribution must come from the toggle and the script writes without changing the diff's order.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q12).

## What to build

A When a Trait Switches script reads `args.by`. It is `'player'` for the trait the player toggled and `'script'` for a trait a script wrote, World Tools included. Every other switch in the same action reads `'rule'`: exclusive siblings, cascade-offs and gate settles. Switches from the end-of-turn settle, an Option change, a persona change, an item commit and the Inventory pass all read `'rule'`. The `trait` global is unchanged. The guide and hover cards describe the field, and the help vectors are rebuilt.

## Acceptance criteria

- [x] A toggled trait reads `'player'`; its exclusive sibling and any cascade read `'rule'` (tests). `GameViewer.switchScript.test.tsx` "reads player for the toggled trait and rule for the sibling it turned off and its cascade".
- [x] A script's trait write reads `'script'`; the cascade it causes reads `'rule'` (tests). `statCodeTurn.switchCause.test.ts`: Before/After scripts, World Tool, During AI Output, nested switch script, entity trait, and a write the other way.
- [x] A gate switch at turn end, an Option change and a persona change read `'rule'` (tests). `GameViewer.switchScript.test.tsx` (turn-end gate, Option gate) and `GameViewer.personaSwitchScript.test.tsx` "reads rule as args.by".
- [x] Switch run order is unchanged. `causedSwitches` maps the diff's events in place; the switchCause tests pin the exact run order.
- [x] Docs and hover cards describe `args.by` for switches; the help vectors are rebuilt. Scripts-Reference Trait and Args, ScriptsGuide When a Trait Switches, the `args.by` card (`statCodeVariableTree.test.ts`), `build:help-vectors`.
- [x] Each guard is shown to bite by reinstating the bug. Six mutations, each red in the expected test, then restored: direction match, cause on every event, `traitWrites` dropped in `chainedResult`, toggle passes no trait, default `'rule'` → `'player'`, owner dropped from the key.

## Landed

**Not verified**
- None.

**For you**
- Variable menu on a When a Trait Switches box: `args` has one field, so it lists as a top-level `by` leaf that inserts `args.by`, as a one-field group always does. Check that the bare `by` label reads clearly.
- Test Code on a switch script reads `args.by` as `'player'` (spec session ruling).
