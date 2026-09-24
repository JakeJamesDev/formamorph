# 09: Dictionary Steps

Status: in-progress
Base: 99bbfe14
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Traits, the tour builds one dictionary entry in the new world's seeded Default book. In Play shows that an entry reaches the AI only when it is mentioned.

| Step | Player Sees | Narration Prompt Reads |
|---|---|---|
| Add an entry | (the Add button is the anchor) | none |
| Name and Trigger Keywords | "Players never see dictionary entries" | Depends on the test line |
| Value | "Players never see dictionary entries" | The dictionary block with `Name: Value`, marked, when the test line matches |

In Play has an editable **test line**. It starts as a sample action built from the entry's first keyword. When the test line contains a keyword, the entry shows in the dictionary block. When no keyword is left, the reader shows the **no keyword** state.

**Use Example** values come from Appendix A: The Drowned Bell, keywords "bell" and "drowned bell". With the example entry, the test line reads "You ask Maren about the bell."

**Rationale for the model:** follows the established pattern. Activation must run through the Activation Tester's scan. Sonnet at high effort.

## Acceptance criteria

- [ ] All three steps run in order, and each saves when it completes.
- [ ] The test line is prefilled from the first keyword, and the author can edit it.
- [ ] Activation runs through the Activation Tester's scan, with the entry's Whole Words and Case-Sensitive settings. In Play has no matcher of its own.
- [ ] Removing the keyword from the test line switches the reader to the no-keyword state. Adding it back shows the entry again.
- [ ] Tests through the World Editor Bench harness cover the prefill, the match, the no-keyword state, and the marked Value.
- [ ] Preview check through the dev router: the Value step with a matching and a non-matching test line, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.** The test line is never saved.
- The step order in the registry puts Dictionary after Traits. This ticket can be built before ticket 08 lands.
- Build on `feature/authoring-tour` in the worktree. Shares the step registry with tickets 06 and 07.
