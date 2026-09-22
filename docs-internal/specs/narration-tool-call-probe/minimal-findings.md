# Minimal Local Tool Diagnostic

## Outcome

**Stronger-model follow-up:** `g4-meromero-31b` completed native lookup-to-`write` in both trials with a three-minute request timeout. See [MeroMero rerun](#meromero-rerun). This verifies the minimal flow on that loaded model, not the full narration prompt.

**Follow-up:** The local ID compatibility fix removed the continuation error in both new trials. Both retrieved Bram's description and generated a sentence using it, but neither called `write`. See the [compatibility rerun](#compatibility-rerun) below; the original failure remains preserved here.

Rocinante produced a native `request_info({"term":"Bram"})` call under the short prompt. The harness retrieved Bram's full description and sent it back. LM Studio rejected that continuation before generation: its template required nine-character alphanumeric tool-call IDs, but the first response supplied a 32-character ID.

The batch stopped on the endpoint rejection after one trial, as designed. No `write` call or narration was produced; the second planned trial did not run. This demonstrates initial native tool calling in this configuration, but not a completed lookup-to-write loop.

## Request

System:

> Use the available function tools to complete the task. First call request_info for the requested entity. After receiving its description, call write with one sentence that uses a specific fact from that description.

User:

> Look up Bram, then write one sentence about him using his full description.

The request used the existing `request_info` and `write` schemas, automatic tool choice, model `rocinante-x-12b-v1`, seed `424242`, `reasoning_effort: "none"`, non-streaming output, and a 1,024-token response cap. Temperature and repetition penalty were omitted. The endpoint was `http://127.0.0.1:1234/v1/chat/completions`.

Run with `npm run probe:narration-tools -- --minimal-tools rocinante-x-12b-v1`.

## Observed flow

| Step | Observation | Request duration |
|---|---|---:|
| Initial generation | Native `request_info`, term `Bram`, empty prose, finish reason `tool_calls` | 1,384.85 ms |
| Local lookup | Full authored description returned, including right arm, pinned left sleeve, and brass ear ring | Local operation |
| Continuation | HTTP 400 during template/parser setup | 36.80 ms |

The response assigned call ID `XzqhWe3szx8LmnhRyU9cKqa2xeaRKNn4`. The next request preserved that ID in both the assistant call and its tool result. The server error included:

> Tool call IDs should be alphanumeric strings with length 9!

Recorded batch time: **1.431 seconds**. Full CLI wall time: **23.689 seconds**, including startup and serialization. The successful generation reported 188 prompt tokens and 29 completion tokens (217 total); the rejected continuation reported no usage.

## Interpretation

The [full narration batch](local-findings.md) produced no tool calls in four trials. This shorter request produced a native lookup on its first trial. That weakens any model-wide claim that Rocinante cannot call tools. It does not isolate which prompt instruction or context length caused the change, and one successful initial call is not a reliability estimate.

The immediate continuation failure is an observed mismatch between the server-issued ID and the template's validation. A separate follow-up could replay the continuation with a consistent nine-character ID on both messages to test that diagnosis. This run did not change IDs, templates, or server settings.

## Evidence

- [Raw transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/minimal-batch-2026-09-22T10-38-31-181Z.json)
- Source base: `44da244d9b65c95c581ded0c1a71db965f679b5b`; the minimal diagnostic additions were working-tree changes when executed.
- SHA-256: `05610eef7eac93d1f57934e72452acf72d573691e223bcd18bc242e07ad7792c`

The transcript preserves both exact requests, the native response, the lookup result, and the endpoint error. Raw runs are local, gitignored artifacts.

## Harness verification

- Focused suite: 29 tests passed in 7.612 seconds wall time. Core probe coverage: 96.28% statements/lines, 84.76% branches, 100% functions; CLI coverage was not measured, but its new mode was exercised by the live run.
- Mutation check: disabling minimal prompt selection failed the new test on its initial-system-message assertion in 3.695 seconds. The source was restored before the full suite.
- Typecheck: exit 0, 24.173 seconds. Lint: exit 0, 21.728 seconds, with one warning in unchanged `WorldOverviewManager.tsx`.
- Full tests: exit 0, 12,527 passed and three skipped, 114.186 seconds wall time (113.06 seconds reported by Vitest).
- Build: exit 0, 27.441 seconds, with the bundle-size warning.

No production prompt, world/save export shape, or version changed.

## Compatibility rerun

The local probe now assigns distinct nine-character alphanumeric IDs to outgoing assistant calls and matching tool results. Mapping is stable across the accumulated conversation. Original responses and lookup evidence retain the server-issued IDs. Cloud requests remain unchanged. The same minimal command ran twice with the same prompt, model, seed, and sampler settings as before.

| Trial | Lookup | Continuation | Native `write` | Duration | Total tokens |
|---|---|---|---|---:|---:|
| minimal-1 | `request_info("Bram")` | Accepted; prose returned | No | 1,496.72 ms | 542 |
| minimal-2 | `request_info("Bram")` | Accepted; prose returned | No | 1,187.89 ms | 542 |

Both continuations used `000000001` for the assistant call and its result. Both returned identical prose:

> Bram is the ferryman of the river crossing, a one-armed man with weathered features who speaks in brief, matter-of-fact sentences and never crosses to the other side after dark.

Those details came from the returned description, which was absent from the initial minimal prompt. The ID fix therefore restores the lookup round trip in this sample. Both trials still correctly fail with `missing_write`; the harness does not convert prose into a synthetic tool call. This does not establish reliability beyond these two trials.

Batch time was **2.685 seconds**; CLI wall time was **21.477 seconds**. Four requests reported 944 prompt tokens and 140 completion tokens, 1,084 total.

- [Compatibility rerun transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/minimal-batch-2026-09-22T10-57-01-902Z.json)
- Source base: `2da147ea`, plus the working-tree ID fix.
- SHA-256: `a2b97caeb1278e06d58fdc557ddcaefea94f615405deb966658b71ad381f6e3c`
- Focused suite: 30 passed, 6.266 seconds; core probe coverage 96.38% statements/lines, 85.25% branches, 100% functions. An initial fixture omitted the required empty content field and failed in 7.484 seconds; correcting the response envelope retained the long-ID collision scenario.
- Disabling the fix failed the new ID-format assertion in 3.480 seconds; the source was restored before the full gate run. The test exercises batched and sequential calls, ID collisions, matching results, stable history, and unchanged raw evidence.
- Rerun gates all exited 0: typecheck 20.918 seconds; lint 19.933 seconds (same existing warning); full tests 12,528 passed, three skipped in 106.364 seconds wall time; build 25.903 seconds (bundle-size warning). Graph refresh was launched separately.

## MeroMero rerun

The loaded model was `g4-meromero-31b`. The initial rerun with the 60-second limit timed out on the first trial's first request; the second trial completed lookup-to-`write` in 12.270 seconds. That batch's CLI wall time was 86.768 seconds. [Initial transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/minimal-batch-2026-09-22T11-25-13-114Z.json).

At the user's request, local CLI runs now allow **180 seconds per request** and record that limit in batch evidence. The prompt, tools, automatic tool choice, seed, and other request settings stayed the same. Both fresh trials then succeeded:

| Trial | Lookup request | Write request | Full trial | Result |
|---|---:|---:|---:|---|
| minimal-1 | 9.776 s | 62.799 s | 72.581 s | Native lookup and native write |
| minimal-2 | 6.103 s | 25.841 s | 31.949 s | Native lookup and native write |

Both `write` calls submitted:

> Bram, the broad and weathered ferryman with a brass ring in his left ear and only one arm, refuses to cross the river after dark.

The left-ear detail was absent from the initial prompt and present in the tool result. Both runs returned empty ordinary content and submitted narration through the native `write` call. One continuation exceeded the old 60-second limit. The observed latency difference is not diagnosed by this probe; verification commands were also running on the host, so these timings are not a controlled model-speed benchmark.

The batch took **104.531 seconds**, with **120.828 seconds** CLI wall time. Each trial reported 427 prompt tokens and 63 completion tokens (490 total); the batch total was 980 tokens. Two successes demonstrate the minimal flow, not a production reliability rate or success with the full narration prompt.

- [Three-minute-timeout transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/minimal-batch-2026-09-22T11-27-37-645Z.json)
- Source base: `cb6b0782`, plus the local timeout change.
- SHA-256: `6416c9edc6c00675d0c30fb42ec1eb68e4fb95edc4abf5e419ed6b2770b62edb`

Timeout-change verification: typecheck exited 0 in 15.787 seconds; lint exited 0 in 17.272 seconds with the existing warning. The first full suite, concurrent with inference, failed four UI tests (including two timeouts) in 102.191 seconds. With inference finished and no test changes, the rerun exited 0: 12,528 passed, three skipped in 93.035 seconds. Build exited 0 in 19.814 seconds with the bundle-size warning. Graph refresh completed. The rerun suggests timing sensitivity but does not establish the failures' root cause.
