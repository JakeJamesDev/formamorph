# 07: Stats Steps

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Entities, the tour builds one stat. In Play shows that two prompts read a stat differently.

| Step | Player Sees | Narration Prompt Reads | Stats Prompt Reads |
|---|---|---|---|
| Add a stat | (the Add button is the anchor) | none | none |
| Name with Min, Max and Initial Value | Stat row with its bar and value | The stat's name only | The name with its value, such as `0/100` |
| Description | "Players never see this field" | The stat's name only | The name, value and Description, marked |

The narration prompt reads only the name because descriptors are Advanced-only. In Play shows this as it is, and does not work around it.

**Use Example** values come from Appendix A: Sea Change, 0 to 100, starting at 0.

**Rationale for the model:** follows the established pattern. It adds the second reader, which uses the Stats prompt's token options. Sonnet at high effort.

## Acceptance criteria

- [ ] All three steps run in order, and each saves when it completes.
- [ ] Player Sees is the real stat row.
- [ ] The narration reader uses the shipped narration prompt's stat options. The Stats reader uses the shipped Stats prompt's stat options. Both come from the one stat-context builder.
- [ ] The Name step completes when the stat has a name. Min, Max and Initial Value keep the defaults unless the author changes them.
- [ ] Tests through the World Editor Bench harness show both readers, the name-only narration read, and the marked Description in the Stats reader.
- [ ] Preview check through the dev router: the Description step with both readers, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Whether Simple-mode stats should reach narration is a separate product question (spec Further Notes 1). It is not part of this ticket.
- Build on `feature/authoring-tour` in the worktree. Shares the step registry with tickets 06 and 09.
