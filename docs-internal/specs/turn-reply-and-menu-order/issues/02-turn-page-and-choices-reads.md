# 02: Turn Page And Choices Reads

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: two read-only members through the surface, the snapshot and the executor, handed in on every run path (live turn, stats re-roll, between turns, editor samples), each path with its own source of the values.

## What to build

A script reads `turn.narration` and `turn.choices` beside `turn.action` and `turn.number`, both read-only at every timing in this ticket (Q3, Q21). `turn.narration` is the finished page the player sees, During AI Output rewrites applied (Q4); the commit's narration is already that text, since the narration request answers with the rewrite's final. It reads empty at Before the AI, At Game Start and During AI Output (Q5). `turn.choices` is a `string[]` holding the turn's choices at After the AI, and `[]` before then or when the player's choices are off (Q6, Q11). Between turns, a player toggle or a Tool call reads the last finished turn's page and choices from the stored turn, as `turn.number` reads its number (Q16). A stats re-roll's After the AI run reads the re-rolled turn's own page and choices. Test Code and the Test Bench read a short sample page and three sample choices at After the AI, empty at the other timings (Q17). User Tools and World Tools read both. The surface description carries both names with type, access and help line; cards, completions, the Variable menu and the Scripts guide follow. The changelog fragment carries the reads entry; ticket 03 folds the write into it.

Spec: Q3–Q6, Q11, Q16, Q17, Q21, stories 4–8, 21–23.

## Acceptance criteria

- [x] An After the AI script on a live turn reads `turn.narration` as the page the player sees, with a During AI Output rewrite applied, and `turn.choices` as the choices pass's list in order (GameViewer.turnRead "reads the rewritten page and the choices in order at After the AI")
- [x] Before the AI, At Game Start and During AI Output read `turn.narration` as `""` and `turn.choices` as `[]` on the same turn (same test; turnGlobal "reads both empty at At Game Start, Before the AI and During AI Output")
- [x] With the player's choices off, After the AI reads `turn.choices` as `[]` (GameViewer.turnRead "reads no choices at After the AI with the player's choices off", plus the between-turns and mid-re-roll toggles after turning choices off)
- [ ] A player toggle between turns, and a user Tool call between turns, read the last finished turn's page and choices; before turn 1 both read empty (toggles: GameViewer.turnRead toggle tests, mid-turn reads empty per Q22; user Tool only at the unit seam, see Not verified)
- [x] A stats re-roll's After the AI run reads the re-rolled turn's page and choices (GameViewer.turnRead "reads the re-rolled turn's page and choices on a stats re-roll's After the AI run"; its Before the AI switch reads empty)
- [x] A write to `turn.narration` or `turn.choices` at any timing lists as a read-only write and lands nothing (turnGlobal "lists a write to either as read-only"; user Tool lists it as dropped)
- [x] Test Code and the Test Bench read the sample page and three sample choices at After the AI, and empty values at the other timings (turnGlobal "reads the sample page and three choices in Test Code", "reads the same sample on the Test Bench")
- [x] Hover cards, completions and the Variable menu list both names with type, access and help line; the Scripts guide's Turn section covers them; the changelog fragment names the reads (statCodeVariableTree "opens turn to its action, number, page and choices"; cards and completions read the same `TURN_MEMBERS`)

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- A user Tool call between turns on a mounted game. The Tool path reads the same `betweenTurnsRead` the toggle tests drive, and turnGlobal covers a Tool snapshot that holds a page. No GameViewer test drives `toolWorld()` itself.
- On Call World Tools reading empty during the request, and armed After the AI triggers reading both. The timing mask is unit-tested on a Tool home at `before`; no live-turn test runs a World Tool.

**For you**

- Write an After the AI script that reads `turn.narration` and `turn.choices` and play a turn: the values match the page and choice buttons you see (Scripts tab, then play).
- Hover `turn` in a code box: the card lists `narration` and `choices` with their help lines.
