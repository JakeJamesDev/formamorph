# 03: Child Pull with the Movement Rule

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a small rule change in the scene pull, but it moves authored characters, so each Movement case needs a guard that bites.

## What to build

A character the story brings into the scene joins it, whether she stood in a sibling place or a direct child of the player's place. Her Movement decides whether she may come (Q2, Q3).

- The pull takes a character named in prose who stands in a **direct child** of the player's place, as well as a sibling, as today. Deeper places are not pulled.
- Full-name hits only, as today: a name, a full alias, or (after ticket 02) a full Stranger Name. A name inside dialogue never pulls.
- One Movement rule for siblings and children:
  - **Stays Put:** never pulled.
  - **Moves Between Its Locations:** pulled only when the player's place is one of her locations.
  - **Free** and **Can Follow the Player:** always pulled.
- The pulled character is recorded through the discovered-entity path, as today, so the move persists, rolls back with its turn and survives reload.

This ticket owns the pull's selection rule. Ticket 04 changes only which place the pull is judged at, not the rule.

## Acceptance criteria

- [x] A test shows a character named in prose in a direct child place is pulled into the player's place, and fails when the child case is removed. `narrationReading.test.ts` "pulls a character named in prose from a direct child…"; mutation removing the child clause turned it red.
- [x] A test shows a character two levels down is not pulled. "never pulls a character two levels down".
- [x] Tests show each Movement case for both a sibling and a child: Stays Put never, Moves Between only into one of her own locations, Free and Follow always. Each test fails when its case is reverted. `describe.each` "Movement, from a sibling/child"; each of the three rule mutations turned its test red.
- [x] A test shows a name inside quoted speech pulls no one. "never pulls a name spoken only inside dialogue", fed by `readNarration`'s prose; red when the prose keeps dialogue.
- [x] No save-shape change, or the landing names the change and carries the export-shape reminder. Writes ride the existing `entityPositions` and discovered-entity fields.
- [x] The Locations docs describe the pull: who joins the scene, from where, and how Movement limits it. `docs/World-Editor-Locations.md` "Who Joins the Scene".
- [x] A changelog fragment states the outcome for players and authors. `docs-internal/changelog.d/narrated-moves-03.md`.

## Landed

Spec-session rulings Q-A to Q-C (2026-11-06) are built: where a character stands and whether it is present read positions in play; a pulled character that holds a position moves there, one without is anchored as before; the child pull runs at a top-level place. Tests "where it stands in play" cover them, each mutation-checked.

**Not verified**
- The live turn wiring in `GameViewer.tsx` (`applyNarrationReading`) has no test; it is a short call into the tested pure function, checked by reading.

**For you**
- Play a scene where the narration names a character standing in a room inside yours, and check it shows under In Scene on the next turn.

**For ticket 04**
- The commit-time re-join (`commitEntityMoves`, ~GameViewer 2980) does not know the pull's positions. A code move (`codeTarget`) after the narration leaves a pulled character at the turn's location while the player ends elsewhere. Ticket 04 owns the place the pull is judged at, so it should judge the pull at the final place.
