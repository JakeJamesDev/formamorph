# 04: Narrated Moves in Auto Mode

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it adds a pass to the turn pipeline and changes the order of the move and the pull, across the runner and the commit.

## What to build

When the story carries the player somewhere, the game moves them (Q4–Q7, Q10, Q11).

- In Auto mode, when the router before the narration answers NONE, one more location request runs after the narration. It reads the narration and sends the same reachable destination list. Its answer applies at once.
- It uses the request ticket 01 settled on: Suggest mode's post-narration request as is, or the narrated-move prompt pair if the probe required one. Ticket 01 adds that pair as default prompts only; this ticket wires its settings, pass and editor rows.
- Suggest mode's post-narration offer uses the same request, so it reads the narration too. It still offers the move and never applies it, and it keeps its timing.
- The opening runs this check too, after the opening narration.
- The narrated move applies before the scene pull and before presence is read. The pull and presence are judged at the place where the player ends the turn.
- A narrated move goes through the same move path as a walked move: followers come along, "stay here" replies stay, and Moves Between characters come along only into their own places.
- No new setting. The check runs whenever Location Changes is on and Auto mode applies moves.

Ticket 03 owns the pull's selection rule. This ticket changes only the place the pull is judged at.

Handoff from ticket 03: the commit-time re-join of entity moves does not know the pull's positions. A code move after the narration leaves a pulled character at the turn's starting place while the player ends elsewhere. Judge the pull at the final place, after both the narrated move and any code move.

## Acceptance criteria

- [ ] Turn-runner tests with fake replies show the check runs in Auto mode after NONE and on the opening, and does not run after a router move or with Location Changes off.
- [ ] A test shows Suggest mode's offer request carries the narration, and the offered move is not applied until the player takes it.
- [ ] A test shows a narrated move changes the player's place at the end of the turn.
- [ ] A test shows the move applies before the pull: a character standing in the place the player is carried into is not pulled back to the starting place. The test fails when the order is reversed.
- [ ] A test shows a code move after the narration leaves a pulled character at the player's final place, not the starting place.
- [ ] Tests show followers come along on a narrated move and a "stay here" reply stays.
- [ ] No save-shape change, or the landing names the change and carries the export-shape reminder.
- [ ] The location docs say Auto mode also follows moves the story makes, including in the opening.
- [ ] A changelog fragment states the outcome for players.

For you: replay the private play log that found these gaps, and check per turn where the player stands and who is In Scene.
For you: play a scene where a character carries or leads your character, and check the location panel follows.
