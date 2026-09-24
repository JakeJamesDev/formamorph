# 07: Stats Steps

Status: ready-for-human
Status note: Built in d83b10d0 and the review follow-up. The stale default descriptors are fixed on `main` from `docs-internal/specs/stat-descriptor-rename/` (user's choice, 2026-09-23). No change to this ticket.
Base: 99bbfe14
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Entities, the tour builds one stat. In Play shows that two prompts read a stat differently.

| Step | Player Sees | Narration Prompt Reads | Stat Updates Prompt Reads |
|---|---|---|---|
| Add a stat | (the Add button is the anchor) | none | none |
| Name with Min, Max and Initial Value | Stat row with its bar and value | The name and its status, never the number | The name with its value, such as `0/100` |
| Description | "Players never see this field" | The name and its status, never the Description | The name, value and Description, marked |

Narration reads the stat's status from the descriptors every added stat starts with, and never its number or Description (ruling below). In Play shows the builder's real output, and does not work around it.

**Use Example** values come from Appendix A: Sea Change, 0 to 100, starting at 0.

**Rationale for the model:** follows the established pattern. It adds the second reader, which uses the Stat Updates prompt's token options. Sonnet at high effort.

## Acceptance criteria

- [x] All three steps run in order, and each saves when it completes.
- [x] Player Sees is the real stat row.
- [x] The narration reader uses the shipped narration prompt's stat options. The Stat Updates reader uses the shipped Stat Updates prompt's stat options. Both come from the one stat-context builder.
- [x] The Name step completes when the stat has a name. Min, Max and Initial Value keep the defaults unless the author changes them.
- [x] Tests through the World Editor Bench harness show both readers, the marked Description in the Stat Updates reader, and a narration read that holds neither the number nor the Description (ruling below).
- [x] Preview check through the dev router: the Description step with both readers, with static DOM evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Whether Simple-mode stats should reach narration is a separate product question (spec Further Notes 1). It is not part of this ticket.
- Build on `feature/authoring-tour` in the worktree. Shares the step registry with tickets 06 and 09.

## Comments

**Ruling from the spec session (2026-09-23).** The "name only" premise was wrong. The Add button gives every new stat three default descriptors ("New Stat is low/medium/high"), and nothing strips them in Simple. So narration reads `- **Sea Change:** New Stat is low`. In Play shows the real builder output. The step copy says narration never reads the number or the Description. Criterion 5 changed to match. The reader is titled **Stat Updates Prompt**, the app's own name for that prompt. Whether to fix the stale add-time descriptors is a product question for the user, not part of this ticket.

**Build notes.** Both readers render through `buildStatBlock` in the Test Bench's AI Context module, each with the Stats chip read out of its own shipped prompt (`statsChipIn`). `newStat` and `withDefaultDescriptors` moved into `blankWorld`, so the editor's Add, the context's `addStat` and the dev-route replay build the same stat. Test wall time after the review follow-up: 101 s for the full suite (99 s reported by Vitest), all 12,743 tests passing.

**Preview evidence (dev router, 1440×900).** `#dev?modal=worldEditor&tour=stat-description`, then **Use Example**: the tour bar read "18 / 20", Player Sees read "Players never see this field", Narration Prompt Reads was `- **Sea Change:** New Stat is low` with no marks, and Stat Updates Prompt Reads was `- **Sea Change:** 0/100 — How far the Tidewell…` with the whole Description as its one mark. On `tour=stat-name`, Player Sees held the real stat row: name, "0 / 100", a 298 px bar and the "New Stat is low" line.
