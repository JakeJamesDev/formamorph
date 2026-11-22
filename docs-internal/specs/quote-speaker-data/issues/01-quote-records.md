# 01: Quote Records Carry Their Rule and Mentions

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

This ticket prepares the code for the spec's speaker and contribution work. Each quote speaker that the Mention Reading returns also records how it was found:

- **The rule that fired:** `after-subject-verb`, `after-verb-subject`, `before-verb`, `beat`, `nearest-subject` or `none`.
- **The rule's mention:** the span of the mention that rule used, when there is one.
- **First-person mentions:** the spans of the quote's own I, me, my, mine and myself.

The reading module gains a `readingVersion` constant. Raise it whenever the speaker or naming rules change.

No speaker changes in this ticket. Quote colors look exactly as before.

## Acceptance criteria

- [x] Each quote from the reading carries its rule, its rule's mention span (or none) and its first-person mention spans. Verified by `readMentions quote records` tests.
- [x] Tests at the reading seam cover each rule, a quote with no speaker, and a quote with first-person mentions. Two mutations (no word boundary, dropped beat mention) turned the right tests red.
- [x] Every existing reading test passes unchanged, so the speakers are the same as before. `src/lib/coref`, `src/contexts` and `MentionCards` tests: 93 files green.
- [x] The reading exports a `readingVersion` constant. Test `exports a readingVersion`.

## Landed

**Not verified**
- The record fields are not kept in a save: `restoreMentionReadings` still rebuilds quotes as `start`, `end`, `speaker`, and `correctReading` makes corrected quotes without them. Tickets that send the records must read them from a fresh reading, or widen the restore (a save-shape change).

**For you**
- Nothing for a player to judge: quote colors are unchanged.
