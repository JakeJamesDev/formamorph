# 03: Memories Reads

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the memories list derives from the Memory panel's ledger and the clock resolver, and the prelude must stay cheap over hundreds of rows.

## What to build

A script reads `memories`, an array of the Memory panel's rows oldest first: the live digests and the Custom lines, tombstoned rows absent (R4, Q4). Each entry reads `id`, `turn`, `timestamp`, `day`, `daypart`, `text`, `custom`, `kept`, `inContext`, `pinned` and `forgotten` (spec: Surface, Memories; R6, Q2). `timestamp` is story hours at the end of that turn on the scale of `clock.elapsedHours`; `day` and `daypart` come from the same clock resolver the panel's stamp uses. A Custom line reads the turn it was added on, for script-pinned lines and player notes alike. `memories.add(line)` and `memories.pin(line)` keep the meanings of `memory.add` and `memory.pin` (R5), and the rewrite pass from ticket 02 turns the old names into the new ones on load (Q1). In Test Code and the Test Bench the array is empty (Q12). The snapshot serializes the trimmed entry shape only. Cards and the Variable menu show `memories`, its two verbs and the entry fields.

Spec: R4, R5, R6, Q1, Q2, Q4, Q9, Q12, stories 6, 7, 8, 11, 12.

## Acceptance criteria

- [ ] A playthrough with five digested turns, one keep verdict, one drop verdict, one deleted row and one Custom line gives `memories` with five entries in order, the deleted row absent, `pinned` and `forgotten` on the right rows, `custom` on the line
- [ ] `timestamp`, `day` and `daypart` on an entry equal what the panel's stamp resolver gives for that turn; a Custom line reads its anchor turn's values
- [ ] `memories.filter((m) => m.daypart === "night")` works in a script over a world with a measured clock
- [ ] `memories.add` and `memories.pin` land as `memory.add` and `memory.pin` did; the old names rewrite on load and no alias runs
- [ ] A write made in the run does not appear in `memories` within that run
- [ ] Test Code and the Test Bench read an empty array; a script that reads `memories.length` reports 0
- [ ] The snapshot for a 400-row ledger carries no original text, override history or relevance scores; a size test bounds it
- [ ] Four gates green

## Blocked by

- 02 (Diary On Entities And The Rewrite Pass)
