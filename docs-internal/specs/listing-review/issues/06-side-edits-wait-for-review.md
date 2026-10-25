# 06: Side Edits Wait For Review

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec (Pending updates; rulings Q25, Q26)

Model rationale: six write routes each need the same detour, and the changelog needs ordered operations replayed at approval.

## What to build

On an approved listing, dependency, compatibility, spoiler and changelog edits join the pending update instead of going live. So do the visibility, dependency and compatibility writes inside the main update. During contest judging, approving an update to a contest entry waits for results.

## Acceptance criteria

- [ ] `PUT /:id/dependencies`, `PUT /:id/compatibility`, `PUT /:id/spoiler`, and changelog create, edit and delete each write to the pending update (creating it if needed) for a normal author on an approved listing.
- [ ] The same writes apply at once on a `pending` or `rejected` listing, and for trusted authors and staff.
- [ ] Players see the approved dependencies, compatibility, spoiler flag and changelog until approval.
- [ ] Approval applies them all in the one transaction, with one `revision` raise; rejection drops them.
- [ ] The queue item lists the changelog operations in order.
- [ ] During judging, approving an update to a contest entry answers `409` and the item stays queued; a new contest entry still approves.
