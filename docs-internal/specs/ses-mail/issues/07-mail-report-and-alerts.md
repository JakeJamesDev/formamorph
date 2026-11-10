# 07: Mail Report And Alerts

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/ses-mail/spec.md` in formamorph (Health; Q10, Q19)

Model rationale: alert state that must fire once, re-arm correctly and never flood, plus rate math with a volume floor.

## What to build

Once an hour the server asks SES for the account's enforcement status and quota, and computes the 7-day hard-bounce and complaint rates from the mail log. It alerts admins through the existing staff alert path when the status is not healthy, when the bounce rate reaches 2.5%, or when the complaint rate reaches 0.05%. A rate alert needs at least 200 mails in the window. Each condition alerts once and re-arms when it clears. An admin route returns the report: per-day counts by status, the two rates with Amazon's limits, the SES status, and today's quota use.

This ticket adds the account-status method to the SES client object from ticket 01.

## Acceptance criteria

- [ ] The report returns per-day counts of sent, delivered, delayed, bounced and complained mail, newest first, with zero-filled days.
- [ ] The report returns both 7-day rates, the volume they were computed from, Amazon's review and pause limits, the last SES status, and quota used against quota granted.
- [ ] The report refuses a moderator and a guest.
- [ ] A non-healthy status alerts admins once. The next hourly run with the same status sends nothing.
- [ ] After the status returns to healthy and fails again, one new alert is sent.
- [ ] A bounce rate at or above 2.5% with 200 or more mails alerts once. The same rate with 199 mails does not.
- [ ] A complaint rate at or above 0.05% with 200 or more mails alerts once.
- [ ] Each alert creates the urgent in-app message even when the alert mail fails to send.
- [ ] A failed SES status call is logged, alerts nothing, and leaves the last known status in the report with its time.
- [ ] The job runs at start-up and hourly, never throws, and is off when mail is off.
- [ ] The IAM permission the status call needs is added to the documented setup steps.
- [ ] Changing the volume floor to zero turns the 199-mail test red.

For you: add the account-read permission to the IAM user.
