# 10: Full-screen canvas chords reach the world history

Status: ready-for-agent
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
