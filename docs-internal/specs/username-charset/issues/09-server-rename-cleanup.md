# 09: Server Rename Cleanup

Status: done
Base: ec65f34
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q22); server spec: Rename route, Search and mentions

Repo: FormamorphServer

## What to build

The rename route trusts its own write result, the username code loses a test-only export and a duplicated refusal body, and the two folded-name lookups say in their names whether they skip flagged accounts. The close review found these.

## Acceptance criteria

- [x] When the guarded rename write changes no row (the flag was cleared in between), the route answers the unflagged refusal and writes no audit row. A test covers it. (`usernameRename.test.js`: "refuses and logs nothing when the flag is cleared between the read and the write"; fails with the guard removed)
- [x] Registration and rename build the 400 rule refusal through one helper. (`usernameRefusal`; existing refusal tests pass)
- [x] The rule-text re-export used only by tests is gone; the test reads the config directly. (`usernameRule.test.js` imports from `config/username`)
- [x] The rule text is built from the length constants beside it, not repeated. (existing "words the rule as the client shows it" test still passes)
- [x] The plural folded lookup that skips flagged accounts has a name that says so, and its callers use the new name. (`findAllUnflaggedByUsernamesFolded`; one caller, `feedbackMentions.js`)
- [x] The server README matches any name it mentions. (README names no lookup; no change)

## Landed

**Not verified**: none. Full `npm test` passed in the review gate; prepare reruns the full gates.

**For you**: nothing only a player can judge.
