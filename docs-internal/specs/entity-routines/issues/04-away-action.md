# 04: Away Action

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: one engine change, but many readers must be sorted into place-based and place-free.

## What to build

A Schedule row can say a character is Away: at no place, but still running.

- `ScheduleAction` gains Away, with no place. It takes a time range or All day like any row (Q21). Places-of helpers return none.
- During an Away row the entity has no Position while its engine state and clock advance. Its stats, regen, traits and scripts run.
- A running follow continues through it; the entity goes Away when the follow ends. During the row narration cannot call it over and it cannot start a follow, as on a Strict row (Q22).
- Readers tied to a map place drop it: scene, here, nearby, the map, place-based AI context. Contexts that need no place keep it, such as known-entity lists (Q23).
- "No Routine holds" (ticket 02) gets the same reader behavior (Q24).
- The Schedule row editor offers Away in its action menu.
- World-options ticket 08 builds "offstage" for stranded entities, which is close to Away. Read its state before building. If it landed, reuse its reader path and keep known-entity contexts per Q23. If it has not, build on the "no Position" path and leave 08 a note.
- Glossary: **Away**. Docs: the wiki's entity Routine page and the world format page. Changelog fragment.
- ⚠️ Export-shape change for worlds.

Spec rulings: Q21, Q22, Q23, Q24.

## Acceptance criteria

- [x] Engine tests: an Away row gives no Position while time and Patrol progress continue; a follower keeps following through it; no call-over or new follow during it. `positionEngine.test.ts` › Away (11 cases, Q29 points 1–5 included); the narration move path and the Movement tag in `entityFollowing.test.ts` and `movementTag.test.ts`. Each guard reverted once and went red.
- [x] Reader-parity harness: an Away entity is absent from scene, here, nearby, map and place-based AI context, and present in known-entity contexts; its stats regen and its scripts run. The guard bites when the drop is removed. `GameViewer.awayAction.test.tsx` with Stay controls at the Harbor and at Lanternlane; Away playing as the Start place turns it red.
- [ ] The no-Routine-holds case reads the same in the harness (once 02 has landed; else noted for 02).
- [x] Editor test: Away in the action menu, saved with no place. `RoutineTab.test.tsx` › "offers Away in the action menu…" and "adds an Away row in the free time".

## Landed

**Not verified**

- No-Routine-holds in the harness: 02 has not landed. The engine exports `awayAllDay(routine)` for it (Q24); 02 should add its harness case. A script move on an All-day Away row holds until another script move (`untilScriptMove`, as on an All-day Stay), so 02 should check that a hold does not pin an entity whose Routine returns.
- No frame of the editor: the Away toggle, the sentence and the gray day-strip band are checked by DOM tests only.

**For you**

- World Editor → an entity → **Presence** → a routine row → click the verb: **Away** is the fourth choice in a 2×2 toggle, and the row reads *…, is away.* with no location. Its day-strip band is `muted-foreground` at 25% (no `routine-away` token); approve the color or name one.
- In play: give an entity a Night **Away** row and stand where it lives at dusk. It stays until you leave, then it is off the map and out of the scene, while the AI still lists it under the entities known here.
