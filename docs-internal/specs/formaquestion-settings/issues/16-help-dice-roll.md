# 16: Help dice roll

Status: ready-for-agent
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Tools tab lists a dice roll, off by default (Q47).

- The roll is a fixed function of Formaquestion, second in the list after the guide lookup. The player cannot edit, copy or delete it.
- It reuses the catalog roll's handler, its parameters and its empty result.
- It joins the Tools tab's fixed functions, which ticket 14 passes as one prop. Its switch and its Max Calls per Request are device settings beside the lookup's (Q59).
- It has its own description. The catalog roll's description is written for narration ("roll before you narrate the outcome"), and a help request has no story. The new description is a positive contract with no narration words, and it names no sample value a small model can copy beyond what the parameter needs.
- The gameplay catalog roll does not change.

**Probe.** The description is prompt text, so it ships with numbers. The default cloud endpoint rejects functions, so the probe runs on the local arm (Cydonia). Check what is loaded before the run.

| Case | Measure |
|---|---|
| The player asks for a roll | Share of runs in which the model calls the function, and uses the total |
| A plain help question | Share of runs in which the model calls the function (should stay near zero) |

Each batch carries its own control: the same cases with the catalog roll's description. At least 2 runs per case.

The Tools docs section gains the row.

Recommended model rationale: new prompt text with a probe and an in-batch control.

## Acceptance criteria

- [ ] The row shows after the guide lookup, off by default, with no edit, copy or delete action.
- [ ] With the switch on, the answer request offers the function, and a roll round returns dice, rolls, modifier and total.
- [ ] The gameplay roll's description and behavior are unchanged.
- [ ] The probe numbers for both cases and the control are in this ticket's Handover.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
