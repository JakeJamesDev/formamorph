# 04: List Traits, Travel and Persona

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Three more action kinds through ticket 01's module, plus the mid-turn block.

## What to build

Turning a trait on or off, traveling through the map or location picker, and switching persona each add a Listed Action, shown by default, with its source tab's icon (Traits, Location, persona). Undo restores the snapshot taken before the action, switch scripts and stat swaps included. A persona entry's snapshot also holds the persona reference, which is envelope state. Turning the same trait back, traveling straight back, or switching straight back undoes the newest entry instead of adding one. The AI's own "Move to X?" suggestion adds no entry.

While a turn runs, every listed action is disabled: trait toggles, travel, persona switch and stat edits join the inventory panel, which already is.

Spec rulings: Q5, Q13, Q17, Q27.

## Acceptance criteria

- [ ] Trait toggles, travel and persona switches each add an entry with the matching tab icon.
- [ ] Undo of each restores the pre-action state; a test proves a switch script's write reverts.
- [ ] Undo of a persona entry restores the previous persona.
- [ ] Each exact reversal of the newest entry leaves no entry.
- [ ] Accepting the AI's location suggestion adds no entry.
- [ ] While a turn runs, trait toggles, travel, persona switch and stat edits are disabled.
