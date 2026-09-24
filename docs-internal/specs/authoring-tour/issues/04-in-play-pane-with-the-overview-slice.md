# 04: In Play Pane With the Overview Slice

Status: ready-for-human
Status note: Built. Both rulings resolved 2026-09-23, kept as built (spec: Rulings on tickets 04, 05 and 11). Still proposed: move the library card record mapping into one shared function.
Base: 81739da8
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** While the tour runs on desktop, the **In Play** pane docks beside the editor and shows the current step's slice. It updates as the author types.

| Step | Player Sees | Narration Prompt Reads |
|---|---|---|
| World Name | The library card face with the name | "The AI never reads this field" |
| AI-Facing Description | "Players never see this field" | The world block, exactly as the AI Context instrument renders it, with the author's text marked |

This ticket builds the In Play computation that every tab ticket extends. It takes the world, the step and the tour items, and returns one Player Sees surface plus a list of readers. Each reader has a prompt name, text, marked spans and a state. The four states (reads, never reads, not in the scene, no keyword) are all defined here, although Overview uses only two.

**Rationale for the model:** it sets the computation, the marking and the dock behavior that five tab tickets reuse. Opus at high effort.

## Acceptance criteria

- [ ] Reader text comes from the Test Bench builders, with the shipped default prompts standing in. In Play re-derives no context block.
- [ ] Marking finds the field's current text inside the reader text and marks each match. Text it cannot find is shown unmarked, not guessed at.
- [ ] Player Sees renders the real library card face from ticket 02. No look-alike replica.
- [ ] Each reader section names its prompt, for example "Narration Prompt Reads".
- [ ] The pane takes the Test Bench's dock slot while the tour runs. A docked or embedded Bench panel closes. The flask popover still opens.
- [ ] The pane leaves when the tour ends, and the editor layout returns to what it was.
- [ ] In Play never makes an AI call.
- [ ] Tests run through the World Editor Bench harness: typing updates the pane, the author's text is marked, "never reads" and "never sees" show where true, and the Bench dock is handed over and back.
- [ ] One marking guard is proven by breaking the match and watching the test fail.
- [ ] Preview check through the dev router in both themes: pane placement, marks and the two states, with static DOM evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Adjust the Authoring Tour changelog entry if its wording no longer fits.

## Scope notes

- **No world or save export-shape change.**
- The mobile sheet is ticket 12.
- Build on `feature/authoring-tour` in the worktree.
