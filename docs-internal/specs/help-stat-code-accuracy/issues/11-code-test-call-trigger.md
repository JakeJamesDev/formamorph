# 11: Code Test Call Trigger

Status: done
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

- [x] The rider carries the test-first line only when the code test is offered; the rider text without it is byte-identical to today
- [x] Existing rider tests hold, including the no-member-names rule
- [x] Trigger probe run on MeroMero: five known cases × 2 runs, test arm only, calls per answer recorded in the ticket
- [x] On a trigger, 08 is told to run; on no trigger, the numbers are reported to the spec session and the ticket lands without a default change
- [x] Changelog fragment written if the rider line ships

## Results

**The line.** `- Before you answer, test the block with the \`test_stat_code\` function. Fix each error and dropped write it reports.` It ends the rider only while the code test is offered. With a cleared **Code** prompt, it goes alone after the user message (Q35). The function's description is unchanged.

**Trigger probe (2026-10-05).** MeroMero v2 31B (`g4-meromero-v2-31b-i1`, 8192 context loaded), the only model on LM Studio. 08's harness from `e8a42601`, run in the ticket worktree and not committed. Test arm only, `reasoning_effort: "none"`, one request at a time. 10 questions in 159 s, 0 failed.

```bash
npx vite-node testing/baseline/harness/help-code-probe.cli.ts -- --tools --arms test --endpoint http://127.0.0.1:1234/v1/chat/completions --model g4-meromero-v2-31b-i1 --runs 2 --parallel 1 --only prowler-at-night,seasoned-after-two-weeks,seasoned-on-persona,brave-at-courage,quotes-pin
```

| Case | Tested | Calls per answer | Last call clean | Pass |
|---|---|---|---|---|
| prowler-at-night | 2/2 | 1.0 | 2/2 | 2/2 |
| seasoned-after-two-weeks | 2/2 | 1.0 | 2/2 | 2/2 |
| seasoned-on-persona | 2/2 | 1.0 | 2/2 | 2/2 |
| brave-at-courage | 2/2 | 1.0 | 2/2 | 2/2 |
| quotes-pin | 2/2 | 1.0 | 2/2 | 2/2 |
| **Total** | **10/10** | **1.0** | **10/10** | **10/10** |

- Against 08's baseline of 0 calls in 65 answers, the line triggers a call on every answer. The ticket lands, and 08 runs its full arm.
- 2 runs per case set no pass rate. The persona and brave cases that missed in 08's batch passed here; 08's arm measures that.
