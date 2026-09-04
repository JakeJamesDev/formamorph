# 05 — Live checks for the new root

Status: done
Spec: ../spec.md
Blocked by: 04

## Task

- `/` expects `200` with `text/html`, not `302`.
- Add a content probe: the served root names Formamorph.
- Add a site-asset cache-header probe.
- All existing `/play/` and `.com` probes stay. The full-battery retry stays.
- Move the script out of the YAML so tests can run the shipped text, not a copy.

## Done

- Checks pass against a local Pages emulator built on Cloudflare's own parsers, serving the real
  assembled `out/`.
- Each new check is proven to fail against a mutated contract: root serving a 302 again, and the
  site cache header removed.
- The script still fails loudly under `bash -e` against a dead host.

## Comments

**Implemented.** The check moved out of the workflow into `scripts/checkLiveSite.sh`, which the composite action runs as `bash scripts/checkLiveSite.sh` — through `bash` so a missing executable bit never matters, and in a file so tests exercise the shipped text rather than a copy.

Nine probes, up from six. `/` changed from `302 -> /play/` to `200` + `text/html`, and two are new: a content probe (the served root names Formamorph) and a site-asset cache probe (`/site/icon.png`). Every existing `/play/` and `.com` probe, the retry battery, the annotate-only-at-the-end rule, and the `set +e +o pipefail` opener all survive unchanged. `ATTEMPTS`, `DELAY`, `OUT_DIR`, and `SITE_ASSET` join `BASE_AI`/`BASE_COM` as env overrides, which is what lets one run drive an emulator.

### Evidence

A local Pages emulator (`.scratch/landing-page/work/pages-emulator.mjs`) built on Cloudflare's own `parseHeaders` / `parseRedirects` / `generateRulesMatcher` (workers-sdk `main` @ `90b1d08`), serving the real assembled `out/` — 462 app files from a fresh `npm run build` plus the 60 site files.

| Claim | How it was checked | Result |
| --- | --- | --- |
| The checks pass when the contract holds | Shipped script against the emulator, hostnames overridden only | **all 9 green, exit 0** |
| Root back to a 302 | Re-added `/  /play/  302` to `out/_redirects` | `FAIL / status - expected '200', got '302'` |
| Site cache header removed | Dropped the `/site/*` rule from `out/_headers` | `FAIL /site/icon.png cache-control - expected '*max-age=86400*', got ''` |
| Root stops naming the product | Served an `index.html` with the name replaced | `FAIL / names Formamorph` |
| `/play` downgraded to 302 | Mutated the surviving redirect rule | `FAIL /play redirect - expected '301 ...', got '302 ...'` |
| `immutable` dropped | Mutated the assets rule | `FAIL assets/index-*.js cache-control` |
| Nothing deployed, under `bash -e` | Ran `bash -e scripts/checkLiveSite.sh` against a dead host | all 9 report, 9 `::error::` annotations, **exit 1** |
| The no-hashed-asset guard fires | `OUT_DIR` pointed at an `index.html` with no script tag | `::error::No hashed asset found`, exit 1, no probe run |

**5/5 mutations bite, and the unmutated baseline passes in the same harness.** Each mutation ran against its own emulator on its own port pair: a lingering emulator on a fixed port answers with the *unmutated* config, and the first pass of this proof read "no bite" on four of five for exactly that reason.
