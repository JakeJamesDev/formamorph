# 04: Face call

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The AI picks a face for its answer.

- A fixed function, the face call, offered beside the guide lookup and the help dice roll while the mascot is on and at least one expression is enabled. Its one parameter is the face name; its enum is the enabled expressions' names. The capability gate of ADR-0008 applies; the reserved-name rule of ADR-0010 covers its name through the fixed-function list.
- Its handler yields a new session event naming the face. The answer events are unchanged. The trace records the call, so AI Context shows it.
- The window stores the face from the event and shows it at the first content token (Q30). A later call in the same answer swaps the face at once (Q12). The next send clears it (Q4).
- Ticket 03 landed a latch on the exchange that sets once its first content text arrives, because a function call mid-answer clears the text written before it. The stored face keys off that same latch, not off the text being non-empty.
- The function's description is new prompt text: the local arm reports how often the model sets a face on a plain help question, with an in-batch control.

Spec: Q1, Q4, Q12, Q30; Implementation → Help session, Window.

Recommended model rationale: a new fixed function across the session, the tool loop and the window, plus a probe.

## Acceptance criteria

- [x] The function is offered only with the mascot on, an enabled expression present, and an endpoint that takes functions; its enum changes when a layer is disabled.
- [x] A call yields the face event and a trace entry; two calls in one answer yield two events.
- [x] A face event before any content text keeps Thinking; the face shows at the first content token; a later call swaps at once; the next send clears it.
- [x] Probe numbers for the call rate on the local arm are in the ticket.
- [x] The four gates are green.

## Probe results

`testing/baseline/harness/help-face-probe.cli.ts`, 2026-10-03, local arm on MeroMero 31B (`g4-meromero-v2-31b-i1`), 3 runs per case per arm, arms interleaved. Default settings with the Mascot on. Control: the same request with the description cut to "Sets your face."

| Arm | Plain questions (5 × 3) | "Thanks, that fixed it!" (× 3) | Call first, before any text | Face names in answer text | Errors |
|---|---|---|---|---|---|
| app | 15/15 (100%) | 3/3 | 18/18 | 0/18 | 0 |
| bare | 10/15 (67%) | 3/3 | 13/13 of calls | 0/18 | 0 |

- The description lifts the call rate from 67% to 100%. Every call came before the answer text, so each set face shows from the first content token.
- Every call in both arms picked **Happy**. Every case got a friendly answer with a working fix or a thank-you back, so Happy fits "the mood of your answer" each time. For "a side character keeps showing up", the guide's **Removing One** section gave a clean fix. These cases cannot tell a fitting pick from a pick of the first face in the list. The probe now has case groups whose answers have other moods: outside the guide, a missing feature, a loss with no fix, and thanks.
- Each call costs one extra request round before the answer.
