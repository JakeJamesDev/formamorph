# 02: Render Player Surfaces From Props

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** The game pieces that In Play will show can render outside a running game. Each piece takes plain props and needs no game-state provider and no full-screen dialog. The real screens render the same pieces, so nothing the player sees changes.

| Piece | Today it is bound to |
|---|---|
| Library card face (name, description, thumbnail) | The sortable library board |
| Location tab body (current location, Player-Facing Description, Connected Locations) | The game-state provider, inside the right panel |
| Entity list row and entity card body (name, image, Player-Facing Description) | The game-state provider and the entity dialog |
| Setup screen trait list (groups, traits, Player-Facing Descriptions, stat changes, exclusive choice) | The full-screen setup dialog |

The stat row already renders from props. Confirm that it works standalone, and leave it as is if it does.

**Rationale for the model:** this refactor touches the game panels, the monolith's neighborhood. It must change nothing visible. Opus at high effort.

## Acceptance criteria

- [ ] Each piece renders in a test with only its props and app-wide providers. No test mounts a game-state provider to render a piece.
- [ ] The library board, the game panels, the entity dialog and the setup screen render through these pieces.
- [ ] Their existing tests pass without changes to the assertions.
- [ ] No code mounts a second game-state provider. A second one clears the running game's persona on mount.
- [ ] Extract one piece at a time. Keep the suite green after each one.
- [ ] One guard per piece shows that it renders without the game state. Prove each guard by putting a context read back into the piece and watching the test fail.
- [ ] Preview check at desktop and mobile widths: the game view, the setup screen and the library board show the same DOM structure and text as before, captured as static evidence.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. No changelog entry, because nothing user-facing changes.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.
