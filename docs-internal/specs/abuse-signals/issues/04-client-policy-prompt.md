# 04 — Client: the Privacy Policy at signup and at login

Status: done
Type: task
Blocked by: 03
Spec: ../spec.md (Implementation Decisions › The Privacy Policy › Signup flow, Login flow; User Stories 1–6, 14)

Repo: formamorph. This is the minimum client change the pending update ships with. The decline screen ships with **Accept and Sign out**; the Delete my account button arrives with ticket 06.

## Task

- **Policy service and types**: the third policy id joins the existing two; fetch, accept, decline mirror the upload gate's calls.
- **Signup**: before submitting registration, show the Privacy Policy in the existing policy dialog. Accept → register, then accept, back-to-back; failure of the accept call after a successful register is retried once and otherwise surfaced, never silently dropped. Decline → close, no account created, no request sent.
- **Login**: after a successful login (and at app start when a session is restored), fetch policies. An unaccepted privacy policy opens the prompt. Accept → continue. Sign out → clear the session, return to the signed-out state, nothing else.
- **The 403**: any request returning the fixed code opens the same prompt. Old builds are not this ticket's concern — they show the server's message through the existing error path, which is the intended behavior.
- The prompt is not dismissable by clicking outside or pressing Escape; the only ways out are its buttons.
- Dev-router entry so the prompt is reachable in one `goto`.

## Acceptance

- A new user who declines never has an account.
- An existing unaccepted user sees the prompt once; after accepting, never again across reloads; after a server-side version bump, once more.
- Sign out at the prompt leaves the account able to log in and accept later.
- With the policy disabled server-side, nothing appears.

## Tests

- Component tests mounting the real auth and policy services over mocked fetch. Prior art: `usePublishPolicies.test.tsx`, `TermsTab.test.tsx`, `AuthModals.profile.test.tsx`.
- One Playwright spec on `e2e/community-browser.spec.ts`'s pattern: signup → policy shown → accept → a like succeeds. Also: login as unaccepted → prompt → sign out → signed-out state.
- Verify in the preview via the dev-router; static frames only.

## Comments

**2026-09-03 — implemented.** Four gates green: typecheck 0 errors, lint 0 errors (2 pre-existing
warnings in an untouched file), 8000 tests passing, build clean. Six new e2e cases pass across both
viewports.

Three decisions worth recording, because none was spelled out in the ticket:

1. **The signup read needed a server route that did not exist.** `GET /api/policies` sits behind
   `protect`, so at signup there is no token and no way to reach the canonical body. Ticket 03 gained a
   public `GET /api/policies/privacy-policy` returning `{ title, body }` and 404 while the row is off.
   That was the server ticket's call to make and its owner approved it; this client reads it with no
   token and falls back to registering anyway if the read fails, because refusing a signup over an
   unreadable policy is worse than letting the server ask again at the first request.

2. **The admin editor is in this ticket.** Ticket 07 step 4 enables the policy from Admin Panel →
   Policies, and 07 is blocked only by 01/03/04 — 03 being server-only leaves this the ticket that has
   to supply it. `PoliciesTab` gets a third sub-tab with its own re-accept box (kept apart from the
   gate's, which is guarded by a test) and the server's larger 20000-character body cap.

3. **The prompt waits for the age attestation.** The provider reads `GET /policies` at boot, and the
   age gate exists to stop a held token reading the community server before the player has attested.
   `MainMenu.ageGate.test.tsx` caught this; `checkNow` is now gated on `attested` and the boot pass runs
   on the first attested render.

Two things this ticket does not close:

- **`declinePrivacyPolicy` has no caller.** The ticket asked for it beside accept, and it is
  implemented, but the prompt's two buttons are Accept and Sign Out, and signup declines before any
  account exists. Nothing records a refusal today.
- **A suspended account reaching the prompt** (the server answers `PRIVACY_REQUIRED` before the
  suspension) has only Accept and Sign Out until ticket 06 adds the third button.
