# 02: Render Player Surfaces From Props

Status: ready-for-human
Base: f3a536d3
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

- [x] Each piece renders in a test with only its props and app-wide providers. No test mounts a game-state provider to render a piece.
- [x] The library board, the game panels, the entity dialog and the setup screen render through these pieces.
- [x] Their existing tests pass without changes to the assertions.
- [x] No code mounts a second game-state provider. A second one clears the running game's persona on mount.
- [x] Extract one piece at a time. Keep the suite green after each one.
- [x] One guard per piece shows that it renders without the game state. Prove each guard by putting a context read back into the piece and watching the test fail.
- [x] Preview check at desktop and mobile widths: the game view, the setup screen and the library board show the same DOM structure and text as before, captured as static evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. No changelog entry, because nothing user-facing changes.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.

## Comments

**Implementation (2026-09-23).** The pieces are [WorldCardFace](../../../../src/components/WorldCardFace.tsx), [LocationTabBody](../../../../src/components/game/LocationTabBody.tsx), [EntityListRow](../../../../src/components/game/EntityListRow.tsx), [EntityCardBody and EntityDescription](../../../../src/components/game/EntityCard.tsx) and [SetupTraitList](../../../../src/components/game/SetupTraitList.tsx). The stat row renders standalone and is unchanged; a guard test now covers it.

- Preview check: 12 surfaces at 1440×900 and 375×812, captured with the base versions of the four changed screens and then with the new ones. All 24 normalized DOM captures are byte-identical.
- Each guard failed with a `useGameplay()` read put back (the card face: with the drag binding put back).
- All four pieces are in one commit. The suite was green after each extraction.
- For ticket 04: the entity card body has no name. The dialog shows the name in its title, so In Play draws it itself. The Location tab shows the legacy `description` when the Player-Facing Description is empty.
