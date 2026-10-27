# 09: Server Rename Cleanup

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q22); server spec: Rename route, Search and mentions

Repo: FormamorphServer

## What to build

The rename route trusts its own write result, the username code loses a test-only export and a duplicated refusal body, and the two folded-name lookups say in their names whether they skip flagged accounts. The close review found these.

## Acceptance criteria

- [ ] When the guarded rename write changes no row (the flag was cleared in between), the route answers the unflagged refusal and writes no audit row. A test covers it.
- [ ] Registration and rename build the 400 rule refusal through one helper.
- [ ] The rule-text re-export used only by tests is gone; the test reads the config directly.
- [ ] The rule text is built from the length constants beside it, not repeated.
- [ ] The plural folded lookup that skips flagged accounts has a name that says so, and its callers use the new name.
- [ ] The server README matches any name it mentions.
