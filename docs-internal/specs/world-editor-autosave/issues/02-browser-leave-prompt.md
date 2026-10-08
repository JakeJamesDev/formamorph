# 02: Browser Leave Prompt

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one browser event wired to an existing dirty flag, in two hosts, with a clean teardown.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

Closing or reloading the browser tab while the open world has unsaved changes shows the browser's leave prompt. Today it shows nothing and the changes are lost.

- The prompt shows whenever the world is dirty, with Auto Save on or off.
- It applies in the World Editor from the menu and in the in-game world editor.
- With a clean world, or with the editor closed, no prompt shows.
- The listener is removed when the editor closes, so it never outlives the editor.
- In the Electron shell, check what a `beforeunload` cancel does to window close, and keep the window closable.

Rulings: Q14, Q17.

## Acceptance criteria

- [ ] A dirty world in either editor host triggers the browser leave prompt on close or reload.
- [ ] A clean world, or a closed editor, triggers no prompt.
- [ ] Closing the editor removes the listener (a test proves it by reinstating a leak).
- [ ] The Electron window still closes after the author confirms.
- [ ] Changelog fragment written.
