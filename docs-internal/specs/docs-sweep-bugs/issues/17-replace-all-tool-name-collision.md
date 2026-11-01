# 17: Replace All Never Makes Two Tools One Name

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one check in world search and its Replace All pass, with an existing suite beside it.

## What to build

The close review of ticket 07 found this in source; it was not run. **Search World**'s check on a Tool name Replace reads the Tool list from before the pass. So a Replace All can make two Tools collide: replacing `_` with nothing turns `bell_2` and `bell__2` into two Tools named `bell2`. **Save Tool** refuses that duplicate.

The check also counts the names the pass has already written (Q12). The later Tool's Replace counts as skipped, with the same summary as any other refused name.

Spec: Q12, Implementation Decisions "Search World".

## Acceptance criteria

- [ ] A world-search test that runs that Replace All fails today (two Tools named `bell2`), then passes with one renamed Tool and one skipped
- [ ] A Replace All that renames Tools to distinct names still renames them all (test)
- [ ] A later Replace All, in a new pass, reads the saved names, not the last pass's (test)
- [ ] The WorldEditor page matches, if it names this case; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
