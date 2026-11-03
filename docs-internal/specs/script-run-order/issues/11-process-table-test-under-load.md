# 11: Process Table Test Under Load

Status: ready-for-agent
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
