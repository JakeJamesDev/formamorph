# 01: Anchored Clock Replies

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The clock pass can answer "until dawn" (or another anchor) as text, and the player's story clock lands at that time of day, measured from the clock at the turn's start. This ticket owns the reading the clock pass answers with and the anchor math; ticket 02 builds the schema request on them.

- The clock pass's answer becomes a reading: an anchor or none, plus a count and unit when given. The turn commit resolves it to hours (spec, Implementation Decisions: anchor math, guard, day carry, fractions of the day).
- The text reply format is a reply-format block on the clock pass's user message, its own run in the request anatomy, like the Inventory pass. The default clock prompt drops the format sentences the block now carries.
- Text parsing reads "until <anchor>" first, then a count and unit as today. An unreadable reply still costs the flat hour.

## Acceptance criteria

- [ ] A text reply "until dawn" costs 9 hours from a 21:00 start and 4 hours from a 02:00 start.
- [ ] Every anchor resolves to its next occurrence; an anchor equal to the start time costs a full day.
- [ ] A count of one day or more with an anchor adds the whole days beyond the first (a four-day journey reaching a morning; a one-day "next morning").
- [ ] The 20h guard: an anchor landing more than 20 of 24 hours ahead with a count under a day costs the count instead. Reverting the guard fails its test.
- [ ] Anchors divide a custom-length calendar by the same fractions as dayparts.
- [ ] On the opening turn, an anchor measures from the opening hour seeded that turn.
- [ ] A count and unit with no anchor costs count × unit; an unreadable reply costs the flat hour; with the AI clock off, Time Per Turn applies unchanged.
- [ ] The reply-format block shows as its own run in the request anatomy.
- [ ] The probe scores the app's real parser and anchor math (no copies in the harness), with the shipped request as the in-batch control, on both case files: cloud 12 runs, numbers in the Landed section.
- [ ] World and save `.json` shape unchanged: a turn still stores its hours.
- [ ] Changelog fragment written.

For you: play a turn with the AI clock on where the character sleeps until dawn, and check the clock in the turn log lands at dawn.
