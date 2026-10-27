# 11: Server Expired Suspension in Username Search

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q34)

Repo: FormamorphServer

## What to build

Mention resolution lifts an expired suspension before it decides whether an account is shown, but the username search filters on the stored suspended status. An account whose suspension has expired can be mentioned and is never suggested. Make the search treat an expired suspension the way mention resolution does.

Found by the close review.

## Acceptance criteria

- [ ] An account whose suspension ended is suggested by the username search.
- [ ] An account still inside its suspension is not suggested.
- [ ] The search and mention resolution agree on every account state, shown by one test that checks both.
