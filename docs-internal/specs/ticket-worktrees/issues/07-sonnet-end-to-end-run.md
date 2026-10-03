# 07: Sonnet 5.5 End-to-End Run

Status: in-progress
Base: ca35165c
Blocked by: 02, 06, 08, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: formamorph
Spec: ../spec.md (Ruling Q17; Testing Decisions › End to end)

Model rationale: the run itself is on Sonnet 5.5. This ticket's session sets it up and audits the transcript, and finding root causes needs judgment.

## What to build

The user picked `docs-internal/specs/formaquestion-settings/issues/19-docs-and-glossary-pass.md`. It is blocked by formaquestion-settings 16, so the run starts only after 16 lands. A Sonnet 5.5 session runs it with `/implement` while peers run as usual. This ticket's session audits that transcript against the pass bar below. Each deviation becomes a fix to a hook or doc from the earlier tickets, and the run repeats until it passes.

## Acceptance criteria

- [ ] One commit for the ticket lands on `main`.
- [ ] The transcript shows zero manual git commands in the worktree flow.
- [ ] The transcript shows zero failed tool calls caused by the workflow.
- [ ] No peer file is touched.
- [ ] The worktree, branch, junction, and launch entry are gone afterwards.
- [ ] The final report lists each deviation found with its fix, and the number of runs it took.
