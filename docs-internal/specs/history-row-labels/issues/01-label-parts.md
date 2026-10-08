# 01: Label parts and accessible name

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a mechanical split of one pure function with an exact-output guard; no visual work.

Parent: [History Row Labels spec](../spec.md)

## What to build

The History label becomes structured data, with nothing an author sees changing. Every History row still shows today's flat text, and each row button is named by that full label for assistive technology.

- The History label module returns label parts for a Step: verb, type, slice, name, field. The shape is in the spec's Implementation Decisions (from the prototype). A labeled Step returns its label as the verb alone. An empty record name becomes no name.
- The flat label is the parts joined. Its text is byte-identical to today for every Step shape.
- The History view carries parts per row. The world history hook and the design-system reference both build rows from parts.
- The row renders the joined text for now, and the row button's `aria-label` is that text.

## Acceptance criteria

- [ ] Label tests cover the parts for: keyed record edit with a field, add, remove, nested placeholder Copy, dictionary entry (type "Entry"), World overview with one field and with several, multi-record edit, reorder, labeled batch, and an empty-name record.
- [ ] For each of those shapes, a test asserts that the flat label equals the joined parts and matches today's text.
- [ ] The existing History popover tests pass unchanged, apart from queries that now read the accessible name.
- [ ] A test asserts that a row's accessible name is the full joined label.
- [ ] Guard bites: breaking the join (for example, dropping the field) fails the flat-label tests.
- [ ] Four gates green.
