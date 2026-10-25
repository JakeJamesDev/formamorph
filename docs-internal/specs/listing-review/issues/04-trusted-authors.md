# 04: Trusted Authors

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec (Trust; rulings Q5, Q12, Q13, Q20, Q21)

Model rationale: a column, two routes and an extension of ticket 01's "skips review" check; the auth queries are the trap.

## What to build

Admins grant and revoke trust. A trusted author's new listings go live at once and are recorded as auto-approvals. Mods list recent auto-approvals.

Ticket 01 owns the "skips review" check; this ticket extends it with `trusted_at`. Updates by trusted authors are ticket 05's, through the same check.

## Acceptance criteria

- [ ] A schema step adds `trusted_at` to `users`.
- [ ] `PUT` and `DELETE /api/users/:id/trust` work for admins, refuse mods, and write `author_trusted` / `author_untrusted`.
- [ ] The auth middleware queries, `User.findById` and the staff user list read `trusted_at`. The public profile does not show it.
- [ ] Review on: a trusted author's new listing is `approved` and writes `listing_auto_approved` with `target_id`.
- [ ] Revoking trust sends that author's next listing to the queue.
- [ ] `GET /api/reviews/auto` lists recent auto-approvals newest first, with `target_id`, for `canModerate` only.
