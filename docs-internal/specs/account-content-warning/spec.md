# Account-Synced Content Warning Acceptance

Status: ready-for-agent

## Problem Statement

The Adult Content Ahead popup remembers acceptance only in browser storage. Logged-in users who already accepted must answer again on another device, in another browser, or after clearing site data. Profiles and the game share the local answer on one origin, but it does not follow the account.

## Solution

Remember a logged-in user's acceptance on the server and restore it before deciding whether to show the popup. Accepting on either the site or in the game covers both surfaces and later sessions on other devices. Guests retain the existing browser-local behavior.

A current acceptance skips the popup. An older acceptance requires the current warning to be accepted again.

## User Stories

1. As a logged-in visitor, I want accepting the profile content warning to save to my account, so that my next visit does not ask again.
2. As a player, I want acceptance in the game to cover site profiles, so that both surfaces recognize the same answer.
3. As a site visitor, I want acceptance on a profile to cover the game, so that moving between them does not repeat the popup.
4. As a returning user, I want my acceptance restored on another browser or device, so that it follows my account.
5. As a returning user, I want clearing browser data to leave my server acceptance intact, so that signing back in restores it.
6. As a guest, I want my acceptance remembered in this browser, so that I can browse without creating an account.
7. As a guest, I want acceptance to remain usable when browser storage fails, so that the current visit can continue.
8. As a user with an existing session, I want the account check to finish before the popup appears, so that an already accepted warning does not flash onscreen.
9. As a user who has not accepted, I want community content withheld until I answer, so that loading a profile does not expose it early.
10. As a user whose acceptance is outdated, I want to see the current warning, so that my answer applies to the text now required.
11. As a user whose save fails, I want a clear retry path, so that I can finish recording my answer without repeating unrelated actions.
12. As a user sharing a browser, I want account acceptance kept separate, so that another account does not inherit mine.
13. As a user signing in or out in another tab, I want the gate to follow the active session, so that late responses do not apply to the wrong account.
14. As a user who declines, I want the existing leave or close behavior preserved, so that declining never records acceptance.
15. As a user returning after a temporary connection failure, I want a successfully saved answer recognized, so that an uncertain response does not create repeated acceptance records.
16. As a player without community features enabled, I want no new prompt or server check, so that this feature does not affect that build.

## Implementation Decisions

- Extend the existing age-attestation behavior through a lightweight shared module used by the site gate and the game provider. Preserve the site's bundle boundary; do not import game contexts into the site.
- Add authenticated acceptance read/write support in FormamorphServer, following the existing policy-acceptance conventions. Resolve exact routes and storage integration against the server code before implementation; client code alone cannot complete this feature.
- Store acceptance against the authenticated account, including the accepted warning version and acceptance time. The server derives account identity from authentication and records the time; callers cannot write another user's answer.
- Make repeat acceptance of the same version idempotent. Reads distinguish a current acceptance, an absent or stale acceptance, and a failed request.
- Keep the current warning wording and version unchanged for this feature. Coordinate the required version between client and server, and never mark unseen newer wording accepted through a stale client.
- Read account acceptance on session restoration and identity changes before choosing whether to show the warning. Allow the minimal authentication and acceptance traffic needed for this check; keep user-written community content and its background fetches behind attestation.
- Do not place the acceptance lookup behind a prerequisite that itself waits for age attestation. Preserve the existing sequencing with the Privacy Policy prompt.
- Keep guest acceptance browser-local. A device-wide guest or legacy record is not proof that a particular account accepted; do not silently upload it to every account using that browser.
- After an explicit acceptance made during the sign-in flow, carry that answer into the resulting authenticated session and save it for that account. Scope any pending answer to that flow; do not derive it from an arbitrary old guest record.
- Keep any authenticated cache scoped to the account and warning version. Discard stale asynchronous results after logout or account changes; never reuse one account's result for another.
- For a logged-in Accept action, wait for confirmed persistence before treating account synchronization as complete. A failed write offers retry and preserves the pending action. A repeated request after a lost response remains safe.
- A failed account lookup must not masquerade as an absent answer or success. Show a retryable loading error before asking the user to accept again; no automatic guest fallback for an unresolved authenticated check.
- Preserve current guest storage-failure behavior, decline actions, cache purging, non-dismissable popup behavior, and builds with community disabled.
- This changes account/API persistence only. World and save export shapes, app version, and shipped world/save migrations are outside this feature.

## Testing Decisions

Test observable behavior through the existing site profile page and game age-gate integration boundaries, using real client services with controlled network responses. Add server API tests against actual persistence to prove that a fresh session reads the saved answer. Mocked client responses alone do not prove cross-device persistence.

Prior art: profile-page age-gate tests, main-menu age-gate tests, registration acceptance-retry tests, and the site's bundle-boundary checks. Existing server policy tests are identified in the Privacy Policy implementation ticket; verify those tests against the server checkout before extending them.

Required scenarios:

- Accept while logged in, then open a fresh client storage context for the same account: no popup, and protected content loads.
- Repeat in both directions between the site and the game.
- Restore a current server acceptance with empty local storage; delay the response and assert no warning flash or premature community-content request.
- Missing and outdated server acceptances show the warning; accepting the displayed version saves it.
- Guests retain same-origin site/game acceptance, including failed local-storage writes.
- A legacy guest record does not populate unrelated accounts. An explicit answer in the active sign-in flow is saved after authentication.
- Account switch and logout during delayed reads or writes cannot unlock the next account. Include cross-tab session changes.
- Failed reads offer retry; failed writes retain the pending flow and retry successfully. Simulate a write that committed but whose response was lost.
- Duplicate acceptance requests do not create duplicate records; unauthenticated requests and attempts to target another account cannot write acceptance.
- A server-required newer version is not accepted silently by an older client.
- Decline, Privacy Policy sequencing, background content fetch guards, and community-disabled builds retain their behavior.
- The site remains within its existing bundle boundary.

Use assertions about visible prompts, content requests, navigation, and durable API results rather than private state or helper call counts. During implementation, follow the project's test-quality bar, time every test run, verify the rendered UI with static evidence, and run all four code gates.

## Out of Scope

- Changing the warning copy, legal-age wording, or required acceptance version.
- Age verification, identity documents, or collecting a date of birth.
- New admin policy editing, reset controls, or decline-history features.
- Making public community content require authentication.
- Redesigning the Privacy Policy or upload gate.
- Automatically attributing historical device-local acceptance to an account.
- World/save export changes, migrations, version bumps, or deployment in this spec-writing task.

## Further Notes

This is a coordinated client/server feature. Inspect the FormamorphServer checkout and confirm its policy persistence contract before implementation; its current code was not inspected while drafting this spec. Existing project tickets identify that repository as the owner of policy acceptance storage.

Ship the server contract before a client that depends on it. An unavailable endpoint must produce the retryable failure behavior rather than silently claiming account persistence.
