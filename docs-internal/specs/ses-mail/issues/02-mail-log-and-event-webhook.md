# 02: Mail Log And Event Webhook

Status: ready-for-human
Base: a8e7d04
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

- [x] An additive schema step creates the mail-log table. The boot-schema and smoke lists include it. `src/schema/steps/mailLog.js`; `mailLog` in the bootSchema list, `mail_log` in the smoke list.
- [x] `sendMail` takes the user id and the kind (`verify`, `reset`, `alert`). Every caller passes them. A staff alert is logged with no user. `tests/mailEvents.test.js` "logs the mail the register route sends against the new account", "logs a reset mail as reset", "logs a staff alert with no account". An unknown kind is refused.
- [x] A sent mail carries a mail-id tag and a kind tag that use only letters, digits, underscore and dash. `mail_id` (row UUID) and `mail_kind`. "tags each mail with its row id and kind…" and "hands the tags to SES…" (`EmailTags` on the SES input).
- [x] A refused send writes no row. "writes no row when the send is refused".
- [x] The webhook refuses a request with a missing or wrong secret, compared in constant time, and answers that it is unavailable when the secret is not configured. `POST /api/mail/events`, header `X-SES-Events-Secret`, sha256 digests compared with `timingSafeEqual`. 401 and 503 tests.
- [x] Captured payloads for delivery, delivery delay, bounce and complaint each move the row to the matching status. Payloads built from the AWS docs examples, not a live capture yet (see Not verified). Permanent → `hard`; Transient and Undetermined → `soft`; OnAccountSuppressionList → `hard`.
- [x] A final status never moves back: a delay after a delivery, or a delivery after a bounce, changes nothing. Three "keeps a …" tests. Per the spec session's rulings, a complaint or a late bounce may still follow a delivery (two tests).
- [x] The same event posted twice leaves one unchanged row. "leaves one unchanged row when the same event arrives twice".
- [x] An event with an unknown tag, and an event of any other type, get a success answer and change nothing. Unknown id, missing tag, and an `Open` event: 200, row unchanged.
- [x] After every webhook test, no table and no log line holds the recipient address from the payload. "is stored nowhere and logged nowhere…" scans every table plus console, stdout and stderr (request log included) after every event type, a bad secret and a broken body.
- [x] Rows older than 90 days go in the retention sweep. Deleting an account removes its rows. 91/89-day sweep test; `eraseUser` test (cascade; the staff alert row stays).
- [x] What the server now stores matches the delivery-records wording that ticket 01 put in the privacy policy (Q20). This ticket does not edit the policy. A row holds account, kind, SES message id, status and two times; no address; 90 days. Read against `privacy-policy.md` lines 17 and 141.
- [x] The webhook secret key and the EventBridge setup steps are documented with the server's other keys. `SES_EVENTS_SECRET` in the `docs-internal/server.md` key table and the README `.env` sample, plus a new "Mail events" section.
- [ ] The spec's "Not verified yet" list is replaced by what the live event showed.
- [x] Removing the secret check turns a webhook test red. Removed it: both 401 tests went red, then restored. The status guard and the late-bounce rule were mutated the same way.

For you: create the EventBridge connection, API destination and rule that forward SES events to the webhook, then send one mail to the SES mailbox simulator's bounce address so the session can capture a live event.

## Landed

**Not verified**

- The spec's "Not verified yet" list is replaced by what the live event showed: no live SES event had arrived at landing, so both facts stay open (a bounce for a suppressed address; naming the connection's secret header).

**For you**

- For you: create the EventBridge connection, API destination and rule that forward SES events to the webhook, then send one mail to the SES mailbox simulator's bounce address so the session can capture a live event.
- Set `SES_EVENTS_SECRET` in `/srv/formamorph/app/.env` and `.env.production`, and name the connection's API key header `X-SES-Events-Secret`. Steps: "Mail events" in `docs-internal/server.md`. If the console cannot name the header, the webhook needs a follow-up.
- After the bounce mail, check its `mail_log` row reads `bounced` / `hard`, and share the event JSON so the spec's "Not verified yet" list and the test fixtures can use it.
