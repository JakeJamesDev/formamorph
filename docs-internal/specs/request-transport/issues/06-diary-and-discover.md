# 06: Diary And Discover In The Queue

Status: done
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: two more members on a module whose rules exist, but the discover-before-diary dependency and the orphan-diary rule change which requests are sent; the tests must pin the new bodies.

## What to build

Diary and discover join the Background Pass Queue and their drainer effects leave the view:

- Due items are (turn, name) pairs, so one stuck pair never hides the ones behind it. Oldest due turn first.
- A diary for a name is due only when that name is an entity, or when its discover has finished this window. A name with no entity and no discover coming (suppressed, Describe New Characters off, or its discover set aside) gets no diary this window; with no discover ever coming it gets none at all.
- Priority in serial mode: discover → digest → diary → milestone.
- Diary builds from the diary pass over the standalone pass input, with the entity text that now exists after discover. Discover keeps its pass record. Both carry the abort signal and pass through the session guard (discover's entity write is a guard target).
- The diary characterization test from 01 is deleted with the hand-built builder.
- The status bar gains "Describing character…" for a running discover, under the same toggle and precedence as the others. The old per-pass flags for diary and discover go.

**Hand-off from ticket 05 (landed as `6e41cff7b`).** The interim guards carry the comment "Interim until diary and discover join the queue": the queue's busy flag in the game view and the running-set checks in the diary and discover drainers. Delete them here. The status component's pass kind union adds a diary case beside the queue's kinds; it collapses once diary joins. Keep two queue rules 05 introduced: an applied pass stays out of the due set while a snapshot still shows the state it read, because a render can lag the write and the live app double-sent a digest without it; and a tick waits while the session counter differs from the last snapshot's.

Changelog fragment, Minor → Fixed → ⚙️: a new character's diary now carries the character's description; no diary is written for a name that never becomes an entity; the status bar names a running character description.

## Acceptance criteria

- [ ] Queue unit tests: a new name's diary waits for its discover and then carries the description; a suppressed name and a name with Describe New Characters off get no diary; a discover set aside defers that name's diary for the window and the other names proceed; serial order holds across all four kinds.
- [ ] A mounted test shows the discover label.
- [ ] Reinstating the old diary-before-discover order or the orphan diary turns a test red.
- [ ] Diaries and discoveries apply as before in the running app for a known character and for a new one.
- [ ] Four gates green.
