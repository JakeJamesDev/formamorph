# 10: Review Cleanup

Status: done
Blocked by: 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The close's standards findings. Ruling: Q61. Behavior doesn't change, so existing tests stay as they are.

## What to build

The code and docs of this effort read to the repo's standards, with the same behavior.

## Acceptance criteria

- [x] Comments in `statCodeTurn.ts` and `GameViewer.tsx` say what the code does with no "land" image verb. Comments keep their line, and identifiers stay out of scope unless the rename below names them. (grep of the diff's comment lines; the review's blame found no older hit this effort added)
- [x] One builder makes `HeldItems`, and `runItemScripts` takes the inventory step as one argument. (`heldItemsOf` at every build site; typecheck green)
- [x] `switchRunOf` and `itemRunOf` share their strip, `inventoryPassOver` uses `sameCopies`, and `GameViewer.tsx` imports `baseWritesOf` from its own module. (`nestedRunBase`)
- [x] `ChainedItems.held`, `holds`, `ActionRuns.trail` and `every` have names that say what they hold, and `landedInventory` takes a named options object. (`heldEvents`, `holdsEvents`, `runsSoFar`, `allScripts`; `ops`, `from` and `holdsEvents` are the options)
- [x] Scripts Reference, Test Bench and `CONTEXT.md` no longer use "stack", "A diary line has no read." or "Where a write applies does not change.", per `docs/Writing-Guide.md`. `CONTEXT.md` defines the script chain, or the docs stop using the word. (CONTEXT.md defines Script Chain; the player docs say "add up")
- [x] No test's assertion changes. A test that needs a rename takes only the rename. (18 call sites change arguments, per Q67; two `expect` paths take `heldEvents`)

## Landed

**Not verified**
- None.

**For you**
- Read the reworded Scripts Reference lines ("A failed script still adds nothing." and the diary bullet) and the Script Chain entry in `CONTEXT.md`.

Note: `ActionRuns.trail` became `runsSoFar`, not `steps`, since `steps` is a local in `runScripts` and `withSwitchRuns`.
