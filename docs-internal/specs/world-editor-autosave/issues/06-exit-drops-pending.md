# 06: Exit Drops Pending Changes

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: a small surface, but the in-game Exit path does not revert today and the prompt copy changes meaning.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

Leaving the editor with pending changes still shows the unsaved-changes prompt (Q5). With auto save on, its Exit drops only the changes since the last save, and the prompt says so.

- The prompt copy names what Exit drops when Auto Save is on. With Auto Save off, the copy stays as today.
- The in-game editor's Exit does not revert the world today; it only lets the editor unmount. It must drop pending changes the same way as the menu editor.
- Leaving is not a save trigger (Q2). The prompt's Save still saves.

Rulings: Q5, Q9.

Handoff from 04: Exit Without Saving already waits for a running save through `autoSave.afterSaves`. The in-game prompt's Save still calls the context's `saveWorld` directly; route it through auto save here.

## Acceptance criteria

- [ ] With Auto Save on, Exit drops only the changes since the last save, in both editor hosts.
- [ ] The prompt copy says what Exit drops when Auto Save is on, and is unchanged when off.
- [ ] The in-game Exit reverts pending changes (a test fails with the old path reinstated).
- [ ] Changelog fragment written.
