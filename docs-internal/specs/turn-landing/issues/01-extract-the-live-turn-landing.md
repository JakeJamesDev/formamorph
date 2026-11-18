# 01: Extract The Live Turn Landing

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The live turn lands through the Turn Landing module, and the game plays exactly as before. This is a prefactor: no player-visible change.

- The Turn Landing is a plain async operation outside React, placed with the Turn Pipeline after the commit computation (spec, Implementation Decisions; ADR-0019).
- It owns every step from the During AI Output writes to the armed snapshot and the cleared before-box undo, in the order the spec lists for live mode (Q5).
- The game view passes one effects port: its existing domain operations, as trusted callbacks. Pure helpers are direct imports of the module. Values that can change across an await are read through the port at the moment of use.
- The move offer, the reveal hold, the Stop check after the reveal, the turn count, the started flag and the scene image stay in the game view (Q5).
- This ticket owns the module, the port type and the recording fake port that later tickets' tests use. It takes a mode input with one mode, live; ticket 02 adds the stat re-roll.
- The stat re-roll and the choices re-roll are not touched.

## Acceptance criteria

- [ ] The live turn's landing runs through the Turn Landing; the game view holds no second copy of the live order.
- [ ] An interface test with the recording fake port asserts the full live order from the spec, step by step.
- [ ] An interface test shows the wait for stat code falls after time passes and before the code writes merge; moving the wait fails it.
- [ ] An interface test shows a Stop signal raised during the landing still lands every step and only gates the choices, as today.
- [ ] No existing test expectation changed. Any that had to change is listed in the Landed section as a finding.
- [ ] The module imports nothing from React and nothing from the game view.
- [ ] World and save `.json` shape unchanged.
- [ ] No changelog fragment: nothing a player can see changed.

For you: play three turns in a world with scripts, an Inventory pass and a follower, with one move, and check the turn log, stat bars and choices read as before.
