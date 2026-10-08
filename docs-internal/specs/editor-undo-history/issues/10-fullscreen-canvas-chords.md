# 10: Full-screen canvas chords reach the world history

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a defect found by the Playwright canvas suite at close; the cause sits where the full-screen canvas, the shared chord listener and the surface registry meet, and it needs a browser to prove.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

Ctrl+Z and Ctrl+Y in the full-screen Locations Canvas undo and redo through the world history, as they do in the docked canvas and the lists (Q2, story 37). Today one press undoes nothing there: the Playwright canvas suite on main at `fa936bda` fails the nudge case and the line-up case on desktop and mobile. After four arrow nudges, Ctrl+Z left the node at the fully nudged position; after an align, Ctrl+Z left the node where the align put it.

Likely causes to rule out first: the full-screen canvas opens as a surface above the editor, so Q18 suppresses the chord; or the full-screen host mounts outside the editor's capture-phase listener; or the canvas's old chord reader was removed without the shared listener reaching the full-screen host.

Also triage the two failures that look unrelated to undo and either fix them here or record them in the spec's Backlog with their cause: a marquee selection counts 3 nodes instead of 4 on desktop, and the mobile undo test finds no implicit edges.

## Acceptance criteria

- [ ] In full-screen canvas, a run of arrow nudges within the pause undoes in one press; a line-up undoes in one press; Ctrl+Y puts each back.
- [ ] The docked canvas and the lists keep their behavior.
- [ ] `npm run test:e2e -- e2e/location-canvas.spec.ts` passes on desktop and mobile, with the wall-clock time recorded in the ticket's comments.
- [ ] The marquee count and the mobile implicit-edge failures are fixed or recorded in the spec's Backlog with their cause.
- [ ] A bench test covers the full-screen host's chord reaching the history, so the gates catch a regression without Playwright.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments

**2026-10-08, implementing session.**

- Cause: the editor's chord guard (from ticket 05) skips a key when the editor root sits under a modal's `pointer-events: none`. The full-screen canvas is a Radix modal, so every chord pressed in it was dropped. The window now carries `data-world-window`, and the guard tests the layer the key came from. A modal raised over the window still shuts the chords off.
- Line-up redo: the Q6 reveal made the revealed location the canvas's only selection, so Distribute had one box. Ruling Q35: a location already in the selection keeps the whole selection.
- Mobile implicit edges: the reveal pushes the location's detail over the map (ruling Q34: intended). The test now closes the panel after each move and waits for the map to slide back before it presses.
- Marquee count 3 of 4 (desktop): did not reproduce in 11 runs (6 alone, 5 in the full suite). Cause not found; recorded in the spec Backlog.
- `npx playwright test e2e/location-canvas.spec.ts`, desktop and mobile: before the fix 5 failed, 31 passed, 191 s wall. After: 36 passed, 4 skipped, 0 failed, 159 s wall.
