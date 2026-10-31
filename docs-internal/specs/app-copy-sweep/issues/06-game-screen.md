# 06: Game Screen

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: player-facing copy across many small panels.

## What to build

Sweep the copy of the game screen and the start-of-game modals under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/game/`
- In `src/views/`: `GameViewer.tsx`, `StartingLocationModal.tsx`, `TraitSelectionModal.tsx`, `CharacterCustomization.tsx`
- `src/components/modals/LoadGameDialog.tsx`, `SaveList.tsx`
- `src/lib/bubbleActions.ts`, `useVrmCustomization.tsx`

**Notes**

- The game panel suites assert on labels. Update them with each change.
- The Memory pin control is "Clear the Pin and Let the Story Decide" (R12). Rename it in `MemoryPanel.tsx`.
- Ticket 03 renames the built-in chip "Character Name" to "Entity Name" (R10). Fix the `GamePanels.tsx` comments that still name the old label.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [ ] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words.
- [ ] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason.
- [ ] Raw help paragraphs in the listed files render through Hint or Meta.
- [ ] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests.
- [ ] Comments in the listed files changed only when false, history-telling, or figurative (Q6).
- [ ] Every test that pinned a changed string is updated.
- [ ] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed.
- [ ] No changelog fragment.

For you: Start a game and read the panel hints, the inventory, the memory panel and the TTS dialog.
