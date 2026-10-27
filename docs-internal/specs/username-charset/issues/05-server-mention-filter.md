# 05: Server Mention Filter

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q15); server spec: Search and mentions

Repo: FormamorphServer

## What to build

The feedback username search returns only unflagged accounts. Mention resolution picks the oldest unflagged account that matches ignoring case. So `@alice` reaches the account that keeps the name.

Start only after feedback-links ticket 08 (autocomplete searches) has landed, because that ticket builds the username search.

## Acceptance criteria

- [ ] A flagged twin never appears in the username search.
- [ ] A mention of a shared name resolves to the unflagged account and badges only that account.
- [ ] After the flagged account renames, its new name appears in the search.
