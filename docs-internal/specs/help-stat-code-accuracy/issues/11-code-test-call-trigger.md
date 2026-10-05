# 11: Code Test Call Trigger

Status: ready-for-agent
Blocked by: 10 — Half-Built World In Code Test
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prompt change (rider line) plus a short trigger probe on a local model; the bar is "the model calls the function", not answer quality.

## What to build

On a code turn where the code test function is offered, Morphie calls it before she answers. Ticket 08's probe on MeroMero v2 31B showed 0 calls in 65 answers while `set_face` was called every time, so the function's description alone does not trigger a call. This ticket reopens Q20 on that evidence: the Code rider gains one line, present only when the function is offered, that tells the model to test the code with the function before answering and to fix what it reports. The rider without the function is unchanged. The function's description may be tightened in the same pass.

Then a **short trigger probe** on MeroMero (the only model loaded, `reasoning_effort: "none"`): the five known cases, 2 runs each, test arm only. The measure is calls per answer. The user ruled the check short: no 30-minute run to find out whether the tool fires at all.

- Calls on most answers: the ticket lands, and 08 runs its full arm.
- Still near zero: stop, record the numbers, and report. Do not tune further inside this ticket.

## Acceptance criteria

- [ ] The rider carries the test-first line only when the code test is offered; the rider text without it is byte-identical to today
- [ ] Existing rider tests hold, including the no-member-names rule
- [ ] Trigger probe run on MeroMero: five known cases × 2 runs, test arm only, calls per answer recorded in the ticket
- [ ] On a trigger, 08 is told to run; on no trigger, the numbers are reported to the spec session and the ticket lands without a default change
- [ ] Changelog fragment written if the rider line ships
