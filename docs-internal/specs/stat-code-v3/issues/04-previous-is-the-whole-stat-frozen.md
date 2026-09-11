# 04: Previous Is The Whole Stat, Frozen

Status: ready-for-human
Base: f8b199db
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Widening one marshalled field and freezing it, with the per-turn seam already receiving the data. Narrow and well-bounded, so Sonnet at medium effort.

## What to build

`self.previous`, and `previous` on every entry in `stats`, is the whole stat as it stood at the start of the turn: `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen`. `min`, `max`, and `regen` are the effective numbers at turn start, traits and code bounds included. It carries no `previous` or turn inputs of its own. The object is frozen in the VM, so a write does nothing, and the editor flags a write to any `previous` field the way it flags a write to a read-only `self` field. Completions after `previous.` list the stat's fields. Where the turn has no pre-turn entry for a stat, `previous` is a copy of the current entry. The per-turn seam takes the full pre-turn stats, as GameViewer already hands them, instead of a value-and-max fragment.

## Acceptance criteria

- [x] `self.previous.min`, `.name`, and `.regen` read the turn-start values; `stats["Other"].previous` too
- [x] `previous` has no `previous` and no turn-input fields
- [x] A write to `previous.value` changes nothing after the run; the editor underlines it
- [x] Completions after `previous.` list the stat fields
- [x] First turn, clock-only run, and Test Code read `previous` as a copy of the current entry
- [x] The per-turn seam accepts full pre-turn stats; the e2e regen case still passes
- [x] Surface list and drift guard updated; guide and help describe the full shape
- [x] Four gates green; graph updated

## Blocked by

- None (can start immediately)

## Comments

Implemented `StatSnapshot` (the 8-field shape) in `statCodeExecutor.ts`: `marshalSnapshot` builds it from a
`Stat`, `previous` is `marshalSnapshot(inputs.previous)` when a pre-turn entry exists and the current entry's
own snapshot otherwise, and both `stats[*].previous` and `self.previous` are `Object.freeze`d inside the VM
program so a write to any of their fields does nothing. `StatCodeTurn.previous` (in `statCodeTurn.ts`) widened
from `(ValueAndMax & { id })[]` to `readonly PlayerStat[]` — GameViewer already had the full pre-turn stats at
the call site, so no caller change was needed. `PREVIOUS_FIELDS` in `statCodeSurface.ts` now lists the same
8 fields as `STAT_FIELDS` minus `previous`/`requested`/`regenApplied`; the existing drift guard
(`statCodeSurface.test.ts`) checks the sandbox's actual `Object.keys` against it with no changes needed. The
existing self-write diagnostic already flagged `self.previous.<field>` as a read-only field (STAT_FIELDS has
`previous`, `SELF_WRITABLE_FIELDS` doesn't), so no analysis-code change was needed for that criterion either.
Updated `docs/StatCodeGuide.md` and the in-app help topic (`helpTopics.ts`) to describe the full shape.

This repo is a shared working tree across several concurrent ticket sessions (no per-ticket worktree
isolation), so most of this ticket's `statCodeExecutor.ts`/`statCodeExecutor.test.ts`/`statCodeSurface.ts`/
`helpTopics.ts`/`docs/StatCodeGuide.md` edits ended up staged and committed by ticket 06's session as part of
commit `b274ff79` ("Add pin(text) as the documented placeholder write") before this session could commit them
separately — confirmed by that session directly and by diffing this ticket's changes against that commit.
Only `statCodeTurn.ts` and the Changelog wording remained uncommitted here. Four gates: typecheck and lint
clean, build succeeds; the test suite has 3 pre-existing failures unrelated to `previous` (`currentStatId`/
`stats` array-members expectations left over from the still-in-progress stats-becomes-a-map ticket), not
caused by this change — confirmed by running them in isolation before and after this ticket's edits.
