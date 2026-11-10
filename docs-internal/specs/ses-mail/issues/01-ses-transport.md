# 01: SES Transport

Status: ready-for-agent
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

- [ ] With the AWS keys set, a verification mail, a reset mail and a staff alert mail each reach the SES client with the configured sender, the reply-to when set, and the configuration set name.
- [ ] With no AWS key, every send is refused and callers report the mail as not sent, as today. Start-up logs that mail is off and does not stop.
- [ ] An SES refusal becomes a failed send whose error message holds no recipient address.
- [ ] No test calls AWS. The account-mail, password-reset and hosted-alert suites pass on the capture transport without change.
- [ ] The old provider's transport, endpoint, environment key and unit tests are gone from the code and the docs.
- [ ] The new environment keys (access key id, secret, region, configuration set) are documented where the server's other keys are, with the note to keep the production file in sync.
- [ ] The privacy policy's processor section names Amazon SES and what it receives.
- [ ] The AWS SDK package was added with its identity and latest version checked against the registry.
- [ ] Removing the configuration set from the send turns a transport test red.

For you: create the IAM user and access key (send from the mail domain only), create the SES configuration set, put the keys in the server environment, deploy, and send yourself a verification mail.
