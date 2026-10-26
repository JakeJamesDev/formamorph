# 02: Turn Page And Choices Reads

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: two read-only members through the surface, the snapshot and the executor, handed in on every run path (live turn, stats re-roll, between turns, editor samples), each path with its own source of the values.

## What to build

A script reads `turn.narration` and `turn.choices` beside `turn.action` and `turn.number`, both read-only at every timing in this ticket (Q3, Q21). `turn.narration` is the finished page the player sees, During AI Output rewrites applied (Q4); the commit's narration is already that text, since the narration request answers with the rewrite's final. It reads empty at Before the AI, At Game Start and During AI Output (Q5). `turn.choices` is a `string[]` holding the turn's choices at After the AI, and `[]` before then or when the player's choices are off (Q6, Q11). Between turns, a player toggle or a Tool call reads the last finished turn's page and choices from the stored turn, as `turn.number` reads its number (Q16). A stats re-roll's After the AI run reads the re-rolled turn's own page and choices. Test Code and the Test Bench read a short sample page and three sample choices at After the AI, empty at the other timings (Q17). User Tools and World Tools read both. The surface description carries both names with type, access and help line; cards, completions, the Variable menu and the Scripts guide follow. The changelog fragment carries the reads entry; ticket 03 folds the write into it.

Spec: Q3–Q6, Q11, Q16, Q17, Q21, stories 4–8, 21–23.

## Acceptance criteria

- [ ] An After the AI script on a live turn reads `turn.narration` as the page the player sees, with a During AI Output rewrite applied, and `turn.choices` as the choices pass's list in order
- [ ] Before the AI, At Game Start and During AI Output read `turn.narration` as `""` and `turn.choices` as `[]` on the same turn
- [ ] With the player's choices off, After the AI reads `turn.choices` as `[]`
- [ ] A player toggle between turns, and a user Tool call between turns, read the last finished turn's page and choices; before turn 1 both read empty
- [ ] A stats re-roll's After the AI run reads the re-rolled turn's page and choices
- [ ] A write to `turn.narration` or `turn.choices` at any timing lists as a read-only write and lands nothing
- [ ] Test Code and the Test Bench read the sample page and three sample choices at After the AI, and empty values at the other timings
- [ ] Hover cards, completions and the Variable menu list both names with type, access and help line; the Scripts guide's Turn section covers them; the changelog fragment names the reads

## Blocked by

- None (can start immediately)
