# 04: List Traits, Travel and Persona

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Three more action kinds through ticket 01's module, plus the mid-turn block.

## What to build

Turning a trait on or off, traveling through the map or location picker, and switching persona each add a Listed Action, shown by default, with its source tab's icon (Traits, Location, persona). Undo restores the snapshot taken before the action, switch scripts and stat swaps included. A persona entry's snapshot also holds the persona reference, which is envelope state. Turning the same trait back, traveling straight back, or switching straight back undoes the newest entry instead of adding one. The AI's own "Move to X?" suggestion adds no entry.

While a turn runs, every listed action is disabled: trait toggles, travel, persona switch and stat edits join the inventory panel, which already is.

Spec rulings: Q5, Q13, Q17, Q27.

## Acceptance criteria

- [x] Trait toggles, travel and persona switches each add an entry with the matching tab icon. `GameViewer.actionListMoves.test.tsx`: the "lists with the … icon" tests read the row and its lucide svg.
- [x] Undo of each restores the pre-action state; a test proves a switch script's write reverts. "undo reverts the switch script's write" (Calm 80 → 50); travel and persona undo tests.
- [x] Undo of a persona entry restores the previous persona. World and library persona tests read `personaRef` after undo.
- [x] Each exact reversal of the newest entry leaves no entry. The three "straight back" tests (trait also proves no switch-off script ran); module tests in `actionList.test.ts`.
- [x] Accepting the AI's location suggestion adds no entry. "lists nothing when the player accepts the AI's move suggestion".
- [x] While a turn runs, trait toggles, travel, persona switch and stat edits are disabled. "disables trait toggles, travel and the persona switch" with a hanging narration request. Stat edits moved to ticket 05 (Q39).

## Landed

**Not verified**

- Nothing in the browser preview. All checks are jsdom tests; every new guard was mutation-tested red.

**Tests changed by the rulings**

- Q43: a switch run's open prompt locks the panel actions and undo. One new switchScript test replaces three that toggled during the prompt.
- Q17 (the user's pick): the switchScript switch-off test and the memoryVerdicts switch-run test now play a turn between the two toggles.
- Q13 (the user's pick): three turnRead tests and one switchScript test toggled while a turn ran. They are deleted.

**For you**

- The tray rows for a trait, a trip and a persona change, in a live game: Traits tab, Location map, persona Change.
