# 03: Memories Reads

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the memories list derives from the Memory panel's ledger and the clock resolver, and the prelude must stay cheap over hundreds of rows.

## What to build

A script reads `memories`, an array of the Memory panel's rows oldest first: the live digests and the Custom lines, tombstoned rows absent (R4, Q4). Each entry reads `id`, `turn`, `timestamp`, `day`, `daypart`, `text`, `custom`, `kept`, `inContext`, `pinned` and `forgotten` (spec: Surface, Memories; R6, Q2). `timestamp` is story hours at the end of that turn on the scale of `clock.elapsedHours`; `day` and `daypart` come from the same clock resolver the panel's stamp uses. A Custom line reads the turn it was added on, for script-pinned lines and player notes alike. `memories.add(line)` and `memories.pin(line)` keep the meanings of `memory.add` and `memory.pin` (R5), and the rewrite pass from ticket 02 turns the old names into the new ones on load (Q1). In Test Code and the Test Bench the array is empty (Q12). The snapshot serializes the trimmed entry shape only. Cards and the Variable menu show `memories`, its two verbs and the entry fields.

Spec: R4, R5, R6, Q1, Q2, Q4, Q9, Q12, stories 6, 7, 8, 11, 12.

## Acceptance criteria

- [x] A playthrough with five digested turns, one keep verdict, one drop verdict, one deleted row and one Custom line gives `memories` with five entries in order, the deleted row absent, `pinned` and `forgotten` on the right rows, `custom` on the line. `memoryView.scriptMemories.test.ts` › lists the live rows; `GameViewer.memoriesRead.test.tsx` reads the ledger through a real switch run (wiring removed → 0, red)
- [x] `timestamp`, `day` and `daypart` on an entry equal what the panel's stamp resolver gives for that turn; a Custom line reads its anchor turn's values. `memoryView.scriptMemories.test.ts` › times each entry, compared with `formatStampPlain` on the panel rows; `turn` per Q38
- [x] `memories.filter((m) => m.daypart === "night")` works in a script over a world with a measured clock. `memoryView.scriptMemories.test.ts` › lets a script gather the memories made at night; `statCodeExecutor.memories.test.ts` › filters by daypart
- [x] `memories.add` and `memories.pin` land as `memory.add` and `memory.pin` did; the old names rewrite on load and no alias runs. `statCodeExecutor.memoryWrites.test.ts`; `scriptTextMigration.test.ts` › migrateMemoryCalls and migrateWorld (second load equal); `statCodeExecutor.memories.test.ts` › has no `memory` alias
- [x] A write made in the run does not appear in `memories` within that run. `statCodeExecutor.memories.test.ts` › never reads back a line the run added
- [x] Test Code and the Test Bench read an empty array; a script that reads `memories.length` reports 0. `statCodeTestRun.worldWrites.test.ts` and `scriptCheck.test.ts` › reads an empty memories list (Q12), the bench with an in-batch control
- [x] The snapshot for a 400-row ledger carries no original text, override history or relevance scores; a size test bounds it. `memoryView.scriptMemories.test.ts` (builder) and `statCodeExecutor.memories.test.ts` › carries only the entry fields (trim removed → red)
- [x] Four gates green. Review gates: typecheck and changed-file lint PASS; prepare runs the full list before it lands

## Blocked by

- 02 (Diary On Entities And The Rewrite Pass)

## Landed

**Not verified**

- None.

**For you**

- Ticket 07: import `MEMORY_ENTRY_FIELDS` from `src/lib/statCodeSurface.ts` for the element cards and menu rows (Q39). The `memories` card describes the fields in prose, since the copy register bans the word `kept`.
- Ticket 10: the guide's Memory section only renames the calls here; R5's note that a pinned digest can lose on the band cap while a pinned line never does sits on the `memories.pin` card, not yet in the guide.
- Each run reads the list play built at its last render, so a Before and an After run of one turn read the same rows unless the history or pins changed between them. Say if you want one capture per turn instead.
- The rewrite leaves a script that declares its own `memory` untouched, as the diary pass does. A global `memory.add` inside such a script then fails at run time.
- Every run carries all rows in its prelude, as dictionaries did before Q37's text gate; ticket 12's lazy reads cover memory text.
- Open a world script's Variable menu: **Memories** lists **add** and **pin**.
