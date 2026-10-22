# 04: Trait Switch Landing

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a contained fix on one landing path, with the proof that the drop existed.

## What to build

A trait the player toggles during play runs its When a Trait Switches scripts, and today their memory, pin and diary writes are returned and never consumed. The fix lands them the way a Before-the-AI run's world writes land, between turns, on the latest turn on screen: the memory line joins that turn's digest, the pinned line becomes a Custom line anchored at that point, the diary line joins the entity's diary (Q6). Switches made by a script inside a run keep their current path.

Spec: Q6, story 18.

## Acceptance criteria

- [x] A test reinstates the drop and fails: toggling a trait whose switch script calls the memory line, the pin and the diary leaves all three on the latest turn after the fix and none before. `GameViewer.switchScript.test.tsx` "the run's memory, pin and diary lines": the toggle, the settle and the mid-turn toggle cases all went red with the drop reinstated
- [x] A rewind past that turn removes the pinned line with it, as script pins do. `scriptPins.test.ts` "leaves with its turn on a rewind past it"; the GameViewer test checks the pin id names the latest turn
- [x] A switch fired by a script inside a Before-the-AI run still lands with that run's batch, unchanged. "land once, with the batch, for a switch a Before the AI script makes" (exact once, green before and after the fix)
- [ ] Four gates green

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- Four gates green: prepare runs the full gate list after this hand-off, and a red gate stops the landing. The review gates (typecheck, changed-file lint) passed.
- The hold for a run that ends mid-turn (Q36) has no test that fails without it: in jsdom the sandbox finishes a mid-turn switch run only after the turn commits, so its lines survive either way. The mid-turn test checks the outcome only.
- The persona-change caller shares the landing with the toggle and the settle, but no test drives it.

**For you**

- Toggle a trait whose When a Trait Switches script calls `memory.add`, `memory.pin` and `diary`, then open the Memory panel: the pin shows as a Custom line, and the latest turn's memory and the entity's diary hold the lines.
