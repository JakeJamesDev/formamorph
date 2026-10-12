# 02: Semantic Search on the Search Tab

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Search tab finds sections by meaning when Semantic Search is on (Q3, Q4, Q7).

- The rank-fusion search that Ask uses becomes a function the Search tab calls, with the sources Keyword and Semantic. AI Search stays off for the Search tab.
- Keyword results show at once. The semantic ranking runs after a short pause in typing, and the merged results replace the keyword results when it returns. A late result for an old query never replaces a newer one.
- A semantic-only hit needs a minimum similarity, so a nonsense query still reads "No sections match".
- With the switch on and the model not on the device (downloading, or offline on web), the tab uses keywords alone, with no notice. The source never starts a download.
- The glossary entry for Search Source changes: the Search tab uses Keyword and Semantic.

Spec: Implementation Decisions → The Search tab uses the help session's merged search; Semantic ranking on the Search tab.

Recommended model rationale: a seam lift in the help session plus async ranking with stale-result and unmount handling.

## Acceptance criteria

- [ ] With a fake embedder, a meaning-only query finds its section on the Search tab; with the switch off it does not.
- [ ] The model absent → keyword results only, no notice, no download started.
- [ ] A nonsense query with the switch on shows "No sections match"; the floor is proven to bite.
- [ ] A slow ranking for an old query does not replace the current results; no write after unmount.
- [ ] Ask's merged search behavior is unchanged (existing sources tests pass).
- [ ] Changelog fragment written; four gates green.
