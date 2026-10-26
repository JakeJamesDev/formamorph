# 07: Editor Check For Dropped Writes

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the analysis's write check gains mutating calls and three more read-only globals, with the per-timing exception `turn.choices` already carries.

## What to build

The code editor flags a write that run time would drop, before the author runs it (Q25 follow-up). Today the check flags `turn.<field> = …` and `turn.choices[i] = …`, skipped for `turn.choices` at After the AI, and nothing else on the read-only globals. It gains: a mutating call on `turn.choices` (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`) at any timing but After the AI, and in a user Tool; an assignment or element assignment to `clock`, `location` and `notes` and their members at every timing. Each diagnostic names the path and says it is read-only, in the wording the `turn` diagnostic uses. A `location.move(...)` or `clock.advance(...)` call is a verb, not a write, and stays unflagged. Hover cards keep their access badges; the Scripts guide's read-only note covers the three globals.

Spec: Q21, Q25, Further Notes.

## Acceptance criteria

- [ ] `turn.choices.push("x")` at Before the AI, During AI Output, At Game Start, When a Trait Switches and in a user Tool gets a read-only diagnostic; the same call at After the AI gets none
- [ ] `clock.hour = 1`, `location.name = "x"` and `notes = "x"` get a read-only diagnostic at every timing; `location.move(location.name)` and `clock.advance(30)` get none
- [ ] A write through an alias (`const t = turn; t.choices.push("x")`) is out of reach and gets no diagnostic, as the stat write check behaves
- [ ] Reinstating the old check turns the new cases red
- [ ] The Scripts guide names the three globals as read-only where it lists `turn`

## Blocked by

- None (can start immediately)
