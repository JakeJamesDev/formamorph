# 08: Review Fold-In

Status: done
Blocked by: None
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

One bug in the executor's clamp order, one ruling in the derive step, and five small items from the spec review of tickets 01–07. The clamp and the floor touch the ledger math, so Opus at high effort.

## What to build

**1. A stat's own value lands after its bounds, not before.** The executor clamps `self.value` against the stat's snapshot bounds before a hub's bound write or the stat's own trait switch lands. A hub sets Health max to 200 and Health's box returns 150, so Health lands at 100. Return the self value unclamped and let the merge step clamp once, after bounds and switches land, as hub writes already do.

**2. The effective min is floored at the authored base min (Q19).** The floor applies to the whole sum, trait changes and code delta together, so no layer digs under the author's floor. The code min delta is measured before the floor, as the max delta already is. Replace the per-contribution trait floor with the floor on the sum. Update the test that pins a min below base, and the header comment.

**3. Test Bench scanner.** A write form inside a string literal is not a write; blank string bodies except inside brackets. The postfix step pattern does not cross a newline. Duplicate stat names resolve as the sandbox resolves them: last wins, enabled over disabled, by the same helper. Boxes of an authored-off stat do not count as writers, and an authored-off stat is not a target.

**4. Entity stats drop the dead stored-bounds key on load (Q16).** No migration; strip the key from the snapshot and the live entity stats.

**5. A write of `0` to an unknown stat name is reported.** Diff against the blank entry only for known entries.

**6. The dice template's description** drops the claim that a second draws the same numbers unless a test proves two sandbox runtimes share a seed.

**7. A derive between load and the settle effect** reads the migrated bound: either run the migration where the save-side refresh runs, or prove with a test that no derive happens before the settle commits.

## Acceptance criteria

- [ ] A hub's `stats.Health.max = 200` and Health's own `return 150` on one run land Health at 150
- [ ] `self.value = 150` with a trait switch that raises max in the same run lands at 150
- [ ] A trait +10 min, a code `self.min = 5`, then the trait switched off reads min at the authored base, not below
- [ ] The code min delta is measured pre-floor; the header comment matches
- [ ] A write form inside a string is not a finding; a `--` on the next line is not a postfix step
- [ ] Two stats with one code name attribute the finding to the stat the sandbox resolves
- [ ] An authored-off stat's box is not a writer; an authored-off target is not counted
- [ ] A loaded save's entity stats carry no stored-bounds key
- [ ] `stats.Nope.value = 0` is reported as an unknown-name write
- [ ] The template description is true or the claim is removed
- [ ] A stored player bound reads correctly on the first derive after load
- [ ] Each guard is proved by reinstating the bug once
- [ ] Changelog fragment written where the player sees a change; four gates green

## Blocked by

- None
