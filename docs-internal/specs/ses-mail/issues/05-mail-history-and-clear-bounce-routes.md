# 05: Mail History And Clear Bounce Routes

Status: ready-for-agent
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

- [ ] The history route answers staff with the rows and the marker, and refuses a signed-in non-staff user and a guest.
- [ ] No history response holds an email address or an SES message id.
- [ ] Clear calls the SES client with the address read from the user row, then removes the marker.
- [ ] After a clear, the address is still unverified and resend-verification sends a mail.
- [ ] When the SES call fails, the marker stays, the response says the clear failed, and no audit entry is written.
- [ ] SES answering that the address was not on the list counts as success.
- [ ] Each clear writes one audit entry with the staff member and the account. The audit action name is listed with the others.
- [ ] Clear on an unmarked account changes nothing and says so.
- [ ] The IAM permission the clear needs is added to the documented setup steps.
- [ ] Skipping the SES call on clear turns a test red.

For you: add the suppression-removal permission to the IAM user.
