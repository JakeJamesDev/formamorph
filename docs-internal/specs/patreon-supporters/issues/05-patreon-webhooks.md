# 05: Patreon Webhooks

Status: ready-for-human
Base: 19b7b07e
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Staying current)

Model rationale: the server's first webhook receiver. Raw-body handling and signature checks are easy to get subtly wrong, and a fault lets anyone grant flair.

## What to build

When a member pledges, upgrades, downgrades, or cancels on Patreon, the linked account's tier changes at once. A forged call changes nothing.

## Acceptance criteria

- [x] A webhook route accepts `members:create`, `members:update`, `members:delete`, `members:pledge:create`, `members:pledge:update`, and `members:pledge:delete`.
- [x] The route reads the raw body and verifies `X-Patreon-Signature`, the hex HMAC-MD5 of the body with the webhook secret. The comparison is constant-time. A mismatch or a missing header is refused, and nothing changes.
- [x] A valid webhook sets the linked account's tier and pledge start with the same tier rule as ticket 03.
- [x] A delete trigger, or a payload with no mapped tier, leaves the link and clears the tier.
- [x] A webhook for a Patreon user with no link is accepted and ignored.
- [x] The same webhook applied twice gives the same state.
- [x] The route is outside the account authentication and does not parse the body as JSON before the signature check.
- [x] Route tests sign their own payloads. They cover a good signature, a bad one, a missing one, each trigger, the unlinked user, and the repeat. Removing the signature check makes a test fail.
- [x] Server gates green.

## Hand-over

Built in FormamorphServer `e83e356` (Add Patreon Webhooks). Server suite: 66 files, 2031 tests, exit 0, 24 s.

- The route answers 503 while `PATREON_WEBHOOK_SECRET` is unset. Set it before registering the webhook on Patreon.
- Each guard was proven by reinstating its bug: the signature check, the raw-body check, the length check, the secret guard, the delete rule, and the pledge-start rule. One test signs with a vector computed outside Node.
- `PatreonLink.setTier` and `tierStateOf` are ready for ticket 06.

Named, not fixed:

- A staff client-version minimum on a broad `POST /api` path would refuse Patreon's deliveries with 426. The minimums map is empty today.
- A signed payload with no `user` relationship changes nothing, a delete included. The hourly job (06) corrects it.
- `express.raw` inflates a gzip body before the check. Ticket 12's live check should confirm a real delivery verifies and note its body size (limit 1 MB).
