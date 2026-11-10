# 07: Mail Report And Alerts

Status: ready-for-human
Base: b17f9ea
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

- [x] The report returns per-day counts of sent, delivered, delayed, bounced and complained mail, newest first, with zero-filled days. Test "counts each UTC send day by status…"; hard and soft bounces are separate counts, `sent` is every mail sent that day.
- [x] The report returns both 7-day rates, the volume they were computed from, Amazon's review and pause limits, the last SES status, and quota used against quota granted. Test "returns both 7-day rates…"; the quota is SES's rolling last 24 hours (`last24Hours`).
- [x] The report refuses a moderator and a guest. Test "refuses a moderator and a guest" (403, 401).
- [x] A non-healthy status alerts admins once. The next hourly run with the same status sends nothing. Test "alerts admins once for a non-healthy status…"; also "alerts again when a review becomes a pause" and "treats sending turned off…".
- [x] After the status returns to healthy and fails again, one new alert is sent. Test "alerts again after the status was healthy…".
- [x] A bounce rate at or above 2.5% with 200 or more mails alerts once. The same rate with 199 mails does not. Tests "alerts once when hard bounces reach 2.5% of 200 mails" and "stays quiet at the same rate with 199 mails".
- [x] A complaint rate at or above 0.05% with 200 or more mails alerts once. Test "alerts once when complaints reach 0.05% of 2,000 mails".
- [x] Each alert creates the urgent in-app message even when the alert mail fails to send. Test "creates the urgent message even when the alert mail fails to send".
- [x] A failed SES status call is logged, alerts nothing, and leaves the last known status in the report with its time. Test "logs a failed read…"; the rate checks still run ("still checks the rates when the SES read fails").
- [x] The job runs at start-up and hourly, never throws, and is off when mail is off. Test "does nothing when mail is off"; start-up and hourly wiring in `src/server.js` behind `mailEnabled`, read, not run.
- [x] The IAM permission the status call needs is added to the documented setup steps. `ses:GetAccount` in the Mail health table of `docs-internal/server.md`.
- [x] Changing the volume floor to zero turns the 199-mail test red. Mutation run: floor 0 fails "stays quiet at the same rate with 199 mails". Eight more guard mutations each fail a test.

## Landed

**Not verified**

- Nothing unticked. The start-up and hourly calls in `src/server.js` were checked by reading, not by booting the server.

**For you**

- For you: add the account-read permission to the IAM user.
