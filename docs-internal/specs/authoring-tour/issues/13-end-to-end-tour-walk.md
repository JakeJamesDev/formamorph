# 13: End-to-End Tour Walk

Status: ready-for-agent
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

- [ ] The spec follows the enter-world end-to-end spec's setup: fresh storage and no model server needed.
- [ ] It asserts the counter on every step and that **Next** is disabled before **Use Example**.
- [ ] It asserts that In Play shows the marked example text on at least one step per tab.
- [ ] After **Play**, the game view shows The Tidewell as the current location.
- [ ] The spec runs with `E2E_PORT=5221`. Before the run, confirm that no other checkout's server holds that port.
- [ ] Run it three times in a row with no failure. Report each run's time.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. `test:e2e` stays outside the gates.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
