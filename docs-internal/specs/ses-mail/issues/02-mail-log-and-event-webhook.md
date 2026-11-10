# 02: Mail Log And Event Webhook

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/ses-mail/spec.md` in formamorph (Mail log, Webhook, Privacy policy, Not verified yet)

Model rationale: a public route that changes account-related state, a status machine that must survive retries and out-of-order events, and a no-address privacy promise.

## What to build

The server writes one mail-log row each time SES accepts a mail: user id (empty for staff alerts), kind, SES message id, status and times. The row's own id rides on the mail as a tag. SES events arrive at a new webhook through EventBridge with a shared secret, and each event moves its row's status. Rows expire after 90 days and go with a deleted account.

This ticket records status only. Marking the address is ticket 03.

Before the handler is final, check the two open facts in the spec against a live event and write the answers into the spec: whether SES publishes a bounce for a suppressed address, and whether the EventBridge connection lets us name the secret header.

## Acceptance criteria

- [ ] An additive schema step creates the mail-log table. The boot-schema and smoke lists include it.
- [ ] `sendMail` takes the user id and the kind (`verify`, `reset`, `alert`). Every caller passes them. A staff alert is logged with no user.
- [ ] A sent mail carries a mail-id tag and a kind tag that use only letters, digits, underscore and dash.
- [ ] A refused send writes no row.
- [ ] The webhook refuses a request with a missing or wrong secret, compared in constant time, and answers that it is unavailable when the secret is not configured.
- [ ] Captured payloads for delivery, delivery delay, bounce and complaint each move the row to the matching status.
- [ ] A final status never moves back: a delay after a delivery, or a delivery after a bounce, changes nothing.
- [ ] The same event posted twice leaves one unchanged row.
- [ ] An event with an unknown tag, and an event of any other type, get a success answer and change nothing.
- [ ] After every webhook test, no table and no log line holds the recipient address from the payload.
- [ ] Rows older than 90 days go in the retention sweep. Deleting an account removes its rows.
- [ ] What the server now stores matches the delivery-records wording that ticket 01 put in the privacy policy (Q20). This ticket does not edit the policy.
- [ ] The webhook secret key and the EventBridge setup steps are documented with the server's other keys.
- [ ] The spec's "Not verified yet" list is replaced by what the live event showed.
- [ ] Removing the secret check turns a webhook test red.

For you: create the EventBridge connection, API destination and rule that forward SES events to the webhook, then send one mail to the SES mailbox simulator's bounce address so the session can capture a live event.
