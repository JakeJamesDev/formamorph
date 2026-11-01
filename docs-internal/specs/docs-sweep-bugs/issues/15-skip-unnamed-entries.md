# 15: Scripts Skip Unnamed Dictionary Entries

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one shared builder feeds the script map, the write-back and the code cards.

## What to build

Every unnamed dictionary entry gets the script key `""`, so a script reaches only one of them and a write through that key toggles only that one. Ruling Q9: scripts see only named entries, the rule entities already follow. The named-entries builder skips blank names for the script map, the write-back and the code cards. Toggles stay keyed by entry id.

Spec: Q9, Implementation Decisions "Unnamed entries". Evidence: docs-sweep ticket 15, Landed.

## Acceptance criteria

- [x] A test with two unnamed entries and one named entry fails today (an empty-string key), then passes with only the named key. `namedEntries (Q9)` in `loreToggles.test.ts`: red before the fix, green after
- [x] A script write to a named entry still toggles it (existing write-back tests green). `statCodeExecutor*` and `codeCards*` suites green
- [x] Scripts-Reference says unnamed entries are left out, beside the entry-name rules; the docs tests are green. `docs` tests green
- [x] A changelog fragment under Minor / Fixed / 👤. `docs-internal/changelog.d/docs-sweep-bugs-15.md`

## Landed

**Not verified**
- None. The test sits on `namedEntries` itself, the one builder the script map, write-back and code cards share. No executor-level test with unnamed entries was added.

**For you**
- Whitespace-only names still count as named, as for entities (`hasEntityKey` checks `''` only).
