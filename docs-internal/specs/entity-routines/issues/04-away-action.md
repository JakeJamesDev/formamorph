# 04: Away Action

Status: ready-for-agent
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

- [ ] Engine tests: an Away row gives no Position while time and Patrol progress continue; a follower keeps following through it; no call-over or new follow during it.
- [ ] Reader-parity harness: an Away entity is absent from scene, here, nearby, map and place-based AI context, and present in known-entity contexts; its stats regen and its scripts run. The guard bites when the drop is removed.
- [ ] The no-Routine-holds case reads the same in the harness (once 02 has landed; else noted for 02).
- [ ] Editor test: Away in the action menu, saved with no place.
