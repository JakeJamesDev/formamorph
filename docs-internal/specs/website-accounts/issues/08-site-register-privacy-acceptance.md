# 08 — Privacy Policy acceptance on the site register page

Status: needs-triage
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

- [ ] Render the policy on the site, or send the new account to `/play/` with a line saying the policy is
      waiting there. The first needs a markdown renderer light enough for the site bundle; `unified` +
      `remark-parse` + `remark-rehype` + `hast-util-to-html` are already dependencies and are a fraction of
      Streamdown's weight.
- [ ] Whether the acceptance UI is shared with the app or written once more for the site's own look.

## Done when

- [ ] A visitor who registers on the site can use the server without opening the game.
- [ ] A failed acceptance leaves the same recoverable state the app leaves: the account exists, and the
      signed-in prompt asks again.
- [ ] Four gates green; no export-shape change.
