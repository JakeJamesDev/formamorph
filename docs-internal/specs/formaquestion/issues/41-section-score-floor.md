# 41: Score floor for extra sections

Status: ready-for-agent
Blocked by: 38
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A weak match stops riding along after a strong top hit (Q69). Ticket 40 found that guide sections that look like answers, but score far below the top hit, draw the cloud model away. `worldeditor-1` scores 10/10 with only its key section and 2/10 with Personas **Change It in Game** in slot 5. That section scores 0.29 of the top hit.

- After the top hit, a search hit joins the docs block only when its score is at least a set share of the top hit's score. The share is a named constant beside the budget and the cap.
- The top hit and the surface section always go in.
- The Search tab keeps its full list. The floor applies to the help session's docs block only.
- Pick the share from the scores. Report the share of the top hit for every keyed section in ticket 26's set, so the floor drops no keyed section that reaches the block today.

**Probe.** Run ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct, right source and sections sent per kind. Name `worldeditor-1`.

Recommended model rationale: the floor trades recall for precision, and the share must be read from data.

## Acceptance criteria

- [ ] A hit under the floor stays out of the docs block; a test asserts it
- [ ] The top hit and the surface section are never dropped; a test asserts it
- [ ] The handover holds the share of the top hit for every keyed section, and how many keyed sections the floor drops
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover; no kind drops by more than the 5-point batch drift
- [ ] Four gates green
