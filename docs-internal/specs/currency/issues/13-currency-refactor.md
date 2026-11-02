# 13: Currency Refactor

Status: ready-for-agent
Blocked by: 10, 11, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A behavior-preserving restructure of money code other tickets touch, so it needs care about seams.

## What to build

No behavior changes. The close review's structure findings get fixed:

- Split `currency.ts` by reason to change: parsing, editor row operations, picker groups, price reading, and payment planning.
- Use one refusal shape in place of today's five.
- Share the duplicated checks: visible and identified copies, the whole-number check, and the stat helpers in the pass and in script money.
- Give `repeatsBuy` a name that says it records state, and move `quoteBuy`'s pricing into the Currency modules.
- Reduce the nested closures `applyInventoryPass` gained.

Also add the missing test: a script pay followed by a pass pay in one turn.

**Start this only after Script Run Order ticket 04 lands.** That ticket rewrites how money chains between scripts, and this one would collide with it. It may also remove the need for some of these shapes, so re-read the code first.

Rulings: Q83, Q84.

## Acceptance criteria

- [ ] Every existing Currency test passes unchanged, except for import paths.
- [ ] A test proves a script pay then a pass pay in one turn settles both, and it fails when the pass reads stale state.
- [ ] The pay and buy probes, cloud default, show no case falling against an in-batch run of the code before this ticket. The numbers are in the landing.
- [ ] Bundled-world fingerprints and export shape are unchanged. No changelog fragment.
