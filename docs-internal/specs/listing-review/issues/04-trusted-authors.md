# 04: Trusted Authors

Status: done
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

- [x] A schema step adds `trusted_at` to `users`. (bootSchema "leaves every existing account untrusted"; fresh-database step list)
- [x] `PUT` and `DELETE /api/users/:id/trust` work for admins, refuse mods, and write `author_trusted` / `author_untrusted`. (trustedAuthors "granting and revoking trust"; admin gate removed once, went red)
- [x] The auth middleware queries, `User.findById` and the staff user list read `trusted_at`. The public profile does not show it. (staff list `trustedAt` and both profile reads asserted; `protect` read removed once, went red)
- [x] Review on: a trusted author's new listing is `approved` and writes `listing_auto_approved` with `target_id`. (trustedAuthors "goes live at once while review is on")
- [x] Revoking trust sends that author's next listing to the queue. (trustedAuthors "waits for review again once trust is revoked, with the same session")
- [x] `GET /api/reviews/auto` lists recent auto-approvals newest first, with `target_id`, for `canModerate` only. (trustedAuthors "the auto-approval list"; answers `{ success, total, entries }` per T11; staff gate removed once, went red)

## Landed

Server commit: FormamorphServer `ce4e762` ("Add Trusted Authors").

**Not verified**

- The `optionalAuth` query selects `trusted_at`, but no current route behaves differently on it, so no test covers it.

**For you**

- Nothing a player can judge: server routes only. The client surfaces for trust and the auto-approval list come with client tickets 08 and 10.
