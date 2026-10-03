# 14: Tools tab and the guide lookup switch

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player with a local model turns on the guide lookup, which is lookup mode (Q2, Q12, Q33, Q37).

**The tab.**

- The Tools layout of the regular Settings: the list with a switch on each row, and the read view of the selected row. The Tools tab component already takes its lists, switches and handlers as props; make what is still tied to the gameplay preset a prop.
- One row in this ticket: the **guide lookup**. Its switch is lookup mode, default off. The read view shows its description, its parameters and Max Calls per Request.
- The row is fixed: the player cannot edit, copy or delete it. The docs lookup stays an app-internal function, outside the Tool catalog.
- "Offered To" does not show here, because one request takes the functions.
- The preset select of the regular Tools tab does not show here: the switches are device settings.
- When the answer endpoint does not take function calls, the tab says so, and no function is sent.
- The Tools switch in Settings → Output is not read.

**The help session** offers the functions that are on, when the capability check of the resolved answer endpoint passes. The lookup's call limit comes from the settings.

The Tools docs section is written here.

Recommended model rationale: a second caller for the Tools tab component and a rule that must stay apart from the global Tools switch.

## Acceptance criteria

- [ ] The switch on, with an endpoint that takes function calls, sends the lookup prompt and the function.
- [ ] The switch on, with an endpoint that does not, sends the retrieval request with no function, and the tab shows the notice.
- [ ] The Output → Tools switch off does not change either result (the existing guard test still passes).
- [ ] Max Calls per Request limits the lookup rounds.
- [ ] The guide lookup row has no edit, copy or delete action.
- [ ] The regular Tools tab looks and works as before; its tests pass with no edit to an assertion.
- [ ] With the defaults, the request bodies equal those of ticket 05.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
