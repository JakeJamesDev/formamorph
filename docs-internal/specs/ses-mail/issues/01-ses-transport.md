# 01: SES Transport

Status: ready-for-human
Base: 75c2b22
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/ses-mail/spec.md` in formamorph (Order, Transport, Privacy policy)

Model rationale: a small swap behind an existing seam, but it adds the first AWS dependency and the SES client object that tickets 05 and 07 extend.

## What to build

All server mail goes out through Amazon SES. The transport sits behind the existing `sendMail` seam, so no caller changes. It talks to AWS through one SES client object that tests replace with a fake. The old provider's transport, key and tests are removed. The privacy policy names Amazon SES as the mail processor. This ticket deploys alone and lifts the daily cap.

This ticket owns the SES client object. It builds the send method only.

## Acceptance criteria

- [x] With the AWS keys set, a verification mail, a reset mail and a staff alert mail each reach the SES client with the configured sender, the reply-to when set, and the configuration set name. `tests/mail.test.js` "every kind of server mail goes through SES" (register, reset request, `alertAdmins`); reply-to in "sends the reply address when one is set".
- [x] With no AWS key, every send is refused and callers report the mail as not sent, as today. Start-up logs that mail is off and does not stop. "refuses every send when no AWS key is set", "keeps mail off when the configuration set is the only key missing", and accountEmail "says the mail did not go when the server has no mail keys". `src/server.js` logs the missing keys with `console.error` and keeps booting.
- [x] An SES refusal becomes a failed send whose error message holds no recipient address. "turns an SES refusal into a failed send that names no address"; red when the scrub is removed.
- [x] No test calls AWS. The account-mail, password-reset and hosted-alert suites pass on the capture transport without change. `vitest.config.mjs` blanks the AWS keys, and "starts the test process with mail off" pins it. Full suite 3,515 passed. Only the fakes' error strings and one test name lost the old provider's name.
- [x] The old provider's transport, endpoint, environment key and unit tests are gone from the code and the docs. Grep of `src`, `tests`, `README.md`, `docs-internal/server.md` finds none; closed `website-accounts` specs and past deploy-log lines keep it as history.
- [x] The new environment keys (access key id, secret, region, configuration set) are documented where the server's other keys are, with the note to keep the production file in sync. `docs-internal/server.md` key table, under its `.env.production` line; README `.env` sample.
- [x] The privacy policy's processor section names Amazon SES and what it receives. Also carries the delivery-records wording and 90-day retention (ruling Q20); bootSchema and privacyGate tests quote it.
- [x] The AWS SDK package was added with its identity and latest version checked against the registry. `npm view @aws-sdk/client-sesv2`: 3.1165.0, repo aws/aws-sdk-js-v3, maintainers amzn-oss and aws-sdk-bot.
- [x] Removing the configuration set from the send turns a transport test red. Removed it: 5 of 14 mail tests went red, then restored.

For you: create the IAM user and access key (send from the mail domain only), create the SES configuration set, put the keys in the server environment, deploy, and send yourself a verification mail.

## Landed

**Not verified**

- None of the criteria. A real send through SES is untested until deploy.

**For you**

- For you: create the IAM user and access key (send from the mail domain only), create the SES configuration set, put the keys in the server environment, deploy, and send yourself a verification mail.
- Put `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_CONFIGURATION_SET` (and `AWS_REGION` if not `us-east-2`) in `/srv/formamorph/app/.env` and `.env.production`; remove `RESEND_API_KEY`. The boot log names any key still missing.
- Publish the privacy policy at deploy (`npm run publish-policy`). It names Amazon SES and the 90-day delivery records.
