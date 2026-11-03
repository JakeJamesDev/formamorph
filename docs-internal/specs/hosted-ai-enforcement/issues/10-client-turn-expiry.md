# 10: Client Expires Turn Ids

Status: ready-for-agent
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Client, Q14, Q18, Q26)

Model rationale: turn state shared by concurrent calls, with waiters and a clock.

**What to build:** late work never sends an expired turn id. A turn's clock starts when its opening call is sent. After `turnLimitSeconds` less a margin, the turn clears its id and the next call opens a new turn. That call faces the budget check, so background work pauses on a spent week, and the allowance surface says so.

- [ ] A call just before the margin sends the id, and a call just after it opens a new turn with no id.
- [ ] Concurrent calls after expiry share one new turn: one opens it, and the others wait for its id.
- [ ] A null limit means no client expiry.
- [ ] An expired turn no longer counts as started, so a spent or paused state applies to its next call.
- [ ] A background pass and a scene-tags call on an old turn succeed under budget after expiry.
- [ ] The allowance surface has one line saying background work pauses when the week is spent. It names no weekday and follows the Writing Guide.
- [ ] Frames at `.scratch/frames/allowance-background-*.png`, light and dark.
- [ ] The Formamorph AI glossary entries state the rule, and a changelog fragment is added.
