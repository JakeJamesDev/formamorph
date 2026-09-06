# 08 — Privacy Policy acceptance on the site register page

Status: ready-for-human
Status note: Implemented and verified locally. Production deployment remains unverified.
Spec: ../spec.md

**What to build:** Registering on `formamorph.ai/register` should answer the Privacy Policy the way registering in the game does, so a site-made account can use the server straight away.

**Blocked by:** None. Ticket 01 shipped `/register` without this, by decision.

## Why this exists

The game's register modal reads the public Privacy Policy before the account exists, shows it, and records
the acceptance against the new token (`AuthModals.tsx` → `PolicyService.fetchPublicPrivacyPolicy` and
`acceptPrivacyPolicy`). The site's register page skips both steps, because ticket 01's checklist did not
carry them and the app's `PolicyDialog` renders the policy through `MarkdownRenderer`, which pulls
Streamdown and Shiki — megabytes that have no business in a login page's bundle.

The server refuses every authenticated request with `PRIVACY_REQUIRED` until the policy is accepted. So an
account created on the site works, but does nothing, until its owner opens `/play/` and answers there.
Nothing is lost and nothing is wrong in the data — the account is simply half-usable, with no explanation
on the page that made it.

## What to decide first

**Audit — 2026-09-06:** `RegisterPage` still registers and immediately follows `next`; it never fetches or accepts the policy. The alternatives below are not equivalent: sending the player to `/play/` requires an explicit scope change because the done-state requires use without opening the game. An in-site flow should also cover existing sessions whose policy acceptance is missing or outdated, so retry does not require creating another account. Server refusal behavior must be checked against the current server checkout.

- [x] Render the policy on the site, or send the new account to `/play/` with a line saying the policy is
      waiting there. The first needs a markdown renderer light enough for the site bundle; `unified` +
      `remark-parse` + `remark-rehype` + `hast-util-to-html` are already dependencies and are a fraction of
      Streamdown's weight.
- [x] Whether the acceptance UI is shared with the app or written once more for the site's own look.

## Done when

- [x] A visitor who registers on the site can use the server without opening the game.
- [x] A failed acceptance leaves the same recoverable state the app leaves: the account exists, and the
      signed-in prompt asks again.
- [x] Four gates green; no export-shape change.

## Implementation — 2026-09-06

The site renders the public policy with a small `unified` pipeline and site-specific styling; Streamdown
and Shiki remain outside the account-site bundle. Registration validates first, reads the policy while
signed out, and creates the account only after **Accept and Create Account**. A failed acceptance keeps the
new session on the same policy with **Accept** as a retry. Opening `/register` with an existing session also
checks for a missing or outdated answer and offers the same recovery path.

The server contract was checked at `56c1daa`: registration and policy routes use the pre-policy auth path,
while accepting the current version reopens routes refused with `PRIVACY_REQUIRED`. Client coverage drives
the rendered page through the real fetch boundary, including the successful three-request sequence,
acceptance failure and retry without another registration, existing sessions, and StrictMode's doubled
effects. The pre-acceptance account guard was mutation-tested by creating the account early and observing
the expected failure.

Targeted coverage: `SiteMarkdown.tsx` 100% lines / 100% branches / 100% functions;
`RegisterPage.tsx` 90.68% / 86.88% / 71.42%. Static checks covered the policy step at desktop and
375&times;812, including its heading/list structure, action order, full-width mobile card, and lack of
horizontal overflow. Production deployment remains the human acceptance step.
