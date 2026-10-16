# 06: What The AI Reads Pane

Status: done
Blocked by: 03, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: wires existing scene builders and renderers into a pane; the risk is data choice, which the spec settles.

Parent: [Chip Options spec](../spec.md)

## What to build

The dialog's right pane shows the chip's value rendered with the current picks, and updates on every change.

- Data: in a game, the live scene the Preview tab reads. In the World Editor, the authored chip scene the editor builds for previews. In Settings outside a world, the sample scene the Settings preview uses. Settings receives a scene or a render function for this, not a values map. The pane never ships a fixture cast of its own (Q22).
- The value renders through the same renderers the prompt uses, in the chip's format.
- The header renders in the chip's format: a Markdown heading, a label line in Simple, a wrapping tag in XML. Prepend and Append wrap the block. Placement text is one shade dimmer than the chip's own output.
- An empty value shows what the prompt would show, the placeholder or nothing, as the chip would.
- Prompt chips only (Q29).

Rulings: Q18, Q22, Q29.

## Acceptance criteria

- [ ] In a game, the pane matches the Preview tab's value for the same token.
- [ ] In the World Editor, the pane shows that world's entities, traits and stats.
- [ ] Outside a world, the pane shows the Settings sample scene.
- [ ] Header, Prepend and Append render in the pane in each format, dimmed.
- [ ] Every control change updates the pane without closing the dialog.
- [ ] No fixture data lives in the pane's code.
