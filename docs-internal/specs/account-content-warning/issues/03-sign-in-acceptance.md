# 03: Carry Acceptance Through Sign-In

Status: ready-for-human
Blocked by: 02
Parent: [Account-Synced Content Warning Acceptance](../spec.md)

## What to Build

When a visitor explicitly accepts the warning as part of the active sign-in flow, record that answer for the account that successfully signs in. The visitor should not have to accept twice during that flow, and later visits should recognize the persisted account answer.

## Acceptance Criteria

- [x] Carry an explicit answer made during the active sign-in flow through successful authentication and save it using the shared acceptance contract.
- [x] Apply this behavior to the applicable site and game authentication entry points, keeping the same warning version that the user actually saw.
- [x] If the resulting account already has current acceptance, continue without another warning or redundant acceptance record.
- [x] Scope a pending answer to the active authentication flow. Canceling or abandoning that flow cannot apply its answer to a later unrelated account.
- [x] A failed sign-in does not claim an account acceptance was saved. A retry within the same active flow can complete the intended operation.
- [x] If saving after successful authentication fails, expose retry without repeating sign-in or requiring the user to reread and reaccept the warning.
- [x] Logout, account replacement, and cross-tab identity changes during persistence cannot apply the answer or completion callback to the wrong account.
- [x] Existing device-local acceptance remains valid for guest browsing but is never treated as historical proof for whichever account signs in.
- [x] When there is no explicit answer from the active flow, resolve the account's own server acceptance and prompt only if it is absent or stale.
- [x] A later fresh session for the successfully accepted account skips the warning on both site and game surfaces.
- [x] Preserve the ordering and recovery behavior of the Privacy Policy and age-attestation flows.

## Verification

Test through the applicable visible authentication and gate flows with real client services over controlled server responses, following the existing registration acceptance-retry tests and age-gate integration tests. Assert successful persistence, one-flow continuation, failed sign-in, failed save with retry, cancellation, historical guest records, account changes, and version changes during the flow.

Use the server persistence tests established in ticket 01 to substantiate durable acceptance rather than treating mocked responses as persistence evidence. Follow the test-quality bar, time test runs, verify the UI with static evidence, and complete the four code gates, changelog entry, and graph update.

## Scope Notes

This completes the parent spec's guest-to-account transition. No new admin controls, guest-history backfill, warning copy change, export-shape change, or app version bump.

## Answer

The site and game now carry only the warning version explicitly accepted during the active authentication flow. The pending answer is bound to the authenticated token and user before persistence, survives credential or persistence retries, and is discarded on cancellation, abandonment, logout, or identity replacement. Registration waits for Privacy acceptance before resolving the warning; its recovery flow preserves that ordering.

Verification uses real client services over controlled HTTP responses. The focused suite covers 84 cases, including fresh sessions, stale versions, redundant-write avoidance, storage denial, page abandonment, and cross-tab account replacement. Mutation checks proved the flow-id, account-binding, retry, cancellation, storage-fallback, and Privacy-order guards independently. The production site and game dialogs were also inspected at 1280 × 720 using static frames.

All gates pass: typecheck, lint (zero errors), 8,384 tests with 3 skipped in 49.35 seconds, app build, site build, and the code-graph update. The durable server contract remains covered by ticket 01's persistence tests.
