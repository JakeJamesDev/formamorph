# 04: Server Mentions

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q5, Q6, Q8, Q9, Q10, Q18, Q19, Q23); server spec: Mentions table, Parse on write, Cap, Participation

Repo: FormamorphServer.

## What to build

An `@username` on a suggestion or question makes that user a party to the thread, so the thread badges them. Mentions follow the current text. A post over the writer's cap is refused. A bug mention grants nothing.

## Acceptance criteria

- [ ] Create, edit and delete of a thread body or comment keep the mentions table equal to the current text, in the write's transaction.
- [ ] On a suggestion or question, a mentioned user's unread count includes the thread until they read it, and later comments badge them.
- [ ] Removing a mention drops the claim. A reply or a question vote by the same user keeps it.
- [ ] A bug mention adds nothing to the mentioned user's badge. Proven to bite: removing the bug exclusion fails the test.
- [ ] Caps: admin none, moderator 10, everyone else 5, counting distinct users with self and unknown names dropped. Over the cap, create and edit return 400 naming the cap.
- [ ] User targets on the DTO carry id, username and avatar. An unknown name returns the unavailable user target with no name.
- [ ] `participationClause` and `hasParticipated` still agree, shown by a test that checks both on every case.
