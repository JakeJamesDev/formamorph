# 04: Privacy Policy Wording

Status: ready-for-human
Base: f6cc46e
Blocked by: 01, 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-telemetry/spec.md` in formamorph (Privacy policy, Further Notes)

Model rationale: one batched text edit whose content the earlier tickets fix.

## What to build

The privacy policy's Formamorph AI section names every field this effort records, in one edit, so players see at most one re-accept. The field list comes from what tickets 01 to 03 landed. Ticket 03 may have dropped the provider.

The publish and the re-accept choice are not part of this ticket. They happen at deploy, and re-accept is the user's call.

## Acceptance criteria

- [x] The list of recorded call fields adds the app version, and the provider that served the call if ticket 03 kept it. App version, token limit and held amount added; no provider (ticket 03 dropped it).
- [x] The policy says each refused call is counted per day with its reason, the account, the Patreon user id or staff grant, the tier, and the first and last time that day. New "We count each refused call" paragraph.
- [x] The retention and erasure lines cover the refusal totals, with the Patreon user id kept until the 30 days end. Both lines edited.
- [x] Every new statement matches what the code records, checked against tickets 01 to 03's landings. Compared with the CONTEXT.md Refusal total entry and the usage columns of 366855a.
- [x] The policy text still says that no text from play is kept. Both "no text from your play" lines remain.

For you: decide whether this publish requires re-accept, and whether the third-party section must say calls can reach several providers (the policy file's third-party section).

## Landed

**Not verified**

- None.

**For you**

- Decide whether this publish requires re-accept, and whether the third-party section must say calls can reach several providers (the policy file's third-party section).
- "Last updated" is now 7 November 2026 (spec session approved); check the date still fits the publish day.
