# 08: Sources collapse

Status: done
Base: 9e8df9af
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Sources list of an answer collapses (Q46).

- Each answer owns its open state. A click changes that answer only, so the conversation does not reflow.
- A click also writes a default, stored on the device. Later answers start in that state.
- An answer takes the default at the moment its sources arrive, not when the question is sent.
- Nearest Sections on a flagged answer uses the same default.
- The collapsed header shows the count.
- The first default is open, which is the behavior of today.
- There is no settings row. The chevron is the only control. It is a small plain chevron with no button outline and no hover fill, as in the guide's contents list.

Build the per-answer state and the stored default as one small reusable rule, because the Thinking block (ticket 09) uses it with a second stored value.

This ticket does not change the help request, so it can start before Formaquestion ticket 46 reports.

Recommended model rationale: a small component change with one stored value and clear rules.

## Acceptance criteria

- [ ] A click on one answer's Sources header changes that answer and no other.
- [ ] An answer that arrives after a click starts in the clicked state.
- [ ] A click made while an answer is still writing applies to that answer when its sources arrive.
- [ ] The default survives a remount, and a bad stored value reads as open.
- [ ] Nearest Sections follows the same default.
- [ ] The collapsed header shows the count and is reachable by keyboard, with the expanded state exposed to assistive technology.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
