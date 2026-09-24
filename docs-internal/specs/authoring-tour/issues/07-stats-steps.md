# 07: Stats Steps

Status: in-progress
Base: 99bbfe14
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

- [x] All three steps run in order, and each saves when it completes.
- [x] Player Sees is the real stat row.
- [x] The narration reader uses the shipped narration prompt's stat options. The Stats reader uses the shipped Stats prompt's stat options. Both come from the one stat-context builder.
- [x] The Name step completes when the stat has a name. Min, Max and Initial Value keep the defaults unless the author changes them.
- [x] Tests through the World Editor Bench harness show both readers, the marked Description in the Stats reader, and a narration read that holds neither the number nor the Description (ruling below).
- [x] Preview check through the dev router: the Description step with both readers, with static DOM evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Whether Simple-mode stats should reach narration is a separate product question (spec Further Notes 1). It is not part of this ticket.
- Build on `feature/authoring-tour` in the worktree. Shares the step registry with tickets 06 and 09.

## Comments

**Ruling from the spec session (2026-09-23).** The "name only" premise was wrong. The Add button gives every new stat three default descriptors ("New Stat is low/medium/high"), and nothing strips them in Simple. So narration reads `- **Sea Change:** New Stat is low`. In Play shows the real builder output. The step copy says narration never reads the number or the Description. Criterion 5 changed to match. The reader is titled **Stat Updates Prompt**, the app's own name for that prompt. Whether to fix the stale add-time descriptors is a product question for the user, not part of this ticket.

**Build notes.** Both readers render through `buildStatBlock` in the Test Bench's AI Context module, each with the Stats chip read out of its own shipped prompt (`statsChipIn`). `newStat` and `withDefaultDescriptors` moved into `blankWorld`, so the editor's Add, the context's `addStat` and the dev-route replay build the same stat. Test wall time: 108 s for the full suite (106 s reported by Vitest). The only failures were ticket 09's in-progress test file, whose steps do not exist yet.
