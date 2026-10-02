# 05: Patreon Webhooks

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Staying current)

Model rationale: the server's first webhook receiver. Raw-body handling and signature checks are easy to get subtly wrong, and a fault lets anyone grant flair.

## What to build

When a member pledges, upgrades, downgrades, or cancels on Patreon, the linked account's tier changes at once. A forged call changes nothing.

## Acceptance criteria

- [ ] A webhook route accepts `members:create`, `members:update`, `members:delete`, `members:pledge:create`, `members:pledge:update`, and `members:pledge:delete`.
- [ ] The route reads the raw body and verifies `X-Patreon-Signature`, the hex HMAC-MD5 of the body with the webhook secret. The comparison is constant-time. A mismatch or a missing header is refused, and nothing changes.
- [ ] A valid webhook sets the linked account's tier and pledge start with the same tier rule as ticket 03.
- [ ] A delete trigger, or a payload with no mapped tier, leaves the link and clears the tier.
- [ ] A webhook for a Patreon user with no link is accepted and ignored.
- [ ] The same webhook applied twice gives the same state.
- [ ] The route is outside the account authentication and does not parse the body as JSON before the signature check.
- [ ] Route tests sign their own payloads. They cover a good signature, a bad one, a missing one, each trigger, the unlinked user, and the repeat. Removing the signature check makes a test fail.
- [ ] Server gates green.
