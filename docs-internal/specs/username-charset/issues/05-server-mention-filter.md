# 05: Server Mention Filter

Status: done
Base: 0a8d6b7
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q15); server spec: Search and mentions

Repo: FormamorphServer

## What to build

The feedback username search returns only unflagged accounts. Mention resolution picks the oldest unflagged account that matches ignoring case. So `@alice` reaches the account that keeps the name.

Start only after feedback-links ticket 08 (autocomplete searches) has landed, because that ticket builds the username search.

## Acceptance criteria

- [x] A flagged twin never appears in the username search. (feedbackAutocomplete: "skips a flagged twin until it renames")
- [x] A mention of a shared name resolves to the unflagged account and badges only that account. (feedbackMentions: "reaches the unflagged account of a shared name")
- [x] After the flagged account renames, its new name appears in the search. (same autocomplete test, via the rename route)

## Landed

**Not verified**
- Tests do not prove each guard fails without the filter (no revert run).
- No lint run: the repo has no ESLint config.

**For you**
- Nothing.
