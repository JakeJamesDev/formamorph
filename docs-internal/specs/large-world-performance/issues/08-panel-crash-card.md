# 08: Panel Crash Card

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: reuses ticket 07's boundary; adds the approved card and its Design-System entry.

## What to build

A crash in one World Editor panel shows a card in that panel only (Q3, Q15). Boundaries wrap each tab body, the detail panel, the Locations Canvas and the Test Bench. The card, approved from a mock: warning icon, title "This Panel Stopped Working", line "Your unsaved edits are kept. Try again, or view the details to report the problem.", buttons View Details (opens the existing Error Details dialog with Copy and Report Bug) and Try Again (remounts the panel). Edits live in the data provider, so they survive.

The card is a new Design-System pattern: add it to the Design System guide with a showcase entry and a dev route. One changelog fragment, Minor Added, 👤.

## Acceptance criteria

- [ ] World Editor bench: a throwing detail panel shows the card; the tree and tabs still work.
- [ ] Try Again remounts the panel; with the fault cleared, it renders normally.
- [ ] An edit made before the crash is still in the world after Try Again.
- [ ] View Details opens the Error Details dialog with the panel's error.
- [ ] The card appears in the Design System guide and showcase.
- [ ] Verified in the preview in both themes.
- [ ] Guard bites: removing the panel boundary makes the bench test show the root screen instead (red).
- [ ] Four gates green.
