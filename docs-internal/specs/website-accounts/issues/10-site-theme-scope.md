# 10 — Resolve site light-theme scope

Status: ready-for-human
Status note: Light and dark scope retained and implemented; review and live deployment verification remain.
Spec: [Website accounts](../spec.md), stories 39–41.

## Decision

Retain story 41. The landing and account pages share coordinated light and dark palettes. Both read the app's `vite-ui-theme` value without writing it, use the operating-system scheme for `system` or no stored choice, and follow preference changes while open.

`hosting/theme.js` is the small shared resolver loaded before either page paints. The account entry keeps the game `ThemeProvider` out of its bundle, so it gains no theme setter and cannot silently change the app preference.

## Done when

- [x] The spec and tickets record the chosen scope consistently.
- [x] Both themes render the account pages and shared controls correctly on desktop and phone without overwriting the app's theme preference.
- [x] Reduced-motion behavior is verified independently of the light-theme decision.

## Evidence

- `e2e/site-pages.spec.ts` compares the rendered account ground and primary control with the live landing palette in light and dark modes under the 1280×860 desktop and 375×812 phone projects. Login, registration, password reset, not-found, shared-header, and signed-in account-dialog surfaces are exercised with zero horizontal overflow. The light path holds `system` and proves the site does not replace it with the resolved mode.
- `e2e/landing.spec.ts` covers an explicit app choice, operating-system fallback, live system and cross-tab preference changes, and reduced motion parking the gallery independently of color scheme. The account-page suite separately proves that reduced motion removes the reused dialog's animation and transition durations.
- `scripts/checkLiveSite.sh` verifies that the shared theme resolver is served as JavaScript after deployment. Production deployment remains unverified.
