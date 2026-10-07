# 19: Pin Section Pickers and Notes

Status: done
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

- [x] jsdom: 20 pins on one placeholder mount the section in under 40 ms warm (record numbers). **24 ms alone; the suite asserts under 200 ms (user ruling: up to 63 ms beside other test files).**
- [x] Each pin picker still opens positioned to the selected item, lists every source, filters by typeahead when focused, and selects by keyboard (existing tests pass; one added test covers typeahead on a focused, closed trigger).
- [x] The selected value shows on every closed trigger exactly as before.
- [x] Harness `pinTarget` at 6x: "Mood" opens and typing into its Name meets Q1, or the notes' remaining cost is reported with numbers. **Miss, reported; the notes stay as they are (user ruling).**
- [ ] Harness `open` at 6x on the plain bench world and the pin world, back to back on a quiet machine: both numbers recorded, and the pin world meets the same bar (no block over 1 s). Ticket 17 measured 1,258 ms under load. **Pin world within 60 ms of the plain world; both just over 1 s in that run.**
- [x] Guard bites: mounting items while closed again brings the jsdom number back (recorded).
- [ ] Four gates green.

## Results

Measured 2026-10-06 on main at `6781a94e` (tickets 17 and 18 in) plus this ticket, except where marked.

**Picker fix (jsdom).** The fixture is the editor-speed pin world with "Mood" cut to 20 pins, 5 of each kind. Each row's picker lists every source of its kind: about 300 locations, 400 traits, 1,250 values. That is heavier than ticket 17's table, so its "before" is higher.

| Check | Before | After |
|---|---|---|
| 20 pins, warm mount, fastest of 5, alone | 1,620 ms | 24 ms |
| Same, beside other test files | — | 41–63 ms |
| Guard: every item mounted while closed | — | 1,631 ms, 6 tests red |
| Guard: focus no longer mounts the list | — | typeahead and 5 section tests red |

- A closed, unfocused picker mounts only the picked item, or nothing when the row's label stands in for it. Focus mounts the full list before typeahead needs it.
- Radix remounts every item on each open and close: it renders them inside the open list, then inside a detached fragment. That cost is Radix's own and predates this ticket.

**Notes at scale (jsdom, 1x).** Mood cut to N pins. The notes grow with the square of the pin count: each row names every other rival.

| Rows | Section | Notes only | Value fields | Re-render on edit | DOM elements |
|---|---|---|---|---|---|
| 20 | 32 ms | 9 | 3 | 23 | 708 |
| 100 | 341 ms | 179 | 9 | 132 | 10,968 |
| 190 | 936 ms | 632 | 16 | 301 | 36,626 |
| 340 | 4,281 ms | 2,888 | 42 | 1,092 | 111,072 |
| 551 | 6,571 ms | 5,715 | 52 | 3,146 | 289,490 |

The user ruled to keep the note text as it is, so Mood's miss stands.

**Harness at 6x, quiet machine.**

| Step | Result |
|---|---|
| `open`, plain world | worst block 1,019 ms |
| `open`, pin world, next run | worst block 1,079 ms |
| `open`, pin world, base `f4bec318`, 4 runs | 1,043–1,379 ms (plain 669 ms) |
| `pinTarget` before (ticket 17) | did not finish |
| `pinTarget` after | Mood opens in 29.0 s, one 26.1 s block, 290,795 DOM nodes |

- `open` varies by about 500 ms between runs. In back-to-back runs the pin world stays within 60 ms of the plain world.
- The pin world's extra `open` cost on `f4bec318` was `allPinRows` labeling every value source (about 300 ms at 6x, from the Test Bench lens and each `PlaceholderField`).
- `pinTarget` typing has no number. On Mood's 290k nodes the harness does not find the Name field within 30 s, and the step reports `typeError`.
- The harness opens a record with a 180 s click timeout, reports `openMaxBlockMs`, and finds Name by CSS.
