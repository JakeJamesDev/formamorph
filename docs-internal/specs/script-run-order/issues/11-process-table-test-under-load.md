# 11: Process Table Test Under Load

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Found by this effort's close gate, and unrelated to scripts. Ruling: Q59.

## What to build

`listProcesses` returns this process's row under a loaded machine as it does on an idle one, or reports why it can't. The test failed with `expected undefined to be <ppid>` in the full suite and passes alone in 6 s.

## Acceptance criteria

- [ ] A failing run reproduces the missing row under load before any fix. If it can't, report that to the spec session with what was tried.
- [ ] The cause is fixed. The test keeps its real process table and its assertion, with no added retry that hides a real miss.
- [ ] The full `electron/llamaServer.test.mjs` file passes under the same load.

## Landed

The failure never reproduced, and its cause is unproven. Ruling Q66 shipped the Q63 hardening instead: `listProcesses` rejects with an Error naming the cause (start failure, spawn error, timeout, non-zero exit) where it resolved `[]` or a partial table. A future miss now names its cause. The real-table test and its assertion are unchanged.

Tried, none reproduced: 8 busy-loop node processes for 75 s with the file run 5 s in (27 passed, 2 skipped), and 12 concurrent `listProcesses` calls (all returned this pid in under 1 s).

**Not verified**
- Criterion 1: no failing run was reproduced under load.
- Criterion 2: the cause is unproven. Tests cover each rejection cause (`electron/llamaServer.test.mjs`, "listProcesses failure causes"), and `electron/llmEngine.test.mjs` "stays ready with no pid when the process listing rejects" covers the caller. The timeout test was shown to fail with its guard off.
- Criterion 3: the file passed under the 8-process load, but that load never produced the original failure, so it is not "the same load".

**For you**
- Watch the next full-suite run on a loaded machine. If the test fails again, its message now names the cause.
