# 03 — Redirect and cache contract

Status: done
Spec: ../spec.md

## Task

- Remove the root `/ -> /play/ 302` from `hosting/_redirects`. The root now serves the landing page
  as a 200. `/play -> /play/ 301` stays.
- Add a `_headers` rule giving site assets a day of cache. They are not content-hashed.
- The landing HTML keeps Pages' default revalidation.

## Done

- Cloudflare's own `parseHeaders` / `parseRedirects` accept both files with zero invalid rules.
- `generateRulesMatcher` confirms the new site-asset rule matches a real committed image path and
  does not match the landing HTML.

## Comments

**Implemented.** The root 302 is gone from `hosting/_redirects`; `/play -> /play/ 301` stays. `hosting/_headers` gains a `/site/*` rule at `max-age=86400`. The landing HTML is deliberately unlisted, so Pages keeps revalidating it and a page edit is live at once.

### Evidence

Ran Cloudflare's own `parseHeaders` / `parseRedirects` / `generateRulesMatcher` (workers-sdk `main` @ `90b1d08`, bundled with esbuild) over the shipped files:

| Claim | How it was checked | Result |
| --- | --- | --- |
| Both files are valid Pages config | Cloudflare's parsers | 4 header rules, 1 redirect rule, **0 invalid** |
| `/site/*` matches a real committed image | Cloudflare's rules engine, serving the real assembled `out/` | `/site/icon.png` -> `public, max-age=86400` |
| The rule does not reach the landing HTML | same | `/` -> no cache-control rule applied |
| The existing rules still match | same | `/play/assets/index-*.js` -> `max-age=31536000, immutable`; `/play` -> 301 `/play/` |
| The root now serves a page | same | `/` -> **200 `text/html`**, 11 607 bytes |
