# Spec: Cloudflare web hosting at formamorph.ai/play

Status: ready-for-agent

## Problem Statement

Formamorph now owns two domains, `formamorph.ai` and `formamorph.com`, both on Cloudflare. Neither serves anything. The only hosted browser builds are the GitHub Pages dev build (demo flavor, updates on every push to `main`) and the itch.io embed. The itch embed cannot reach local LLM endpoints because browsers deny the Local Network Access permission to cross-origin iframes. There is no stable, release-versioned web build on a domain the project owns.

## Solution

Serve the full release web build at `https://formamorph.ai/play/`, deployed by the existing release workflow so it updates only on an explicit release tag. Redirect `formamorph.com` (and its `www`) to `formamorph.ai`, and redirect the bare `formamorph.ai/` root to `/play/` for now. The root stays free for a future landing page, and because `/play` is a path on the same origin, player saves in IndexedDB survive the landing page's arrival unchanged.

The GitHub Pages dev build stays as-is: dev flavor, every push. The two hosted builds serve different roles and different origins.

## User Stories

1. As a player, I want to play Formamorph at formamorph.ai, so that I use a stable release build on an official domain.
2. As a player, I want the site as a top-level page rather than an itch iframe, so that my browser can grant the Local Network Access permission and my local LLM endpoint works.
3. As a player, I want my saves and worlds to persist across releases, so that updating the site never loses my progress.
4. As a player, I want my saves to survive the future addition of a landing page, so that the site growing does not reset my library.
5. As a player, I want to type formamorph.com and land on the working site, so that either domain gets me to the game.
6. As a player, I want to visit the bare formamorph.ai root and reach the game, so that I do not need to know the /play path.
7. As a player, I want repeat visits to load fast, so that hashed assets come from my browser cache instead of the network.
8. As a player, I want a new release to actually reach me, so that unhashed files are not pinned by a stale long-lived cache.
9. As a player, I want the full build with community features, so that Discover, login, and publishing work on the official site.
10. As the maintainer, I want the domain deploy to ride the existing release workflow, so that one tag push updates desktop, itch, and the domain together.
11. As the maintainer, I want pre-release tags excluded from the domain deploy, so that beta builds never replace the live site automatically.
12. As the maintainer, I want a manual dispatch failsafe, so that I can push a specific build to the domain by hand, matching the itch failsafe.
13. As the maintainer, I want the deploy to fail before publishing if any file exceeds Cloudflare's per-file size cap, so that a dependency bump growing a wasm file breaks the job loudly instead of the site silently.
14. As the maintainer, I want post-deploy checks on the live URLs, so that a broken redirect or missing cache header fails the workflow instead of waiting for a player report.
15. As the maintainer, I want the one-time Cloudflare dashboard setup delivered as a guided wizard, so that I complete the human-only steps without hunting through dashboards.
16. As the maintainer, I want the dev build clearly distinguishable from the release build, so that a bug report names which build it came from.
17. As a future maintainer, I want the landing page to slot in at the root later, so that nothing about the game's URL or storage has to move.

## Implementation Decisions

- **Hosting is Cloudflare Pages** (direct upload via Wrangler), not Workers static assets. Pages limits fit the build: 25 MiB per file against a current largest file of ~20.6 MiB, 20,000 files against ~460.
- **The deploy is a new job in the release workflow**, dependent on the existing web build job, mirroring the itch web job's structure: same artifact download, same tag gate (full-release tags only, any suffixed tag excluded), and a matching boolean `workflow_dispatch` input as the manual failsafe.
- **The deployed flavor is the release web build** the web job already produces: community features on, full tag data, bare footer. The GitHub Pages workflow and its demo flavor are untouched.
- **The app lives under `/play/`**, one directory down in the upload root. Vite `base` is already relative, so no build change is needed. The upload root also carries the Pages `_redirects` and `_headers` config files, sourced from a small tracked hosting config directory in the repo.
- **Redirect contract** (the `_redirects` file):
  - `/play` → `/play/`, 301. Relative asset URLs break without the trailing slash.
  - `/` → `/play/`, 302 — deliberately temporary-coded so browsers never pin the root to the game, keeping the landing page swap clean later.
- **Cache contract** (the `_headers` file):
  - Hashed assets under the app's assets directory: `public, max-age=31536000, immutable`.
  - Unhashed model/animation files at the app root (`.vrm`, `.fbx`): `public, max-age=86400`.
- **Wrangler deploys with an explicit production branch flag.** A tag push has no branch, and without the flag Wrangler produces a preview deploy that never reaches the custom domain. The flag value must match the Pages project's production branch setting.
- **Secrets:** a Cloudflare API token scoped to Pages Edit, plus the account ID, both as repository secrets.
- **Domain wiring (human-only, via the wizard):**
  - `formamorph.ai` attaches to the Pages project as a custom domain; Cloudflare manages the DNS record.
  - `formamorph.com` gets a proxied placeholder A record (documentation-reserved address `192.0.2.1`; `www` likewise) so the edge can run rules with no origin, plus a Single Redirect rule: any host on the `.com` zone → `https://formamorph.ai` with path and query preserved, 301.
- **No COOP/COEP headers.** They would unlock threaded ONNX for TTS, but COEP blocks the arbitrary cross-origin image URLs the linked-images feature depends on.
- **Origins are intentionally distinct.** The dev build (github.io), itch embed, and formamorph.ai never share IndexedDB. Players moving between them carry content via world/save export files, which already exist for this purpose.

## Testing Decisions

- **No vitest tests.** The feature is CI config and static hosting files; a repo test asserting the content of a config file would mirror the file, not exercise behavior. Verification is behavioral, in the workflow itself.
- **Pre-deploy size guard:** a workflow step in the deploy job fails if any file in the unpacked web build is at or over the 25 MiB Pages cap. Bite check: it must fail against an artificially oversized file, and the current largest real file (~20.6 MiB) must pass.
- **Post-deploy live checks:** a workflow step after the Wrangler deploy curls the live site and fails on any mismatch:
  - `/play/` returns 200 with HTML.
  - `/play` returns 301 to `/play/`.
  - `/` returns 302 to `/play/`.
  - The hashed-assets path returns the immutable cache header.
  - `formamorph.com/anything` returns 301 to `formamorph.ai/anything`.
  - The `.com` checks depend on the dashboard-side redirect rule, so they belong after the wizard is complete; the step tolerates nothing once wired.
- **Prior art:** the itch web job in the same workflow is the structural template — tag gating, artifact handling, and the dispatch failsafe all mirror it, so the release flow stays one pattern.
- **First-deploy smoke:** the initial deploy runs via the dispatch failsafe on an existing tag ref, before any new release tag, proving the pipeline end to end without cutting a release.

## Out of Scope

- The landing page itself. The root redirect is the placeholder for it.
- Retiring or changing the GitHub Pages dev deploy or the itch channels.
- COOP/COEP and threaded ONNX.
- Any app code, version bump, or export-shape change. This feature ships zero bytes of app code.
- Email, or any other service on either domain.
- Analytics on the hosted site.

## Further Notes

- The wizard covers, in order: creating the Pages project (name and production branch chosen to match the workflow), attaching the `.ai` custom domain, the `.com` placeholder DNS records and redirect rule, creating the API token, and adding both repository secrets. It ends by triggering the dispatch failsafe and watching the post-deploy checks pass.
- The size guard's margin is real: the ONNX runtime wasm is within ~4.4 MiB of the cap. If it ever crosses, the escape hatch is serving that file from R2, which is its own small effort — the guard failing is the signal to start it, not something to bypass.
- Cloudflare Pages serves extensionless HTML and directory indexes natively; no SPA fallback rewrite is needed because the app has no router and only one HTML entry.
