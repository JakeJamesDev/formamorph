# 18: AI Context

Status: done
Blocked by: 03, 05
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A power user, and the developer, see what the app sent for each help question (Q13, Q14, Q15, Q19, Q22, Q30).

**The trace.** The help session reports a trace for each question, as an added event. The answer events do not change.

- the search: each source's ranking, the merged order, and the sections sent
- the open Surface, and whether Use the Open Screen was on
- each request: the pick request, the answer request, and each tool round, with the request body, the endpoint details, the reasoning text and the response
- the active help preset's name, and whether a prompt differs from the default

The window keeps the traces in memory with the conversation. They are recorded always. Clear removes them. They do not persist.

**The switch.** A **Show AI Context** switch on the General tab, default off.

**The button.** With the switch on, the Formaquestion header shows an AI Context button, on desktop and on the mobile sheet.

**The popup.** A separate dialog with the layout of the game view's AI Context. The help window stays above it.

- The questions of the conversation, newest first.
- Each question holds a Search block and its request cards. The cards are the shared card from ticket 03.
- The Search block shows, for each source that was on, its top sections in order, then the merged order, with the sections that reached the model marked.
- On mobile it opens full screen, and the sheet hides while it is open, by the rule ticket 05 builds for the settings modal (Q52).

**What ticket 03 left for this ticket.**

- The shared request card takes the record, its index, the folded state, the section open state and its handler, and a text renderer. The caller owns the collapse state.
- The card has no place yet for the samplers or for a custom-prompt mark. The record's endpoint details carry no sampler values. Extend the shared card with an optional slot for header chips, or widen the endpoint details; do not fork the card. The game view's AI Context must look the same after the change.

The dialog reports to the surface registry and has a dev-route entry. The General docs section gains the switch, and the Formaquestion docs page gains an AI Context section.

Recommended model rationale: a new event through the help session, a record per request across two request kinds and tool rounds, and a second caller of the request card.

## Acceptance criteria

- [ ] The button shows only with the switch on.
- [ ] A question with AI Picks on shows two request cards; a lookup question also shows its tool rounds.
- [ ] The Search block lists each source's ranking and the merged order, and marks the sections sent.
- [ ] A question asked before the switch went on shows in the popup.
- [ ] Each card shows the endpoint, the samplers and the reasoning state of that request.
- [ ] A custom prompt is marked on its request.
- [ ] The help window stays usable above the popup (Playwright, static frames).
- [ ] Clear empties the popup; an unmount leaves no timer or fetch behind.
- [ ] With the switch off, the answer events and request bodies equal those of ticket 05.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
