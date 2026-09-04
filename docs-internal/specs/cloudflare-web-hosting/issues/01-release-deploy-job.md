# 01 — Release deploy job + hosting config

Status: done
Spec: ../spec.md

## Task

Add the Cloudflare deploy pipeline to the release workflow, plus the static hosting config it uploads.

1. **Hosting config dir** (tracked, e.g. `hosting/`):
   - `_redirects`: `/play → /play/ 301` and `/ → /play/ 302`.
   - `_headers`: immutable year-long cache on `/play/assets/*`; `max-age=86400` on `/play/*.vrm` and `/play/*.fbx`.
2. **New `cloudflare-web` job** in `.github/workflows/release.yml`:
   - `needs: web`; downloads the `web` artifact; unzips into `out/play/`; copies the hosting config into `out/`.
   - Gate mirrors `itch-web`: full-release tag pushes only (no `-` suffix), OR `workflow_dispatch` with a new `cloudflare_web` boolean input (add next to `itch_web`).
   - **Size guard step** before deploy: fail if any file in `out/` is ≥ 25 MiB (Pages per-file cap). Current largest real file is ~20.6 MiB and must pass.
   - Deploy via `cloudflare/wrangler-action` → `pages deploy out --project-name=formamorph --branch=main`. The `--branch` flag is mandatory: tag pushes have no branch and Wrangler would otherwise create a preview deploy that never reaches the custom domain.
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   - **Post-deploy check step**: curl the live site and fail on mismatch —
     `/play/` 200 HTML · `/play` 301→`/play/` · `/` 302→`/play/` · immutable header on a hashed asset · `formamorph.com/x` 301→`formamorph.ai/x`.
     Guard the whole step so it is skippable until ticket 02's dashboard wiring exists (e.g. a repo variable or an `if:` on a vars flag), then strict forever after.

## Done

- Workflow YAML valid (actionlint or a dispatch dry parse).
- Size guard proven to bite: fails against a padded ≥25 MiB file locally, passes the real build.
- No app code, no version, no export shape touched.

## Comments

**Implemented.** `hosting/_redirects`, `hosting/_headers`, and the `cloudflare-web` job plus the `cloudflare_web` dispatch input in `.github/workflows/release.yml`. Changelog entry added under In Progress → Minor → Added → 🛠️ Developer tooling.

### Evidence

| Claim | How it was checked | Result |
| --- | --- | --- |
| Hosting files are valid Pages config | Ran Cloudflare's own `parseHeaders` / `parseRedirects` (workers-sdk `main`) over both files | 3 header rules, 2 redirect rules, **0 invalid** |
| `/play/*.vrm` and `/play/*.fbx` really match | Ran Cloudflare's own `generateRulesMatcher` against the real filenames | `default-avatar.vrm` and `idle.fbx` → `max-age=86400`; `assets/*` → `immutable`; `index.html` → no rule |
| `_redirects` beats Pages' own trailing-slash handling | Read `pages-shared/asset-server/handler.ts` — redirects are matched before any asset lookup | Confirmed; the 301/302 codes in the file are what ships |
| Workflow YAML valid | Parsed with the `yaml` package; asserted job wiring, step order, secrets, gate | All 17 structural assertions pass |
| Every `run:` block is valid shell | `bash -n` over all 13 run blocks in the workflow | 0 syntax errors |
| Size guard passes the real build | Extracted the shipped step verbatim, ran against a fresh `npm run build` | Pass; largest file 21,596,019 B = **20.59 MiB**, 4.4 MiB under the cap; 464 files vs the 20,000 cap |
| Size guard bites | Same step against a padded file | 26,214,399 B (1 B under) → **exit 0**; 26,214,400 B (exactly 25 MiB) → **exit 1** with the error annotation |
| Live checks pass when the contract holds | Local Pages emulator built on Cloudflare's own parsers + rules engine, serving the real `out/`; ran the shipped check script with only the hostnames rewritten | All 6 checks green, exit 0 |
| Live checks bite | Mutated one hosting rule at a time and re-ran | `/play` 301→302 → `/play redirect` fails · `/` 302→301 → `/ redirect` fails · `immutable` dropped → cache-control fails · assets rule mis-pathed → cache-control fails. 4/4 |
| Live checks fail loudly when nothing is deployed | Ran under `bash -e` (the Actions default shell) against a dead host | All 6 report `::error::`, exit 1 |
| The "no hashed asset" guard fires | Served an `index.html` with no script tag | Guard reports its own error, does not abort |

### Review finding, fixed in this ticket

`/code-review` found one real bug in the live-check step. Actions runs `run:` blocks as `bash -e {0}`, and the step's `set -uo pipefail` did not clear `-e`. The first unreachable URL therefore killed the step at `CT=$(curl ... | ...)`, so the remaining four probes never ran and emitted no annotation; the same path made the `No hashed asset found` branch unreachable, because `grep` with no match exits 1 and aborts the assignment first. The step now starts `set +e +o pipefail; set -u` and ends with an explicit `exit 1`. Both directions were re-measured under `bash -e`.

### Gates

Another session holds an in-flight `PlaceholderValue` refactor across 16 source files in this working tree, so the tree-wide gates were red before this work started. Gates were therefore run on `git archive HEAD` plus only this ticket's three paths:

- `typecheck` **0 errors** (20.4 s)
- `lint` **0 errors**, 2 pre-existing TSDoc warnings in `src/lib/localNetworkEmbed.ts` (10.4 s)
- `test` **451 files, 7245 tests passed**, 1 file / 3 tests skipped (44.9 s wall, 43.5 s reported)
- `build` **succeeded** (15.7 s)

No app code, no version, no export shape touched — the diff is one workflow file, one changelog entry, and two new static config files.

### Notes for ticket 02

- The post-deploy check is gated on the repository variable **`CLOUDFLARE_CHECKS`**; the wizard's step 6 sets it to the literal string `true`.
- The Pages project must be named **`formamorph`** with production branch **`main`**, matching `--project-name=formamorph --branch=main`.
- `wrangler-action` is pinned at `@v4`, which installs Wrangler v4 by default.
- `graphify update .` was not run: this change adds no source AST, and running it would index the other session's half-finished refactor.
