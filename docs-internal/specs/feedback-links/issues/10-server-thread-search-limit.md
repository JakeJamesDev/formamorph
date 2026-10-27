# 10: Server Thread Search Limit

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q17, Q31)

Repo: FormamorphServer

## What to build

The thread search applies its 8-row limit in SQL, then drops the rows the caller cannot read. Once the bug-read rule tightens, a page of unreadable rows hides readable matches, and the search returns fewer than 8 results or none. Apply the read rule before the limit, so the search always returns up to 8 readable matches.

Found by the close review. Harmless today, because every signed-in user can read every thread.

## Acceptance criteria

- [ ] With more than 8 unreadable matches ahead of readable ones, the search still returns up to 8 readable matches. The test forces the read rule, as ticket 08's tests do.
- [ ] The search still returns number, title, type and status, and honors the `types` filter.
