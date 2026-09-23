# 01: Relabel Overview Descriptions

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Authoring Tour](../spec.md)

**What to build:** The Overview tab follows the same player/AI pairing as every other tab. **World Description** becomes **Player-Facing Description**. **System Prompt Addition** becomes **AI-Facing Description**. An author can now tell from the label alone which text the AI reads.

**Rationale for the model:** a label and copy change with tests and docs. Pattern-following work, so Sonnet at medium effort.

## Acceptance criteria

- [ ] The Overview tab labels read **Player-Facing Description** and **AI-Facing Description**.
- [ ] Both ⓘ tips follow the help-copy pattern. The Player-Facing tip says where players see the text and that the AI never reads it. The AI-Facing tip says the AI reads it at the start of every narration prompt and that players never see it.
- [ ] Editor search and find show the new labels.
- [ ] Every other UI string, tip and doc that names either old label is updated. This includes the thumbnail **Generate** help, if it names the field.
- [ ] The stored field names do not change. The `<WORLD DESCRIPTION>` prompt chip keeps its token and its name. The Test Bench's AI Context block keeps its label, because it names the chip.
- [ ] The wiki's World Editor page uses the new labels.
- [ ] The field-label and editor help-copy tests pass with the new strings. A copy sweep of the changed copy is clean.
- [ ] Preview check through the dev router: the Overview tab shows both labels and tips in Simple and Advanced.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add a 👤 changelog entry in the In Progress section.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree. See the spec's Workspace notes.
