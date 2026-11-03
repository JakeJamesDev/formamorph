# 10: Review Cleanup

Status: ready-for-agent
Blocked by: 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The close's standards findings. Ruling: Q61. Behavior doesn't change, so existing tests stay as they are.

## What to build

The code and docs of this effort read to the repo's standards, with the same behavior.

## Acceptance criteria

- [ ] Comments in `statCodeTurn.ts` and `GameViewer.tsx` say what the code does with no "land" image verb. Comments keep their line, and identifiers stay out of scope unless the rename below names them.
- [ ] One builder makes `HeldItems`, and `runItemScripts` takes the inventory step as one argument.
- [ ] `switchRunOf` and `itemRunOf` share their strip, `inventoryPassOver` uses `sameCopies`, and `GameViewer.tsx` imports `baseWritesOf` from its own module.
- [ ] `ChainedItems.held`, `holds`, `ActionRuns.trail` and `every` have names that say what they hold, and `landedInventory` takes a named options object.
- [ ] Scripts Reference, Test Bench and `CONTEXT.md` no longer use "stack", "A diary line has no read." or "Where a write applies does not change.", per `docs/Writing-Guide.md`. `CONTEXT.md` defines the script chain, or the docs stop using the word.
- [ ] No test's assertion changes. A test that needs a rename takes only the rename.
