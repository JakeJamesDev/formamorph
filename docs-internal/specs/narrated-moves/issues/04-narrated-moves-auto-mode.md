# 04: Narrated Moves in Auto Mode

Status: done
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

- [x] Turn-runner tests with fake replies show the check runs in Auto mode after NONE and on the opening, and does not run after a router move or with Location Changes off. `turnRunner.test.ts` "the narrated move" (six cases); in play, `GameViewer.narratedMoves.test.tsx` "never runs after the router moved the player". Removing the skip turned 10 tests red.
- [x] A test shows Suggest mode's offer request carries the narration, and the offered move is not applied until the player takes it. `turnRunner.test.ts` "the Suggest mode offer": the request carries the narration, the commit offers the move, `turn.locationId` stays.
- [x] A test shows a narrated move changes the player's place at the end of the turn. `GameViewer.narratedMoves.test.tsx` opening and follower cases; with the move disabled, both turned red.
- [x] A test shows the move applies before the pull: a character standing in the place the player is carried into is not pulled back to the starting place. The test fails when the order is reversed. "moves the player on the opening, before the pull"; judging the pull at the starting place turned it red.
- [x] A test shows a code move after the narration leaves a pulled character at the player's final place, not the starting place. "leaves a pulled character at the place a script moved the player to"; red under the same mutation.
- [x] Tests show followers come along on a narrated move and a "stay here" reply stays. "brings a follower along and leaves the one told to stay", including the prompts after the narration; dropping the mid-turn join turned it red.
- [x] No save-shape change, or the landing names the change and carries the export-shape reminder. No save change. The prompt preset gains `narratedMovePrompt` and `narratedMoveUserPrompt` (additive; see Landed).
- [x] The location docs say Auto mode also follows moves the story makes, including in the opening. `docs/World-Editor-Locations.md`, plus `docs/Settings.md` and `docs/Prompts.md`.
- [x] A changelog fragment states the outcome for players. `docs-internal/changelog.d/narrated-moves-04.md`.

## Landed

Ticket 04 rulings 1–7 (spec session, 2026-11-06) are built: the check is its own serial step after the narration; any move before it skips it; the pull runs once at the commit, at the final place; the prompt pair has its own `narratedMove` request type and Narrated Move rail row; the opening sends an empty action, after a written page one too; Location Change drops the narration chip; the Location Change row stays in Suggest mode.

Export shape: prompt presets (and shared preset files) gain two additive keys, `narratedMovePrompt` and `narratedMoveUserPrompt`. A preset without them reads the defaults. Saves and worlds are unchanged.

**Not verified**
- Moves Between characters on a narrated move: the move reuses `joinEntityMoves`, whose own tests cover it; no narrated-move test of its own.

**For you**
- Replay the private play log that found these gaps, and check per turn where the player stands and who is In Scene.
- Play a scene where a character carries or leads your character, and check the location panel follows.
- FormamorphServer: add `'narratedMove'` to `PROMPT_TYPES` in `src/config/hostedAi.js` (and its pin in `tests/hostedAiBreakdown.test.js`). Until then the proxy records these calls with no prompt type; it does not refuse them. The extra call counts toward `turnCallCap` on NONE turns.
- On a narrated move, who comes along still comes from the entity requests sent before the narration, which read the action only. A character the narration carries along, with an action that never names it, stays behind. Decide whether that wants a follow-up.
