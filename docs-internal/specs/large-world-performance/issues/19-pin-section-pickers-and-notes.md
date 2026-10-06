# 19: Pin Section Pickers and Notes

Status: ready-for-agent
Blocked by: 17
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: changes how Radix Select mounts its items without changing look, positioning, typeahead or keyboard behavior, then measures and reports a cost that may need a user ruling.

## What to build

A placeholder's pins section opens and edits without a hitch, even with hundreds of pins (Q26). After ticket 17, pin conflicts cost little, but opening "Mood" on the pin world still freezes at 6x. Users also report a hitch at about 20 pins, and a freeze on low-end machines. Ticket 17 measured the section in jsdom with 20 pins on one placeholder, warm mount:

| Part | Time |
|---|---|
| Whole section | 97–107 ms |
| 20 Selects with their items | 76–93 ms |
| 20 Selects with no items while closed | 16–28 ms |
| 20 conflict notes | 7.5 ms |

A closed Radix Select still mounts every item. Each pin row's source picker lists every source of its kind: about 300 items per location row and about 1,250 per value row on the bench world. "Mood"'s 551 rows mount about 360k items.

1. The pins section's Select pickers mount their full item list only while open or focused. Closed and unfocused, a picker mounts only what its trigger needs to show the selected value. No change to look, the open list's positioning, typeahead on a focused trigger, or keyboard behavior (Q13).
2. After (1), measure the conflict notes on "Mood". Its notes list about 250k rival names in total. If they still keep `pinTarget` over Q1, report to the spec session with numbers. Shortening, collapsing or deferring the visible note text needs a user ruling before it is built.

Report `npm run profile:editor-speed` pin steps before and after at 6x (Q7).

## Acceptance criteria

- [ ] jsdom: 20 pins on one placeholder mount the section in under 40 ms warm (record numbers).
- [ ] Each pin picker still opens positioned to the selected item, lists every source, filters by typeahead when focused, and selects by keyboard (existing tests pass; one added test covers typeahead on a focused, closed trigger).
- [ ] The selected value shows on every closed trigger exactly as before.
- [ ] Harness `pinTarget` at 6x: "Mood" opens and typing into its Name meets Q1, or the notes' remaining cost is reported with numbers.
- [ ] Harness `open` at 6x on the plain bench world and the pin world, back to back on a quiet machine: both numbers recorded, and the pin world meets the same bar (no block over 1 s). Ticket 17 measured 1,258 ms under load.
- [ ] Guard bites: mounting items while closed again brings the jsdom number back (recorded).
- [ ] Four gates green.
