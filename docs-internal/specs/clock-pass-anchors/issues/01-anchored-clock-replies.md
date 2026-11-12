# 01: Anchored Clock Replies

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The clock pass can answer "until dawn" (or another anchor) as text, and the player's story clock lands at that time of day, measured from the clock at the turn's start. This ticket owns the reading the clock pass answers with and the anchor math; ticket 02 builds the schema request on them.

- The clock pass's answer becomes a reading: an anchor or none, plus a count and unit when given. The turn commit resolves it to hours (spec, Implementation Decisions: anchor math, guard, day carry, fractions of the day).
- The text reply format is a reply-format block on the clock pass's user message, its own run in the request anatomy, like the Inventory pass. The default clock prompt drops the format sentences the block now carries.
- Text parsing reads "until <anchor>" first, then a count and unit as today. An unreadable reply still costs the flat hour.

## Acceptance criteria

- [x] A text reply "until dawn" costs 9 hours from a 21:00 start and 4 hours from a 02:00 start. (computeTurnCommit test "lands a sleep until dawn at dawn")
- [x] Every anchor resolves to its next occurrence; an anchor equal to the start time costs a full day. ("runs every anchor forward", "costs a full day for an anchor the clock already stands on")
- [x] A count of one day or more with an anchor adds the whole days beyond the first (a four-day journey reaching a morning; a one-day "next morning"). ("carries the whole days beyond the first"; disabling the carry fails it)
- [x] The 20h guard: an anchor landing more than 20 of 24 hours ahead with a count under a day costs the count instead. Reverting the guard fails its test. ("trusts a sub-day count…"; with the guard off, it and the custom-calendar test fail)
- [x] Anchors divide a custom-length calendar by the same fractions as dayparts. ("divides a custom-length day by the same fractions", 12-hour day)
- [x] On the opening turn, an anchor measures from the opening hour seeded that turn. ("measures the opening turn from the opening hour it seeds"; dropping the merge fails it)
- [x] A count and unit with no anchor costs count × unit; an unreadable reply costs the flat hour; with the AI clock off, Time Per Turn applies unchanged. ("charges a count with no anchor as stated", "charges the flat hour for an anchor it cannot read", the existing clock tests)
- [x] The reply-format block shows as its own run in the request anatomy. (turnPasses test "appends the text reply format as its own run")
- [x] The probe scores the app's real parser and anchor math (no copies in the harness), with the shipped request as the in-batch control, on both case files: cloud 12 runs, numbers in the Landed section. (`time-delta-probe.cli.ts`, numbers below)
- [x] World and save `.json` shape unchanged: a turn still stores its hours. (`timeDelta` still holds hours; no type in `@/types` changed)
- [x] Changelog fragment written. (`docs-internal/changelog.d/clock-pass-anchors-01.md`)

For you: play a turn with the AI clock on where the character sleeps until dawn, and check the clock in the turn log lands at dawn.

## Landed

Probe, cloud default endpoint, 12 runs, control = the clock prompt and parser at 8b9ea6e4e, dispatched in the same batch:

| Arm | Main set | Anchored | Unanchored | Dialogue set |
|---|---|---|---|---|
| Shipped (control) | 53% | 13% | 83% | 56% |
| Text, spike sentence (landed) | 79% | 88% | 73% | 70% |
| Text, first wording (dropped, Q8) | 42% | 13% | 64% | 40% |

- The first wording ("write until and that time of day instead") drew bare "dawn" replies the parser rejects, so per Q8 the block carries the spike sentence.
- Unanchored misses on the main set: a walk at 3h, a night's sleep at 2–3 days (the control reads 1 day), "the next morning" at 1 day. The schema in 02 targets these.
- The probe moved to `testing/baseline/harness/time-delta-probe.cli.ts` (vite-node) so it imports the app's pass and math; the spike arms are gone.

**Not verified**
- MeroMero numbers: Q6 moves them to 02.

**For you**
- Play a turn with the AI clock on where the character sleeps until dawn, and check the clock in the turn log lands at dawn.
- A clock system prompt you edited in Settings before this change still ends with "Your entire reply is that count and its unit…". The appended format adds "or until and a time of day" after it. Reset the Clock prompt if anchors never land.
- Named, not changed (Q11): on the opening turn, the stat-code clock's calendar is `{ startHour }` alone and drops a calendar's `hoursPerDay`. No world sets `hoursPerDay` today.
