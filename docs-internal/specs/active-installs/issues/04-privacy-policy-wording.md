# 04: Privacy Policy Wording

Status: ready-for-human
Base: 133941e
Blocked by: 01, 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/active-installs/spec.md` in formamorph (Privacy policy, Further Notes)

Model rationale: one text edit whose content the earlier tickets fix.

## What to build

The privacy policy names the daily send, in one edit to the same unpublished policy that already holds the telemetry wording, so players see one re-accept for both. Publishing and re-accept happen at deploy and are not part of this ticket.

## Acceptance criteria

- [x] The opening scope sentence names the daily send. (diff read)
- [x] A new section says the send happens once a day after the age gate, what it holds, that the hash can be matched to a claimed account while the month is open, how long rows, nightly copies and totals are kept, and that the Settings switch turns it off. ("Counting active installs"; `bootSchema` test asserts the heading and the switch name)
- [x] The guest-likes section describes the Install as made by every copy of the app, and says signing in links it to the account whether or not it gave a guest like. (diff read; `bootSchema` test asserts the sign-in sentence)
- [x] The retention list gains the daily records and the totals. (diff read)
- [x] Every new statement matches what tickets 01 to 03 landed. (read against the spec's ticket rulings and ticket 03's "Daily Check-In" path; nightly copies use the file's 30 days, as the spec session ruled)
- [x] The telemetry wording already in the file is unchanged. (diff touches no line of the two Formamorph AI sections)

For you: confirm the Caddy access-log check from the spec's Further Notes at deploy, and decide re-accept for the combined publish.

## Landed

The spec session ruled nightly copies at 30 days, the file's number, not the spec's 14. The `bootSchema` test pinned the old sign-in sentence, so it now pins the new one and the new section.

**Not verified**

- None. The wording has no player-facing run to check beyond the diff and the seeded-policy test.

**For you**

- Confirm the Caddy access-log check from the spec's Further Notes at deploy, and decide re-accept for the combined publish.
