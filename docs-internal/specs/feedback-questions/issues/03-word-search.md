# 03: Word Search

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/feedback-questions/spec.md` in FormamorphServer (Q19, Search)

Model rationale: one query in the list model, with tests through the existing list route.

## What to build

The feedback list's search matches the words a reader types in any order, not the whole text as one string. Results with more matching words come first. The normal search box and the duplicate check (ticket 06) both use it, for every type.

## Acceptance criteria

- [ ] `search` splits on whitespace and drops very short words. A thread matches when any word appears in its title or body.
- [ ] With search text, results sort by the number of matching words, then by the chosen sort.
- [ ] Words are bound as parameters, and `%` and `_` in the text match literally.
- [ ] Empty or all-short text behaves as no search.
- [ ] The existing feedback search tests still pass or are updated where the old whole-string match was pinned.
- [ ] Tests cover words in any order, ranking by matching words, and a search scoped to one type.
