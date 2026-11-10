# 05: Mail History And Clear Bounce Routes

Status: ready-for-human
Base: 18f570a
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/ses-mail/spec.md` in formamorph (API changes, Clearing a bounce; Q13, Q16)

Model rationale: two staff routes on existing patterns, with one outbound AWS call whose failure must leave state unchanged.

## What to build

Staff read one account's mail history: each mail's kind, send time, status and last status time, newest first, plus the account's marker and when it was set. Staff clear a marker: the server asks SES to take the address off the account suppression list, then removes the marker and writes an audit entry. Verification is not restored.

This ticket adds the remove-from-suppression method to the SES client object from ticket 01.

## Acceptance criteria

- [x] The history route answers staff with the rows and the marker, and refuses a signed-in non-staff user and a guest. (`mailHistory.test.js` "shows staff the rows newest first…", "refuses a signed-in non-staff user and a guest")
- [x] No history response holds an email address or an SES message id. ("holds no address and no SES message id")
- [x] Clear calls the SES client with the address read from the user row, then removes the marker. ("takes the address read from the account off the SES list…")
- [x] After a clear, the address is still unverified and resend-verification sends a mail. ("leaves the address unverified, and resend-verification sends again")
- [x] When the SES call fails, the marker stays, the response says the clear failed, and no audit entry is written. ("keeps the marker, says the clear failed…": 502 `MAIL_PROVIDER_FAILED`)
- [x] SES answering that the address was not on the list counts as success. ("counts an address SES did not hold as cleared"; mutant went red)
- [x] Each clear writes one audit entry with the staff member and the account. The audit action name is listed with the others. ("writes one audit entry…", "lists the action with the others": `email_marker_cleared`)
- [x] Clear on an unmarked account changes nothing and says so. ("changes nothing on an unmarked account": `{ cleared: false }`)
- [x] The IAM permission the clear needs is added to the documented setup steps. (`ses:DeleteSuppressedDestination` in `docs-internal/server.md`, Mail health table)
- [x] Skipping the SES call on clear turns a test red. (commented out the call: 2 tests red)

## Landed

Routes: `GET /api/users/:id/mail-history` → `{ emailMarker, emailMarkedAt, mails: [{ kind, status, sentAt, statusAt, bounceType? }] }`, and `DELETE /api/users/:id/email-marker` → `{ cleared }`, 502 `MAIL_PROVIDER_FAILED` on an SES failure.

Target rule, as ruled: any staff member reads any account's history, as with linked accounts (no audit entry per read, unlike linked accounts). The clear uses `canModerate`: a mod gets 403 on an admin's or another staff account's marker. A self-clear names the account in the audit entry, unlike the null self-target elsewhere, so every entry has the account. With mail off (no SES client), the clear removes the marker without an SES call.

**Not verified**

- None.

**For you**

- Add the suppression-removal permission to the IAM user. (`ses:DeleteSuppressedDestination`, see `docs-internal/server.md` in FormamorphServer, Mail health.)
