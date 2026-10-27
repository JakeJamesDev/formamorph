# 04: Server Mentions

Status: done
Base: b806e5a
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q5, Q6, Q8, Q9, Q10, Q18, Q19, Q23); server spec: Mentions table, Parse on write, Cap, Participation

Repo: FormamorphServer

## What to build

An `@username` on a suggestion or question makes that user a party to the thread, so the thread badges them. Mentions follow the current text. A post over the writer's cap is refused. A bug mention grants nothing.

## Acceptance criteria

- [x] Create, edit and delete of a thread body or comment keep the mentions table equal to the current text, in the write's transaction. — `feedbackMentions.test.js` "a mention on a suggestion or a question" (edit in/out, comment edit/delete, thread and account delete); `setMentions` runs inside each write's transaction.
- [x] On a suggestion or question, a mentioned user's unread count includes the thread until they read it, and later comments badge them. — "badges the suggestion/question until read, then badges later comments".
- [x] Removing a mention drops the claim. A reply or a question vote by the same user keeps it. — "stops badging once…", "keeps the thread for a user who replied…", "keeps a question for a user who voted…".
- [x] A bug mention adds nothing to the mentioned user's badge. Proven to bite: removing the bug exclusion fails the test. — "a mention in a bug" tests; mutations (mention claim on the bug branch, `hasParticipated` board check removed, news-clause type gate removed) each turned them red.
- [x] Caps: admin none, moderator 10, everyone else 5, counting distinct users with self and unknown names dropped. Over the cap, create and edit return 400 naming the cap. — "the mention cap" tests: normal 5, mod 10, dev 10 (Q34), admin 30 OK; create, comment add, comment edit and thread edit each refused.
- [x] User targets on the DTO carry id, username and avatar. An unknown name returns the unavailable user target with no name. — "a user target" tests: unknown, suspended and `[deleted user]` all `{ kind, ref, available: false }`; capitals collision follows the /u/<name> pick.
- [x] `participationClause` and `hasParticipated` still agree, shown by a test that checks both on every case. — "participationClause and hasParticipated" table: 10 cases, each asserting the badge and `hasParticipated`.

## Landed

**Not verified:** none.

**For you:**
- Nothing a player can see yet. Mentions show once tickets 05 and 07 render user chips.
- Adjacent, not changed: a comment written in the same millisecond as a read is not newer than the read marker, so it never badges. This was the rule before this ticket. Only tests trip on it; `feedbackMentions.test.js` waits out the millisecond after each read.
