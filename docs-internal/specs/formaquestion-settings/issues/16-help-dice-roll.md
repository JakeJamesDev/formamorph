# 16: Help dice roll

Status: done
Base: 63cac65a
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

- [x] The row shows after the guide lookup, off by default, with no edit, copy or delete action.
- [x] With the switch on, the answer request offers the function, and a roll round returns dice, rolls, modifier and total.
- [x] The gameplay roll's description and behavior are unchanged.
- [x] The probe numbers for both cases and the control are in this ticket's Handover.
- [x] A changelog line is in In Progress.
- [x] The four gates are green.

## Handover

**Built.** `HELP_ROLL` (`src/lib/formaquestion/helpRoll.ts`, id `help-roll`, name `roll`) spreads the catalog `ROLL`, so it shares its handler, parameters and empty result, and replaces the description and Offered To. It is a Tool, so ticket 15's `isTool` routing runs it on the question's world snapshot, which it does not read. Two device settings join the help settings value: `roll` (default off) and `rollCallLimit` (default `DEFAULT_TOOL_CALL_LIMIT`, 4, range 1 to 20; Q61). `HELP_LOOKUP_CALL_LIMIT_MAX` is now `HELP_CALL_LIMIT_MAX`, shared by both fixed functions. The help session offers `[lookup when on, roll when on, player Tools that are on]` where the endpoint takes function calls; the lookup prompt goes out only when the lookup is offered, and the roll is no source for Q51. `rollTool.ts` is untouched.

**Probe.** `testing/baseline/harness/help-roll-probe.cli.ts`, run on `g4-meromero-v2-31b-i1` (LM Studio). `/api/v0/models` showed it as the only loaded model, and the user chose it over Cydonia. Settings: roll on, lookup off, every other setting default. The control swaps in the catalog roll's description in the same batch, interleaved per case. 2 runs per case per arm; 6 roll cases, 6 plain cases (5 from `help-baseline-cases.json`, 1 dice question that asks for no roll).

| Arm | Roll: called | Roll: total in answer | Plain: called | Errors |
|---|---|---|---|---|
| help | 10/12 (83%) | 10/12 (83%) | 0/12 (0%) | 0 |
| catalog (control) | 6/12 (50%) | 6/12 (50%) | 0/12 (0%) | 0 |

- The help arm's two misses are both "Can you roll 3d6?", which the control also missed both times. The guide's Tools section, now with the **roll** row, reaches the request, and the model answers with the steps to turn the roll on, or says it cannot roll. This is a retrieval effect of an ambiguous "can you" question, not of the description.
- The control's other misses are "I need a 1d8+2 roll for my damage" (2/2, answered as stat code), "roll 4d6 please" and "Roll a d20 for me" (1/2 each).
- Every called run put the roll's total in the answer.

**Rebased onto ticket 15** (`1c012663`). `HELP_ROLL` joins `HELP_FIXED_FUNCTIONS`, so Q60 refuses `roll` as a Formaquestion Tool name. The Tools tab's fixed rows come from one table, and any other id is a player Tool switch. Rebased onto ticket 17 (`8092fcdb`): the help preset file gains a `roll` entry under `functions` (switch and Max Calls per Request), and a file without it is refused, as for the lookup.

