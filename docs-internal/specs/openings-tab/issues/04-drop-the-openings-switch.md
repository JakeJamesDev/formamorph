# 04: Drop the Openings Switch

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small model change across the draw, migration and a few labels, with clear tests to drive it.

## What to build

A world uses its openings whenever it has any (Q9, Q10).

- The draw ignores the stored `openingsEnabled` flag. A world with authored openings draws one; a world without them starts on the default opening, as today.
- World migration strips the flag on load and stays idempotent, so a saved world no longer carries it.
- The world type loses the field, and every reader of it goes: the editor's history labels, the opening instrument, stored-world additions and the data context.
- The entity and location Openings tabs' hints that talk about turning openings on, or about openings being off, are rewritten per the Writing Guide.
- ⚠️ Export-shape change: the world `.json` loses `openingsEnabled`. Say so in the landing reply.

## Acceptance criteria

- [x] A world with authored openings and a stored off flag draws an opening: `openings.test.ts` "draws an authored opening whatever a stored off flag says" and the pool variants. The mutation was not run; the tests assert a draw where the old code returned the default.
- [x] Migration strips the flag and a second run changes nothing: `version.test.ts` "strips a stored openingsEnabled flag, keeping the rows, and a second run changes nothing".
- [x] No source reads `openingsEnabled` any more: grep of `src` finds it only in the migration strip and in tests that feed a stored flag.
- [x] No editor hint mentions openings being on or off: the hints in `OpeningsPanel.tsx` and `OpeningInstrument.tsx` are rewritten; the editor tests read the new text.
- [x] Docs updated; a changelog fragment is written that tells authors their switched-off openings now draw: Openings, Entities, Entity Editor and World Format wiki pages; `docs-internal/changelog.d/openings-tab-04.md`.

## Landed

**Not verified**

- The spec session ran the "honor the flag" mutation after the landing: returning an empty pool on a stored off flag failed the three stored-flag tests in `openings.test.ts`; restored, 78 pass. No browser frame: the change removes a flag and reworks hint text, and the editor tests read the hints.
- Nothing else unticked.

**For you**

- ⚠️ Export-shape change: the world `.json` loses `openingsEnabled`.
- Help vectors may be stale for the Openings page: run `build:help-vectors` before the release.
- The unreleased changelog entry that says the Overview tab holds Openings was still unreworded when ticket 03 landed (see its Landed list).