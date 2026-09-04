# 04 — One deploy path, two sources

Status: done
Spec: ../spec.md
Blocked by: 03

## Task

Split the deploy into a shared assemble-guard-deploy-check sequence plus two callers.

- Extract the sequence into a composite action. Its input is the web-build zip.
- The release path feeds it the freshly built `web` artifact, exactly as today.
- A new `site_only` dispatch input feeds it `formamorph-web-<version>.zip` downloaded from the
  latest GitHub release, so a site edit never ships unreleased app code.
- A `site_only` dispatch must not rebuild the app or republish the release.
- The assemble step copies every file in `hosting/`, not just the two config files.
- The size guard runs on both paths.

## Done

- Workflow YAML parses; job wiring, gates, and step order asserted.
- Every `run:` block is valid shell under `bash -n`.
- A `site_only` dispatch skips `build`, `web`, and `publish`; a tag push still runs all three.

## Comments

**Implemented.** The assemble-guard-deploy-check sequence moved into a composite action at `.github/actions/deploy-site/`. Two jobs call it:

- `cloudflare-web` (unchanged gate) passes the `web` artifact this run built.
- `cloudflare-site` runs only on a `site_only` dispatch. It resolves the latest release through `repos/{repo}/releases/latest` — which skips drafts and pre-releases, so a beta can never become what `/play/` serves — downloads that release's `formamorph-web-<version>.zip`, and hands it to the same action.

`build` and `web` both carry `if: ${{ !inputs.site_only }}`, so a site-only run builds nothing; `publish` needs both and therefore skips with them. The assemble step now copies `hosting/.` whole rather than the two config files by name. The zip path reaches the shell through `env:` rather than an inline `${{ }}`, so it is data rather than a shell word.

### Evidence

| Claim | How it was checked | Result |
| --- | --- | --- |
| Both files parse and the wiring is what it claims | Parsed with the `yaml` package; 27 structural assertions over inputs, gates, `needs`, step order, secrets, and the action's own steps | **27/27 pass** |
| Every `run:` block is valid shell | `bash -n` over all 18 run blocks in the workflow, the action, and `checkLiveSite.sh` | **0 syntax errors** |
| A site-only dispatch builds and publishes nothing | Assertions on the `if:` guards and `publish`'s `needs: [build, web]` with no `always()` | confirmed |
| The size guard passes the real assembled root | The shipped step verbatim against a real `npm run build` plus the site | pass; largest file 21 596 019 B = **20.59 MiB**, 4.4 MiB under the cap; 522 files |
| The size guard bites | Same step against a padded file | 26 214 399 B (1 B under) -> **exit 0**; 26 214 400 B (exactly 25 MiB) -> **exit 1** with the annotation |
| `wrangler-action@v4` is still current | GitHub releases API | latest is `v4.0.0` (2026-05-12); every `actions/*` in the repo is already on its current major |

**Not run here:** the deploy itself. Ticket 07 is the first `site_only` dispatch, which proves that path end to end and needs a push first.
