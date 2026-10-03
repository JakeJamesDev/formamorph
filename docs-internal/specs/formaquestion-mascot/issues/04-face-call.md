# 04: Face call

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The AI picks a face for its answer.

- A fixed function, the face call, offered beside the guide lookup and the help dice roll while the mascot is on and at least one expression is enabled. Its one parameter is the face name; its enum is the enabled expressions' names. The capability gate of ADR-0008 applies; the reserved-name rule of ADR-0010 covers its name through the fixed-function list.
- Its handler yields a new session event naming the face. The answer events are unchanged. The trace records the call, so AI Context shows it.
- The window stores the face from the event and shows it at the first content token (Q30). A later call in the same answer swaps the face at once (Q12). The next send clears it (Q4).
- The function's description is new prompt text: the local arm reports how often the model sets a face on a plain help question, with an in-batch control.

Spec: Q1, Q4, Q12, Q30; Implementation → Help session, Window.

Recommended model rationale: a new fixed function across the session, the tool loop and the window, plus a probe.

## Acceptance criteria

- [ ] The function is offered only with the mascot on, an enabled expression present, and an endpoint that takes functions; its enum changes when a layer is disabled.
- [ ] A call yields the face event and a trace entry; two calls in one answer yield two events.
- [ ] A face event before any content text keeps Thinking; the face shows at the first content token; a later call swaps at once; the next send clears it.
- [ ] Probe numbers for the call rate on the local arm are in the ticket.
- [ ] The four gates are green.
