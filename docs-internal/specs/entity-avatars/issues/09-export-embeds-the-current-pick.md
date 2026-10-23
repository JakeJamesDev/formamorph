# 09: Export Embeds the Current Pick

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: low

Opus at low: one branch in the export carry and a test for it.

## What to build

An exported character card or entity listing embeds the Avatar its pick names now (spec: Entity pick; T07-1). Today an entity that already carries an embedded Avatar file exports that file even after its pick changes to a different library or world Avatar. Only a device-downloaded listing holds such a file today, so this is rarely reached. Found by the close review.

## Acceptance criteria

- [x] An entity that carries an embedded Avatar and whose pick now names a different Avatar exports the newly picked file. (`carries the newly picked Avatar over the one the entity already embeds`)
- [x] An entity whose pick still matches its embedded file (same hash) exports it unchanged. (`keeps an embedded Avatar the pick still names`; an unresolved pick also keeps it, per the spec session's ruling)
- [x] A test fails when the old preference for the embedded file is reinstated. (reinstated held-first: the first test went red)

## Landed

**Not verified:** none.

**For you:** none. No UI change; export behavior is covered in `src/lib/entityVrmCarry.test.ts`.
