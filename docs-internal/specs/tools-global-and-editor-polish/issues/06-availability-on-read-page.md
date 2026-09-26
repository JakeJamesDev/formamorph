# 06: Availability Moves to the Read Page

Status: ready-for-human
Base: e1d604d5
Blocked by: 04, 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: moves two controls between existing surfaces and deletes a tab; the ToolsTab harness tests are prior art.

## What to build

The Tool editor has three tabs: Definition, Parameters, and Handler. The Availability tab is gone. On the read page, beside Enabled, the player sets Offered To with the same multi-select from ticket 01 and sets Max Calls per Request with a small number input. Both write live, like Enabled, with no Save step. The read page's summary line no longer lists the prompts, and it reads "max N calls per request". A built-in Tool has no Edit action, since its definition is locked and everything it can change lives on the read page. Duplicate stays. The locked-fieldset editor path for built-in Tools is removed.

## Acceptance criteria

- [ ] The editor shows Definition, Parameters, and Handler only; no Availability tab, no built-in notice pointing to it
- [ ] The read page shows Enabled, Offered To (multi-select, Select All, "All Prompts", "No Prompts"), and **Max Calls per Request** with the hint "Leave blank for the default of 4"
- [ ] Offered To and Max Calls write live: a user Tool writes its definition, a catalog Tool writes the global catalog override
- [ ] The summary line drops the prompt list and says "max N calls per request"
- [ ] Edit is absent for a built-in Tool; Duplicate still works
- [ ] The editor's locked mode and its tests are removed
- [ ] Harness tests cover the live Offered To write on a user and a catalog Tool, the live Max Calls write, the absent Edit on a built-in, and the absent tab; each fails when its behavior is removed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
