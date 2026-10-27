# 08: Server Autocomplete Searches

Status: done
Base: 872f0f8
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q15, Q17); server spec: Autocomplete reads

Repo: FormamorphServer

## What to build

Two signed-in reads for the editor's autocomplete. A username prefix search that ranks the given thread's reporter and commenters first. A thread search by number prefix or title words, over threads the caller can read.

## Acceptance criteria

- [x] The username search matches case-insensitively by prefix, ranks the thread's participants first, caps its result count and is rate-limited. (`tests/feedbackAutocomplete.test.js`: prefix and case, participant ranking, cap of 8, 429 after 120 per account)
- [x] The thread search matches number prefix or title words, returns number, title, type and status, and never returns a thread the caller cannot read. (same file: number prefix with exact first, word prefixes, `canRead` forced false returns nothing)
- [x] Both refuse a guest. (same file: 401 on each)

## Landed

Spec rulings added while building: names a mention can parse only; suspended accounts left out; optional `types` filter (Q31).

**Not verified**
- Coverage was not measured.
- A thread the caller cannot read is tested with `Feedback.canRead` forced false. Every signed-in user reads every thread today, so no real unreadable thread exists to test.

**For you**
- Nothing only a player can judge. Ticket 09 builds the editor on these reads.
