# 08: Traits Steps

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Stats, the tour builds one trait in the new world's seeded Player group. In Play shows what a player picks and what the AI learns.

| Step | Player Sees | Narration Prompt Reads |
|---|---|---|
| Add a trait | (the Add button is the anchor) | none |
| Name with Player-Facing Description | Setup screen trait list | "The AI never reads" the Player-Facing Description |
| AI-Facing Description | "Players never see this field" | The traits block with the tour trait active, marked |
| Stat Change | Setup screen stat change, and the stat row at the settled starting value | The traits block |

The Stat Change targets the tour stat from ticket 07. The stat row shows the value a new game really starts with. It is settled through the Opening instrument's machinery, so deltas and clamps apply as in play.

**Use Example** values come from Appendix A: Tide-Touched, with Sea Change +15.

**Rationale for the model:** follows the established pattern. It reuses the Opening instrument's stat settling. Sonnet at high effort.

## Acceptance criteria

- [ ] All four steps run in order, and each saves when it completes.
- [ ] Player Sees uses the setup screen trait list from ticket 02, and the real stat row.
- [ ] The traits block comes from the Test Bench builders, with the tour trait active.
- [ ] The stat row's value is the settled starting value, not the raw sum. A test proves that a clamp applies.
- [ ] The Stat Change step completes when the trait has a change on the tour stat.
- [ ] Tests through the World Editor Bench harness cover each slice, the marks, and the settled value.
- [ ] Preview check through the dev router: the Stat Change step, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
