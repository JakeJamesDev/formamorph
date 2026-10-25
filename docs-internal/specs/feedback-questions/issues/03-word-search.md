# 03: Word Search

Status: ready-for-human
Base: 2916ccee6
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/feedback-questions/spec.md` in FormamorphServer (Q19, Search)

Model rationale: one query in the list model, with tests through the existing list route.

## What to build

The feedback list's search matches the words a reader types in any order, not the whole text as one string. Results with more matching words come first. The normal search box and the duplicate check (ticket 06) both use it, for every type.

## Acceptance criteria

- [x] `search` splits on whitespace and drops very short words. A thread matches when any word appears in its title or body. (tests "matches a thread that holds any one word", "drops words under three characters, but keeps a capitalized pair")
- [x] With search text, results sort by the number of matching words, then by the chosen sort. ("ranks more matching words first, then the chosen sort"; fails without the rank term)
- [x] Words are bound as parameters, and `%` and `_` in the text match literally. (existing escape test, unchanged)
- [x] Empty or all-short text behaves as no search. ("drops words under three characters…": `is` returns every thread)
- [x] The existing feedback search tests still pass or are updated where the old whole-string match was pinned. (182/182 across the three feedback suites on HEAD plus this change alone)
- [x] Tests cover words in any order, ranking by matching words, and a search scoped to one type. ("matches words in any order", ranking test, existing "searches a suggestion board")

## Landed

FormamorphServer `f1df356`. Built in the shared server checkout; the spec session committed the ticket's hunks as a filtered stage, because the claim hook demands a client-repo worktree. The three feedback suites passed on HEAD plus this change alone (182/182, 20s wall). Review by hand against `598ac88`: no findings.

**Not verified**: nothing open.

**For you**: try a few real searches on the live board once deployed.
