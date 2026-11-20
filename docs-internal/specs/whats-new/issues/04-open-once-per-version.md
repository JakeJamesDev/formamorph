# 04: Open Once Per Version

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

After an update, What's New opens by itself once for the new version, on every build target and channel. Other startup prompts wait their turn. The spec covers this in Q2, Q3, Q4, Q8, Q11 and Q16, and in the "Open-once rule" and "Startup ordering" decisions.

- **Record.** A per-device record holds the last version for which What's New opened. It lives beside the First-Time Flow records and is never exported.
- **Rule.** What's New opens when the record differs from the installed version. A fresh install records the version without opening. "Fresh" means the welcome intro has not been seen. A missing record alone does not mean fresh, because every existing player has no record when this feature first ships. Dev builds open it only through the dev route.
- **Ordering.** What's New waits for the welcome intro and the First-Time Flow step, as the event poster already does. While What's New is due or open, the event acknowledge poster and the main-menu tutorial stay held. They show after it closes.

## Acceptance criteria

- [x] Host tests: What's New opens once for a new version, stays closed on the next launch, and opens again for the next version. `MainMenu.whatsNew.test.tsx` "opens once for a new version, stays closed…, and opens again for the next version" (installed version mocked per launch).
- [x] Host tests: a fresh install records the version without opening, and an existing player with no record sees it open. "records the version without opening on a fresh install", "opens for an existing player with no record".
- [x] Host tests: the event acknowledge poster and the main-menu tutorial stay held while What's New is open, and show after it closes. "holds the event poster…", "holds the main menu tutorial…" (the appear delay restarts after close).
- [x] Each guard is proven to bite by reinstating its bug once. Nine mutants, each red on its own test: fresh-install skip, missing record, dev build, hold while open, record on open, intro wait, model-load wait, open-gate wait, load-time fetch (Q25).
- [x] The rule behaves the same on web, desktop and Android (one code path, no per-target branch). Read: `whatsNewDue` and the MainMenu effect have no target check; the desktop tests run the same path.

## Landed

**Not verified**
- The age gate wait (Q30) has no test. The age gate opens only from a player action, never at launch, so it cannot stack with What's New in a test without rigging.
- The CUDA notice hold (Q30) has no test of its own. The notice already stands down for any open dialog, and while What's New is only due the engine is not ready, so no test can tell the hold apart.

**For you**
- After the next update, launch once: What's New opens by itself after the menu loads, and the event poster and menu tutorial come after you close it. Launch again: it stays closed.
- On desktop with the built-in engine, What's New waits until the model has loaded (Q30 option A).
- Possible existing race, not from this ticket: on desktop the AI setup gate can open as "Your model didn't load" before the engine reports it is loading. The new gate test hit it with an engine stub that reports `stopped` first. Worth a check on a real first desktop launch.
