# 06: Code Test Function

Status: ready-for-agent
Blocked by: 02 — Pin The Quick Reference On Code Turns; 03 — Clock Field Errors; 04 — Whole-Stat Comparison Errors
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new fixed function across the help session, settings, executor and docs, with a data-boundary ADR; the largest slice.

## What to build

A player on an endpoint that takes function calls asks Morphie for stat code. Before she answers, she calls a fixed function with `code`, `box` (before or after) and `stat` (the stat the code belongs to, read as `self`; an unknown name gives a blank `self`). The function runs the stat-code analysis and a Test Code run on the open world's snapshot and returns the errors, warnings, returned value, every write and every dropped write. It applies nothing. With no world open it still runs; unknown stat, trait and placeholder names are not flagged, while syntax, clock and comparison errors are. She may call it 3 times per answer by default; after the last failing call she gives her best code and names the remaining error. The function is offered on code turns only, has its own switch and call limit in the help settings (default on), and its description carries the call guidance in the Purpose / Use when / Input / Output form. The sandbox engine loads on first call. Each call and result shows in AI Context. The glossary's Formaquestion entry says the code test reads the open world, and a new ADR records that an app-internal function may do so when its purpose needs it.

## Acceptance criteria

- [ ] On a code turn with the switch on and a tool-capable endpoint, the function is offered; off, on a non-code turn, or on an endpoint without function calls, it is not
- [ ] A call with a world returns analysis errors, run result, writes and dropped writes, and the world is unchanged
- [ ] A call with no world skips name checks and still reports syntax, clock and comparison errors
- [ ] The call limit holds at 3 by default and follows the setting
- [ ] The help bundle does not load the sandbox engine until the first call
- [ ] Tool rounds appear in the request trace
- [ ] Glossary entry amended and ADR added
- [ ] Changelog fragment written
