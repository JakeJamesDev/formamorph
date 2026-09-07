# 01: Remember Acceptance on Site Profiles

Status: ready-for-agent
Blocked by: None (can start immediately)
Parent: [Account-Synced Content Warning Acceptance](../spec.md)

## What to Build

A logged-in visitor accepts Adult Content Ahead on a profile, then returns with the same account in a fresh browser session and sees the profile without answering again. Deliver the complete server persistence and site flow together, including recovery when requests fail.

## Acceptance Criteria

- [ ] Inspect FormamorphServer's current policy persistence and authentication contract before choosing exact endpoints or schema integration. Implement and verify the server changes as part of this slice.
- [ ] Save the authenticated account's accepted warning version with a server-recorded time. Derive identity from authentication; reject unauthorized writes and make repeat acceptance idempotent.
- [ ] A fresh client with no local acceptance restores a current server answer and opens the profile without a warning flash.
- [ ] Missing or stale acceptance requires the warning. A client cannot silently accept a newer version of wording it has not displayed.
- [ ] Keep warning wording and its required version unchanged. Coordinate the read/write version contract without adding admin editing or reset features.
- [ ] Hold profile content and its requests until attestation resolves. Permit the minimal authentication and acceptance requests needed to resolve it without a Privacy Policy or age-gate dependency cycle.
- [ ] Failed reads show a retryable error rather than masquerading as missing acceptance. Failed writes retain the pending flow and offer retry; do not report synchronization complete before server confirmation.
- [ ] Retrying a committed write whose response was lost succeeds without duplicate records.
- [ ] Scope authenticated state to account and version. Account switches, logout, and cross-tab session changes invalidate pending results so one account cannot unlock another.
- [ ] Guests retain local acceptance shared with the game on the same origin, including continued use for the current visit when storage writes fail.
- [ ] Historical guest records are not silently uploaded to accounts. Decline preserves the site's leave behavior and never records acceptance.
- [ ] Keep shared synchronization lightweight and preserve the site's bundle boundary.
- [ ] Deploy the server contract before a client that requires it; unavailable endpoints follow the defined retry behavior.

## Verification

Use the existing profile-page integration boundary with real client services and controlled server responses. Assert visible prompts, content requests, navigation, and recovery. Add server API tests using actual persistence: accept in one authenticated session and read from a new session, verify isolation with a second account, stale versions, duplicate requests, and unauthorized writes.

Exercise delayed requests and account changes rather than mocking away races. Follow the project's test-quality bar, time test runs, verify the UI with static evidence, and complete the four code gates, changelog entry, and graph update in each changed repository as applicable.

## Scope Notes

This ticket provides the shared contract for the next slices; game integration and carrying an explicit guest answer through sign-in remain separate. Do not change world/save exports or app version.
