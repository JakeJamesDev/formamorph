# 11: Server Expired Suspension in Username Search

Status: done
Base: 30848fb
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q34)

Repo: FormamorphServer

## What to build

Mention resolution lifts an expired suspension before it decides whether an account is shown, but the username search filters on the stored suspended status. An account whose suspension has expired can be mentioned and is never suggested. Make the search treat an expired suspension the way mention resolution does.

Found by the close review.

## Acceptance criteria

- [x] An account whose suspension ended is suggested by the username search. (`feedbackAutocomplete.test.js`, state `st-expired`; red when the filter is reverted)
- [x] An account still inside its suspension is not suggested. (same test, states `st-running` and `st-open-ended` with no end)
- [x] The search and mention resolution agree on every account state, shown by one test that checks both. (same test, four states, both paths asserted)

## Landed

**Not verified**
- None. The review ran inline on a 2-file diff, with no sub-agents.

**For you**
- None. The search filters on the end time and writes nothing; the first mention or the sweep still lifts the row.
