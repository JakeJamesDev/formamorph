# 07 — First `site_only` deploy

Status: ready-for-human
Spec: ../spec.md
Blocked by: 04, 05

## Task

Ship the landing page through the `site_only` path, proving that path end to end without cutting a
release. Needs a push, so it is the user's to run.

1. Push the landing-page commit to `main`.
2. Run the Release workflow by hand: **Actions → Release → Run workflow**, on `main`, with
   **`site_only` checked** and every other box clear.
3. Watch the run. It must skip `build`, `web`, and `publish` entirely, and run only
   `cloudflare-site`.

## Done

- The run's only job is `cloudflare-site`; nothing is built and no release is touched.
- `https://formamorph.ai/` serves the landing page, and `https://formamorph.ai/play/` is unchanged.
- The live checks pass in the run (they are armed: `CLOUDFLARE_CHECKS` is `true`).
- A share of `https://formamorph.ai/` unfurls with the title, description, and screenshot.

## Notes

The live checks run against production, so a failure here is the workflow reporting a real problem,
not a flake — read the report before re-running. The battery already retries eight times over 105 s
for edge propagation.
