# 12: Live Patreon Check

Status: ready-for-human
Blocked by: 05, 06, 08, 10, 11
Recommended model: N/A — the user registers the Patreon client and runs the check with real member accounts
Reasoning effort: N/A
Repo: FormamorphServer (production configuration)
Spec: ../spec.md (Testing Decisions › Live Patreon check; Further Notes › Unverified facts)

## What to build

No automated test calls Patreon. Before release, the user sets up the real Patreon client and runs one manual check with real member accounts. The check also settles the facts that Patreon's documentation leaves open.

## Setup

- [ ] Register an API client on Patreon's Clients & API Keys page with the server's callback as the redirect URI.
- [ ] Create the campaign webhook for the six member triggers and note its secret.
- [ ] Set the server's environment values: client ID and secret, creator access and refresh tokens, campaign ID, the two tier IDs, and the webhook secret.

## Acceptance criteria

- [ ] A $5 member and a $10 member link, and each gets the right tier and flair.
- [ ] An upgrade, a downgrade, and a cancel each arrive by webhook and change the flair.
- [ ] A free member links and gets "No active membership".
- [ ] A free trial and a gifted membership: the real field values are recorded under Comments. If either does not appear in `currently_entitled_tiers`, ruling Q1 goes back to the user.
- [ ] A declined payment: Comments record whether the entitled tiers stay during Patreon's retry period.
- [ ] The webhook signature verifies on a real delivery.
- [ ] The creator token refresh works, and the new pair is stored. Comments record the real `expires_in`.
- [ ] The second link of one Patreon account to another Formamorph account is refused.
- [ ] The Supporters wall shows the test accounts in the right order.
