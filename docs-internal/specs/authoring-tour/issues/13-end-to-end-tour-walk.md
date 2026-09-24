# 13: End-to-End Tour Walk

Status: ready-for-human
Base: 3254dc74
Blocked by: 06, 08, 09, 11
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Authoring Tour](../spec.md)

**What to build:** One Playwright spec walks the whole tour as a new author, in a real browser:

1. From the main menu, create a new world.
2. Accept the offer.
3. Complete every step with **Use Example**.
4. Press **Play**.
5. Check that the game starts in The Tidewell.

It is the one check that the tour still works from start to finish after UI changes.

**Rationale for the model:** one test spec on an existing suite pattern. Sonnet at medium effort.

## Acceptance criteria

- [x] The spec follows the enter-world end-to-end spec's setup: fresh storage and no model server needed.
- [x] It asserts the counter on every step and that **Next** is disabled before **Use Example**.
- [x] It asserts that In Play shows the marked example text on at least one step per tab.
- [x] After **Play**, the game view shows The Tidewell as the current location.
- [x] The spec runs with `E2E_PORT=5221`. Before the run, confirm that no other checkout's server holds that port.
- [x] Run it three times in a row with no failure. Report each run's time.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. `test:e2e` stays outside the gates.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.

## Comments

- **Ruling from the spec session (2026-09-23):** Add gives a location, entity or stat the default name "New Location", "New Entity" or "New Stat", and a default name counts as a value. So **Next** opens enabled on `location-name`, `entity-name` and `stat-name`, and the spec asserts that. Every other field step opens with **Next** disabled. Ticket 17 makes default names stop counting and flips those three assertions.
- **Model calls:** Play starts the opening narration. A `page.route` stub answers `chat/completions` and the model list, the same way `opening-narration.spec.ts` does. Without it, the "Can’t reach your endpoint" dialog covers the game view.
- **Mobile:** the spec skips the mobile project. In Play sits behind **Show Effect** there, and ticket 12 covers that path.
- **Add steps:** most add steps have no **Use Example**, so the walk presses the step's **+** button, the way the step's body asks. `add-second-location` presses **+** and then uses its example.
- **In Play check:** a tab passes when In Play marks, in full, a value that a Use Example wrote. A default name or a partial mark does not count.
- **Evidence:** five mutations each failed the spec at the matching assertion: an always-complete AI-Facing Description, In Play without `<mark>`, marks one character short, an off-by-one tour bar counter, and a start-location pick that skips starting locations. Before the runs, `netstat` showed no process listening on 5221. The runs after review are recorded in the next comment. Gates at first commit: typecheck, lint, 774 test files (120.7 s, 122 s wall) and build all passed.
- **After review (2026-09-23):** the In Play check now matches example text exactly, and the note counter matches exactly. Three runs in a row on `E2E_PORT=5221`, with no listener on the port first, passed in 12.7 s, 13.1 s and 13.0 s per test (31–32 s wall with server start). Open follow-up, not fixed here: `mockModel` is now the third near-copy of the model stub in `opening-narration.spec.ts` and `open-chat.spec.ts`, and could move to `e2e/app.ts`.
