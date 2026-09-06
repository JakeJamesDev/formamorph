# 10 — Resolve site light-theme scope

Status: needs-triage
Status note: Spec story 41 requires light and dark themes; the implementation is deliberately dark-only.
Spec: [Website accounts](../spec.md), stories 39–41.

## Decision needed

`site/site.css` declares `color-scheme: dark` and one palette. Ticket 01 deferred light mode to a future landing-page theme change; the spec still promises both themes.

Choose whether to retain that requirement and schedule coordinated landing/account theme work, or explicitly defer it in the spec. Do not mark story 41 complete merely because the dark palette matches the landing page.

## Done when

- [ ] The spec and tickets record the chosen scope consistently.
- [ ] If retained, both themes render the account pages and shared controls correctly on desktop and phone without unexpectedly overwriting the app's theme preference.
- [ ] Reduced-motion behavior is verified independently of the light-theme decision.
