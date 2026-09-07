# 02: Share Account Acceptance with the Game

Status: ready-for-agent
Blocked by: 01
Parent: [Account-Synced Content Warning Acceptance](../spec.md)

## What to Build

A player who accepted on the site enters the game without answering again, and accepting in the game covers later site visits and other devices. Use the account contract delivered by ticket 01.

## Acceptance Criteria

- [ ] Restore account acceptance before showing the game warning on boot with an existing session.
- [ ] Accepting in the game persists through the shared server contract; a fresh site session recognizes that answer.
- [ ] Acceptance on a site profile is recognized by a fresh game session with the same account and no local acceptance.
- [ ] Missing and outdated answers show the existing gate. Failed reads and writes expose the retry behavior established in ticket 01 without losing the action waiting behind the gate.
- [ ] Community browsing and background content requests remain withheld until attestation resolves. Minimal acceptance lookup traffic is allowed before attestation.
- [ ] Preserve Privacy Policy prompt ordering without a dependency cycle or competing blocking dialogs.
- [ ] Local and cross-tab identity changes update the gate; delayed responses for an old account cannot unlock the active account.
- [ ] Preserve guest acceptance, decline callbacks, cache purging, and the sign-out behavior for declining a gate raised by an existing session.
- [ ] Community-disabled builds make no acceptance request and show no gate.
- [ ] Preserve the site's bundle boundary and share the synchronization behavior rather than introducing divergent site and game rules.

## Verification

Extend the existing main-menu age-gate integration tests with real client services and controlled network responses. Cover both site-to-game and game-to-site restoration using separate local-storage contexts and the same account response. Reuse the real-persistence server evidence from ticket 01; add server coverage only if the contract changes.

Assert delayed-read behavior, guarded background requests, callback completion after successful retry, identity changes, Privacy Policy sequencing, decline, and community-disabled behavior. Follow the test-quality bar, time test runs, verify the rendered gate using static evidence, and complete the four code gates, changelog entry, and graph update.

## Scope Notes

Carrying an explicit answer from a signed-out sign-in flow into the new account is ticket 03. Do not attribute historical guest records to an account, change warning wording, or alter world/save exports.
