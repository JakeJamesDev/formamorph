# 02: Suspension end in the log and settings

Status: done
Blocked by: None (can start immediately)
Server dependency: FormamorphServer `docs-internal/specs/timed-suspensions/issues/02-suspension-sweep.md` must land first.
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Small presentation additions on existing surfaces.

## What to build

The audit log shows a suspension that ended on its own, with its own label, pill, and filter. Each Suspended entry shows the chosen end. A suspended user's account settings note names the end date.

## Acceptance criteria

- [ ] `suspension_expired` has a label, a pill style, a filter option, and a detail line that names no actor.
- [ ] `user_suspended` details show the server's end snippet.
- [ ] The signed-in account type gains `suspended_until: string | null`.
- [ ] The account settings suspended note names the end date when there is one, and keeps today's text when there is none.
- [ ] A refused action's toast shows the server's dated text. Verify it; change nothing unless the toast drops it.
- [ ] Tests in `AuditLogTab` and the account settings tests cover each criterion above.
