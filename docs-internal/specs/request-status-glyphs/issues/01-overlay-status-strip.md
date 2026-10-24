# 01: Overlay Status Strip

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a layout change across two layouts and mobile, with a new shared component that tickets 02 and 04 build on.

## What to build

The turn request row, the Tool status row and the background pass row render through **one shared status-row component**. This ticket owns that component. It has a glyph slot (empty for now), the label, and the existing indeterminate bar. Ticket 02 fills the slot and ticket 04 adds the timer.

The row leaves the footer flow (Q12). It renders as a full-width strip that floats over the bottom edge of the narration, anchored to the top of the footer, on a short fade from the panel background (Q13). The footer's height never changes when the row appears or goes, so the Pager, the like prompt, the location suggestion and the action box never move. Pages and Chat behave the same (Q14). The narration gets no reserved padding (Q15). **Show Silent Requests** keeps gating the Tool and background rows. Label text does not change.

The strip is a new visual pattern (ADR 0008). It gets a showcase entry, and the user approves it in the app.

How-to-Play's "status line above the box" line becomes stale. Update it to say where the strip shows.

Spec: Q12–Q15; stories 23–28, 29, 30.

## Acceptance criteria

- [ ] All three rows render through the shared component; the GameViewer reroll tests and the BackgroundPassStatus tests pass unchanged
- [ ] The footer's height is the same with a request running and with none, in Pages and Chat (a DOM read of the footer's height in both states)
- [ ] With **Show Silent Requests** off, no Tool row and no background row shows
- [ ] The strip has a showcase entry in the design-system dev route
- [ ] Frames: `.scratch/frames/strip-pages-desktop-light.png`, `strip-pages-desktop-dark.png`, `strip-chat-desktop-light.png`, `strip-pages-mobile-dark.png`, each with a request running over narration text
- [ ] How-to-Play's status-line text matches the new placement; changelog fragment written

For you: approve the strip in the app (ADR 0008), desktop and mobile, by starting a turn in Pages and in Chat.
For you: judge how much the strip hides of the newest streamed line during Narration (the Q15 trade-off).
