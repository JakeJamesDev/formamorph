# 03: Bounce Marker

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/ses-mail/spec.md` in formamorph (Bounce marker, API changes; Q4, Q8, Q9, Q14, Q18)

Model rationale: it changes who can reset a password, and a late event for an old address must never mark a new one.

## What to build

A hard bounce or a spam complaint marks the account's current address and removes its verification. While the marker is set, the server sends no verification and no reset mail to that address. Changing the address clears the marker. The account summary carries the marker's reason, so clients can show it. The reset page's answer does not change.

This ticket owns the marker columns and the "address set at" time on the user.

## Acceptance criteria

- [ ] An additive schema step adds the marker time, the marker reason (`bounce` or `complaint`) and the time the address was set. The boot-schema list includes it.
- [ ] A bounce event for a mail sent to the current address sets the marker with reason `bounce` and removes verification.
- [ ] A complaint event does the same with reason `complaint`.
- [ ] A delay event sets no marker.
- [ ] A bounce for a mail sent before the address was last changed sets no marker and removes no verification.
- [ ] A bounce for a staff alert mail, which has no user, marks nothing.
- [ ] Changing the address clears the marker and sends the new verification mail.
- [ ] With the marker set, resend-verification answers with a distinct code and the capture transport holds no mail.
- [ ] With the marker set, setting the same address again answers with the same code and sends nothing.
- [ ] With the marker set, the reset request gives its one fixed answer and sends nothing. The answer and its timing path match a request for an unknown name.
- [ ] Every response that returns the account summary carries the marker reason, or nothing when unmarked.
- [ ] Removing the "sent before the address changed" guard turns its test red.
