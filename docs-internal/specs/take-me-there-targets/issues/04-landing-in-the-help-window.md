# 04: Landing in the Help Window

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q4, Q5, Q9.

## What to build

The help window opens some surfaces itself: its own settings tabs and AI Context. A Take Me There answer about one of their controls lands on it with the shared hook. Every Formaquestion how-to section that ends at a control gets its target and registry entry. The Mascot tab's off-state link to General, which already lands on the Mascot row with the pulse through the pulse helpers directly, moves onto the shared hook (Q9).

## Acceptance criteria

- [x] Help settings tabs and the window's view tabs land a target: scroll, focus, pulse once. AI Context registers no target (Q10): its one how-to ends at opening the dialog, so it lands on the dialog as before
- [x] A missing target lands on the tab silently
- [x] Every Formaquestion how-to section that ends at a control carries a target; the report-only check lists none for that page
- [x] The General link lands through the shared hook with the same scroll, focus and pulse as before
- [x] Docs checks and the existing Take Me There tests stay green
