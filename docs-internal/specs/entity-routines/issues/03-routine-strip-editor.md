# 03: Routine Strip in the Editor

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: UI on existing patterns (the Start strip and the host gate editor), with no engine work.

## What to build

An author adds, names, orders and gates Routines on the Routine tab.

- A Routine strip above the Start strip, using the Start strip's pressed-button pattern, with **Add Routine** (Q16).
- Under the strip: the shown Routine's name, Requires (the host gate editor from world-options ticket 07, blank owner reading the entity) and Can Also Go, then its Start strip and Schedule as today.
- Rename, reorder (author order is priority, Q9) and delete Routines. Each edit is one undo step.
- A Routine with no Starts shows a warning (Q19), only while the entity has two or more Routines (Q28).
- The component-update dialog shows per-Routine Starts and Can Also Go rows (01 left it reading the first Routine, Q28). Its update check already compares every Routine (name, Requires, later Routines), so a difference there must show as a row.
- Library write-back maps a Routine's Requires (01 returns it unmapped).
- `docs/World-Editor-Entities.md` still says "routine" for a daily Schedule; reword it to the glossary.
- One Routine with no gate looks as today plus the Add Routine button.
- A kind switch keeps every Routine. A location delete drops the place from every Routine.
- Copy follows the Writing Guide; run the copy sweep on the new strings. Docs: the wiki's entity Routine page. Changelog fragment.

Spec rulings: Q9, Q14, Q16, Q19.

## Acceptance criteria

- [ ] Routine tab tests: add, switch, rename, reorder, delete; the empty-Routine warning shows and clears.
- [ ] A single ungated Routine renders as before plus the Add Routine button.
- [ ] Kind switch and location delete keep and clean every Routine (tests).
- [ ] Frames: `.scratch/frames/routine-strip.png` and `.scratch/frames/routine-strip-dark.png`, two Routines with a gate, 1280 px.

For you: World Editor → an entity → Routine tab. Check that the strip and Requires read well with two Routines.
