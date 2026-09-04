# 01 — Privacy Policy text and the public page

Status: done
Type: task
Spec: ../spec.md (Solution; Implementation Decisions › The Privacy Policy › Public copy; Further Notes › Cutover order)

Nothing else may collect until this is live. Content ticket: no server code.

## Task

- Draft the Privacy Policy body as markdown, in the same register as the existing Terms of Service row (plain, short sections, bold where it matters). It must state, from what the schema actually does:
  - what is collected: username, password hash, optional email, avatar, everything published, likes, follows, comments, feedback and its diagnostics, and the timestamps on all of it;
  - the Signal: a salted hash of the network address plus a coarse browser family, recorded at signup, login, like, publish, comment, and follow; kept 90 days; used only to detect abuse; never acted on automatically; basis is legitimate interest;
  - that the network address is already processed for rate limiting;
  - processors: the hosting provider (Helsinki, Finland) and Cloudflare (proxy, DNS, file storage), and that Cloudflare handles every request's address;
  - retention: Signals 90 days; nightly database copies held 30 days; the storage mirror;
  - deletion: how to request it in-app, the seven-day Grace Period, that logging in cancels it, the choice about published content, that suspended accounts request it through Feedback, and that moderation records keep the username afterward;
  - that the optional email is currently used for nothing;
  - the minimum age the existing age gate enforces;
  - a contact address that reaches the operator.
- Deliver it twice: as the body for the server policy row (ticket 03 seeds it), and as a static page in the public site's source at a `/privacy` path, styled like the landing page. Same text; the spec names the server row canonical and this page a copy.
- The page ships with the site's normal deploy. Confirm it renders at `https://formamorph.ai/privacy` before ticket 07.

## Acceptance

- The owner has edited the draft and a lawyer has confirmed it. Neither happens in this ticket; the ticket ends with the draft delivered and the page deployed behind whatever review gate the owner sets.
- The page is reachable signed-out and passes the site's existing e2e landing spec unchanged.

## Tests

- Landing e2e gains one check: `/privacy` returns the page and its heading. Nothing else; this is content.

## Answer

Shipped. The public page is `hosting/privacy/index.html`, served signed-out at `formamorph.ai/privacy` and linked from the landing footer (formamorph `c4e3779b`, "Publish The Privacy Policy Page"). The reviewed text lives in `../privacy-policy.md`. Verified 2026-09-03: the page answers 200.
