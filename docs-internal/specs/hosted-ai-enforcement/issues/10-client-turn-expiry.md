# 10: Client Expires Turn Ids

Status: ready-for-human
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Client, Q14, Q18, Q26)

Model rationale: turn state shared by concurrent calls, with waiters and a clock.

**What to build:** late work never sends an expired turn id. A turn's clock starts when its opening call is sent. After `turnLimitSeconds` less a margin, the turn clears its id and the next call opens a new turn. That call faces the budget check, so background work pauses on a spent week, and the allowance surface says so.

- [x] A call just before the margin sends the id, and a call just after it opens a new turn with no id. `sends the id just before the margin and opens a new turn at the margin`.
- [x] Concurrent calls after expiry share one new turn: one opens it, and the others wait for its id. `shares one new turn among concurrent calls after expiry`.
- [x] A null limit means no client expiry. `never expires the id with a null limit`, and with no limit field.
- [x] An expired turn no longer counts as started, so a spent or paused state applies to its next call. `applies a spent week…` and `applies a paused day…`.
- [x] A background pass and a scene-tags call on an old turn succeed under budget after expiry. `finishes a late summary call…` and `finishes a late sceneTags call…`.
- [x] The allowance surface has one line saying background work pauses when the week is spent. It names no weekday and follows the Writing Guide. `says background work pauses on a spent week…`, and a DOM read of the popover.
- [x] Frames at `.scratch/frames/allowance-background-*.png`, light and dark. Allowance Ring popover in the `ready` dev route.
- [x] The Formamorph AI glossary entries state the rule, and a changelog fragment is added. `CONTEXT.md` and `docs-internal/changelog.d/hosted-ai-enforcement-10.md`.

## Landed

**Not verified**

- All criteria are ticked. Expiry against the live server is untested: the tests use the fake proxy and a fake clock.

**Known remaining case (spec ruling: clock only)**

- A turn at its call cap, or a limit lowered after the client's last state read, gets `turn_expired` and keeps failing until the local expiry.

**For you**

- Read the new line in the Allowance Ring popover: `.scratch/hosted-ai-enforcement-10/frames/allowance-background-light.png` and `.scratch/hosted-ai-enforcement-10/frames/allowance-background-dark.png`.
- The copy says "background requests" to match **Show Silent Requests**, where the ticket says "background work". The line is `HOSTED_BACKGROUND_HELP` in `src/lib/hostedAi/hostedCopy.ts`.
