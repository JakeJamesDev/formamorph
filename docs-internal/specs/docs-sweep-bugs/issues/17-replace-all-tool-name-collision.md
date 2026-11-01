# 17: Replace All Never Makes Two Tools One Name

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one check in world search and its Replace All pass, with an existing suite beside it.

## What to build

The close review of ticket 07 found this in source; it was not run. **Search World**'s check on a Tool name Replace reads the Tool list from before the pass. So a Replace All can make two Tools collide: replacing `_` with nothing turns `bell_2` and `bell__2` into two Tools named `bell2`. **Save Tool** refuses that duplicate.

The check also counts the names the pass has already written (Q12). The later Tool's Replace counts as skipped, with the same summary as any other refused name.

Spec: Q12, Implementation Decisions "Search World".

## Acceptance criteria

- [x] A world-search test that runs that Replace All fails today (two Tools named `bell2`), then passes with one renamed Tool and one skipped. Test `renames one Tool and skips the one that would take the same name`; it failed with the old check reinstated.
- [x] A Replace All that renames Tools to distinct names still renames them all (test `renames every Tool when the new names stay distinct`)
- [x] A later Replace All, in a new pass, reads the saved names, not the last pass's (test `reads the saved names in a later pass, not the last pass’s`; failed with the old check reinstated)
- [x] The WorldEditor page matches, if it names this case; the docs tests are green. `docs/WorldEditor.md` names the same-pass case; `src/lib/docs` tests pass (8 files, 377 tests).
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-17.md`)

## Landed

**Not verified**
- None. The full gate list runs in prepare.

**For you**
- In Search World, try Replace All on two Tools named `bell_2` and `bell__2`, replacing `_` with nothing. One Tool renames and the skipped count shows 2 matches.
