# Website accounts — remaining work

Audited September 6, 2026 against the client at `1f6f2fcc` and server at `36bd871`. This is an implementation inventory, not a production-release sign-off. Historical completion comments and checked boxes do not establish deployment.

## Client tickets

| Ticket | Current state | Remaining work |
|---|---|---|
| [01 — Site entry](issues/01-site-entry-login-register.md) | Implemented; review | Privacy and theme gaps now have their own tickets. |
| [02 — Landing header](issues/02-landing-header-sign-in.md) | Implemented; review | Avatar/sign-in link works through a tracked vanilla module; it has no sign-out action. See 09. |
| [03 — Session sync](issues/03-live-cross-tab-session-sync.md) | Partially implemented; reopened | Actual site/app browser tests on one origin, both logout directions, and a reliable no-reload assertion. Existing tests use two app pages. |
| [04 — Public profile](issues/04-public-profile.md) | Client and server implemented; review | Real deployed profile check; review server casing and suspension notes. The old missing-endpoint blocker is resolved. |
| [05 — Account page](issues/05-account-page.md) | Implemented; review | Core actions are present. Navigation/sign-out and deletion-cancellation notice are tracked in 09. |
| [06 — Email](issues/06-email-everywhere.md) | Client and server implemented; review | Production verification mail and complete user journey. |
| [07 — Password reset](issues/07-password-reset-pages.md) | Ready to implement | Request/token pages, AuthService methods, Forgot links in both login surfaces, desktop/Android external opening, tests. Server contract exists. |
| [08 — Privacy acceptance](issues/08-site-register-privacy-acceptance.md) | Needs triage | In-site acceptance and recoverable retry, including sessions with missing/outdated acceptance. Sending users to the game conflicts with the current done-state. |
| [09 — Account controls](issues/09-site-account-controls.md) | New; needs triage | Reach settings from the profile flow, sign out on the site, follow session updates, and show deletion-cancellation feedback. Choose placement. |
| [10 — Theme scope](issues/10-site-theme-scope.md) | New; needs triage | Resolve the spec's light/dark promise against the deliberate dark-only implementation; verify reduced motion independently. |

`ready-for-human` on implemented tickets means review remains, following the implementation protocol. Status notes distinguish those from server deployment work that actually needs human execution.

## Server and release

| Area | Evidence / remaining work |
|---|---|
| [Server 01 — Email registration/verification](../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/01-register-with-email-and-verify.md) | Implemented in `c14fa67`; schema, token, mail transport, and route test code present. |
| [Server 02 — Set/resend](../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/02-set-replace-resend-email.md) | Implemented in `c245781`; limiter is per account plus IP, and saving the same address preserves verification. Those differ from the original spec wording. |
| [Server 03 — Reset](../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/03-password-reset-by-email.md) | Implemented in `bca6cc3`; request/complete endpoints and route tests present. Client 07 can proceed. |
| [Server 05 — Username profile](../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/05-public-profile-by-username.md) | Implemented in `36bd871`. Exact spelling wins; ambiguous folded names select the oldest visible account. The ticket records the separate ID-endpoint suspension disclosure gap. |
| [Server 04 — Deploy mail](../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/04-deploy-mail-to-the-box.md) | Open: Resend/DNS, production environment, database preflight and schema verification, deploy/restart, actual inbox verification/reset, session invalidation and replay checks, deployed profile. |
| Email privacy disclosure | The server seed policy still says email is unused and never mailed. Update the source and live policy row; the acceptance-version decision belongs to the maintainer. Server 01/04 track this follow-up. |

**Production status is unverified:** no production environment, DNS, database, deployment, or inbox was inspected. Server ticket updates were occurring concurrently; this audit edits only the client tracker.

## Suggested order

1. Implement 07 against the existing server contract. In parallel conceptually, settle 08/09's presentation and 10's scope.
2. Complete privacy acceptance and site account controls; finish 03's real cross-surface browser coverage.
3. Finish server disclosure/deployment prerequisites and review the documented casing, limiter, and suspension differences.
4. Run release gates, build the site entry, and verify real mail/profile/session journeys before declaring the feature shipped. Check desktop/Android recovery links and phone layout as part of that pass.

## Audit checks

- Inspected the route map, account pages, landing session module, AuthService, profile service, browser tests, hosting redirects, and shared deploy action; checked server route/controller code and ticket history.
- Ran the existing client site/AuthService/UserService tests: **12 files, 164 tests passed; 3.58 seconds wall time** (Vitest reported 2.81 seconds). No test or fixture edits. The initial `npx` launch failed before running tests because it was absent from PATH (0.70 seconds); the successful run used the bundled Node executable.
- Server route tests, Playwright, full code gates, and production checks were not run in this documentation audit. No application code changed.
- `graphify query` failed at startup with `uv trampoline failed to canonicalize script path`; direct source inspection supplied the inventory.

## Adjacent findings, outside this implementation pass

Earlier tickets also record generic login errors (`message` read where server refusals use `error`), unused toast-library weight in the site bundle, and remaining `WorldStorageService.API_URL` call sites. These are not silently included in the account work above; prioritize separately if wanted.
