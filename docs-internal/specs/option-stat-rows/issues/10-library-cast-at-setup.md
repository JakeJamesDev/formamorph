# 10: Library Cast At Setup

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The close review found two setup readers that miss Q26g's "every setup reader uses these stats":

- **Library defaults.** When a library entity joins the cast, it picks its default traits under each Option's default value, not the player's picked values. A default whose gate opens only under a picked value's row never starts selected. Pass the picked Option values when the library entity's defaults are chosen.
- **Routine gates.** The opening Routine pick reads setup stats without the library cast, so a library persona's picks never reach Routine gates. Pass the library through, as Starting Location gates already do.

## Acceptance criteria

- [x] A library entity's default gated on a stat that the picked Option value raises starts selected. Test "settle under the picked Option value's rows (Q35)" in `entryDraft.statGates.test.ts`.
- [x] Under a library persona whose pick raises a stat, a Routine gated on that stat is open at the opening. Test "picks the Routine a library persona's pick opens (Q35)" in `inPlayWorld.startPicks.test.ts`.
- [x] Each guard goes red with its bug reinstated. Removed each fix in turn; both tests failed; restored.

## Landed

**Not verified**
- The `GameViewer.sessionPool` call site (library persona id and `codeEntities.library`) has no test: the handler sits inside the god component. I checked it by reading against `startRoutinePick`'s new signature; typecheck passes.

**For you**
- A Routine on a library entity itself is out of scope (Q35): `startRoutinePick` stays gated on `world.entities.some(hasRoutineGate)`. Test Bench callers and `codeWorldLookup.ts` stay world-only with no library.
