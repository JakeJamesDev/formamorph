# 47: "Here" questions keep the screen

Status: ready-for-agent
Blocked by: 44
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

AI picks stop crowding a "here" question with look-alike sections (Q74). In ticket 44, "here" questions fell from 98% to 82% grounded-correct with the shipped sources on. The screen's section still led every time. The picks added sections that look like answers, the Q69 pattern, and three of the 12 questions account for the drop.

- Find what the picks add on those three questions, and why the model follows it.
- Measure at least two rules, for example:
  - no pick request when the screen's section leads and the question's own keyword search finds nothing above the floor
  - picks after the screen's section count only when they are on the screen's page
- Ship the rule that recovers "here" questions without losing the task gain. The rule must be stateable without naming questions.

**Probe.** Ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Ticket 39's recall probe on both sets.

Recommended model rationale: the rule must fix "here" questions without fitting the three known ones.

## Acceptance criteria

- [ ] The handover names what the picks added on the three questions, and why
- [ ] "Here" grounded-correct returns within the 5-point drift of 98%, and task grounded-correct does not drop more than the drift; same batch
- [ ] The rule is stated in the code and a test, with no question named
- [ ] Four gates green
