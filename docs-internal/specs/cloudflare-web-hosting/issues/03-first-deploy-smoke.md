# 03 — First deploy smoke run

Status: ready-for-human
Blocked by: 01, 02
Spec: ../spec.md

## Task

Prove the pipeline end to end without cutting a release.

1. Run the ticket 02 wizard to completion.
2. Trigger the release workflow via `workflow_dispatch` **on the `main` branch ref** with `cloudflare_web: true`. (The ticket originally said "the latest existing tag's ref". That does not work — see Pre-flight below.)
3. Watch the size guard and post-deploy checks pass in the run.
4. Human spot-check in a real browser: play at `https://formamorph.ai/play/`, confirm the Local Network Access prompt appears for a local endpoint (top-level page, not iframe), confirm `formamorph.com` lands on `.ai`.

## Done

- Green dispatch run including post-deploy checks.
- Browser spot-check passed and noted here under Comments.

## Pre-flight

Measured 2026-08-31, before any human step. Nothing was changed and no run was started.

### The tag ref in step 2 is wrong — dispatch on `main`

`release.yml` at `v2.15.2` (the latest tag) carries a bare `workflow_dispatch:` with **no inputs and no `cloudflare-web` job**. Ticket 01's job landed after that tag, in `909b6ab`. A dispatch run uses the workflow file from the ref it runs on, so a dispatch on `v2.15.2` would produce a run with no Cloudflare job at all.

Dispatching on `main` works, and the trade-off is small:

| Job | On a `main` dispatch | Why |
| --- | --- | --- |
| `web` | runs | no gate |
| `cloudflare-web` | runs | `workflow_dispatch && inputs.cloudflare_web` |
| `publish` | skips | `startsWith(github.ref, 'refs/tags/')` |
| `itch-web`, `itch-desktop` | skip | their own inputs default false |
| `build` (3-OS desktop matrix) | runs, wastefully | no dispatch gate; ~30 min of runner time for artifacts nothing consumes |

The one consequence to accept: the deployed build is `origin/main` HEAD, not the `v2.15.2` code. Its `package.json` version still reads `2.15.2`, and the next real release tag replaces it.

### The desktop matrix will not damage the v2.15.2 release

Worth checking, because the Linux runner runs `electron-builder --linux AppImage --publish always` against `publish: {provider: github, owner: JakeJamesDev, repo: formamorph}`. It uploads nothing here. Two independent guards in `electron-publish@26.15.7`'s `gitHubPublisher.js` both fire:

- `releaseType` resolves to `draft` (`electron-builder.yml` sets neither `releaseType` nor `draft`), and `getOrCreateRelease` returns `null` on an existing **published** release when the type is `draft`.
- It returns `null` again for any release published more than 2 hours ago.

`gh api repos/JakeJamesDev/formamorph/releases/tags/v2.15.2` → `{"draft":false,"prerelease":false,"published_at":"2026-08-27T12:28:32Z"}`. Both conditions hold.

### Cloudflare state

| Fact | How it was checked | Result |
| --- | --- | --- |
| ~~The Pages project `formamorph` already exists, and it is ours~~ **Wrong — corrected below** | Fetched `https://formamorph.pages.dev/assets/index-DxNxj-sc.js` and grepped it | Contains the `__fmb` provenance watermark and the string `"2.0.1"`, so it is this fork's code — but the deploy log proves it is not this account's project |
| `formamorph.pages.dev` belongs to **someone else** | Wrangler reported `Deployment complete! … https://7dfa4de8.formamorph-9sv.pages.dev` | The project name is `formamorph`, but Cloudflare had to suffix the subdomain because `formamorph.pages.dev` was taken. A third party hosts an old 2.0.1 build of this fork there. |
| Wizard stage 2 handles a pre-existing project | Read [cloudflare-setup.sh:555](scripts/cloudflare-setup.sh:555) | It PATCHes the production branch when the project exists on the wrong one; no gap |
| `formamorph.ai` is **not** attached | DNS-over-HTTPS `A` query | SOA only, no answer |
| `.com` placeholder records absent | DNS-over-HTTPS `A` query | `formamorph.com` SOA only; `www.formamorph.com` NXDOMAIN (Status 3) |
| Both zones sit on Cloudflare | Same queries | `sky.ns.cloudflare.com` |

So wizard stages 3 through 7 are all still to do. Stage 2 will find the project and only needs its branch confirmed.

### The dispatch must come from the GitHub UI

`gh` 2.97.0 is authenticated as JakeJamesDev, and its PAT can read Actions (`gh workflow list` works) but cannot write:

```
POST repos/JakeJamesDev/formamorph/actions/workflows/306722474/dispatches
→ 403 Resource not accessible by personal access token
```

Probed with a deliberately invalid ref, so no run was created. `gh secret list` and `gh variable list` are 403 too, which means `CLOUDFLARE_CHECKS`'s current value cannot be read from here — the wizard's stage 7 falls back to the UI, exactly as ticket 02 predicted.

### Runbook

1. **Do not push first.** The workflow is already on `origin/main` at `909b6ab`. The two unpushed local commits include another session's in-flight `PlaceholderValue` work; leaving them local keeps the deployed build clean.
2. `bash scripts/cloudflare-setup.sh` from the repo root. Expect stages 6 and 7 to land on the GitHub UI path.
3. GitHub → Actions → Release → **Run workflow** → branch **`main`** → tick *Push the web build to formamorph.ai*. Not a tag.
4. Watch `cloudflare-web`: the size guard, then Wrangler, then **Check the live site** (which only runs once `CLOUDFLARE_CHECKS` is `true`).
5. Browser spot-check, then note the result under Comments.

## Comments

### First dispatch run — 2026-09-01, run 33453025577

The deploy itself worked. `cloudflare-web` uploaded 462 files and the site came up. The **Check the live site** step failed, and the failure was the step's own, not the deploy's.

```
00:03:00.909  Uploading _redirects
00:03:02.907  Deployment complete!
00:03:03.336  /play/ status       200        ok
00:03:03.418  /play/ content-type text/plain FAIL
00:03:03.498  /play               522        FAIL
00:03:03.579  /                   522        FAIL
00:03:03.714  .com redirect       301        ok
00:03:03.948  assets cache-control immutable ok
```

The step ran **429 ms** after the deploy finished. Only the readiness probe had a retry loop; the other five fired once. The edge had the assets but not yet the `_redirects` rules, so the two rule-only paths answered 522. All six pass now.

Also noted: the deploy landed on **`formamorph-9sv.pages.dev`**. Cloudflare suffixes the subdomain when the project name is taken ([direct-upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)), and `formamorph.pages.dev` belongs to another account serving a 2.0.1 build. It has no bearing on `formamorph.ai`; retaking the subdomain would need both projects deleted and recreated, since [subdomains cannot be changed](https://developers.cloudflare.com/pages/platform/known-issues/).

**Second symptom, same cause.** The library drew 4 of 6 default worlds until a reload. The six bundled worlds are separate lazy chunks (668 KB to 8 MB); [WorldStorageService.ts:315](src/services/WorldStorageService.ts:315) fetches them in a `Promise.all` and collects failures into `failed`. Two chunk fetches failed in the same unsettled window. Wiping IndexedDB on `formamorph.ai` and reloading as a genuine first run seeds all six, so it is not reproducible. The durable weakness is that a transient fetch failure costs those worlds for the whole session; the next launch re-seeds them, but nothing retries in-session.

### Fix — `eb5c45a`

The live check now retries the full battery, eight attempts fifteen seconds apart, and annotates only on the last one.

| Claim | How it was checked | Result |
| --- | --- | --- |
| Passes against the real site | Ran the shipped step under `bash -e` against `formamorph.ai` | 6/6 ok, exit 0, **2 s** |
| Reproduces the production failure | Local Pages emulator: `/play/` green from the first request, rules lagging 20 s | The **previous** version exits 1 in 1 s with the same two annotations seen in the run |
| The fix resolves it | Same emulator, same conditions, new version | Retries twice, exits 0 in 32 s, no annotation for the transient |
| Still bites — never settles | Emulator that never serves the rules | 7 retries, exit 1 after 110 s, both `::error::` lines emitted |
| Still bites — real contract break | Emulator settled, `/` serving 301 instead of 302 | exit 1, correct annotation |
| A broken build fails fast | `index.html` with no script tag | exit 1 in **1 s**, not after the retry budget |
| Workflow still valid | `yaml` parse + `bash -n` on the extracted block; round-trip diff | Parses, 0 syntax errors, block identical |

Gates were not re-run: the diff is one workflow file and one changelog line, with no source file touched, so the four code gates cannot move. `graphify update .` skipped for the same reason.
