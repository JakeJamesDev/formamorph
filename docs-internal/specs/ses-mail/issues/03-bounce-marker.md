# 03: Bounce Marker

Status: ready-for-human
Base: b17f9ea
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/ses-mail/spec.md` in formamorph (Bounce marker, API changes; Q4, Q8, Q9, Q14, Q18)

Model rationale: it changes who can reset a password, and a late event for an old address must never mark a new one.

## What to build

A hard bounce or a spam complaint marks the account's current address and removes its verification. While the marker is set, the server sends no verification and no reset mail to that address. Changing the address clears the marker. The account summary carries the marker's reason, so clients can show it. The reset page's answer does not change.

This ticket owns the marker columns and the "address set at" time on the user.

Only a row that is `bounced` with type `hard`, or `complained`, sets the marker. A soft bounce never does. Ticket 02's event fixtures come from Amazon's documents, not from a live event. If the user has shared a live event by the time this ticket starts, check the fixtures against it first.

## Acceptance criteria

- [x] An additive schema step adds the marker time, the marker reason (`bounce` or `complaint`) and the time the address was set. The boot-schema list includes it. *Step `emailMarker`; bootSchema "stamps every existing address as set at the migration, unmarked, once".*
- [x] A bounce event for a mail sent to the current address sets the marker with reason `bounce` and removes verification. *bounceMarker "marks the address on a hard bounce and removes its verification", plus the suppression-list bounce.*
- [x] A complaint event does the same with reason `complaint`. *"marks the address on a complaint and removes its verification".*
- [x] A delay event sets no marker. *"leaves the address alone on a delay" and "on a soft bounce".*
- [x] A bounce for a mail sent before the address was last changed sets no marker and removes no verification. *"ignores a bounce for a mail sent before the address changed".*
- [x] A bounce for a staff alert mail, which has no user, marks nothing. *"marks nothing on a bounce for a staff alert".*
- [x] Changing the address clears the marker and sends the new verification mail. *"clears the marker when the address changes, and mails the new one".*
- [x] With the marker set, resend-verification answers with a distinct code and the capture transport holds no mail. *409 `EMAIL_UNDELIVERABLE`; "refuses to resend verification with its own code and sends nothing".*
- [x] With the marker set, setting the same address again answers with the same code and sends nothing. *"refuses the same address again with the same code, the summary, and no mail".*
- [x] With the marker set, the reset request gives its one fixed answer and sends nothing. The answer and its timing path match a request for an unknown name. *"answers the reset request as for an unknown name, before and without any mail". A marked address is never verified, so it takes the unverified branch.*
- [x] Every response that returns the account summary carries the marker reason, or nothing when unmarked. *`emailMarker` in `accountSummary`; tested on register, login, me and set-email. Rename uses the same function and is not tested.*
- [x] Removing the "sent before the address changed" guard turns its test red. *Mutation run: only that test fails. 11 guards were mutated; 10 failed a test. The one that survived, a redundant reset check, was removed.*

## Landed

Spec-session rulings: `email_set_at` is backfilled to the migration time; the field is `emailMarker`; the code is `EMAIL_UNDELIVERABLE` (409); verify-email spends an old link and answers that code while marked; no token revoke; a mail sent in the same millisecond counts as sent to the new address. One choice had no ruling: a second event keeps the first reason and time.

**Not verified**
- Live SES events: none had been shared, so the tests use ticket 02's documented payloads.

**For you**
- After deploy, send one mail to the SES simulator's bounce address from a test account. `GET /api/auth/me` should then show `emailMarker: "bounce"`.
