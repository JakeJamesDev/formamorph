# 02 — Cloudflare dashboard setup wizard

Status: done
Spec: ../spec.md

## Task

Write the `/wizard` bash script for the one-time human-only Cloudflare setup. The agent writes the wizard; the user runs it. Steps, in order:

1. Create the Pages project — name `formamorph`, production branch `main` (both must match ticket 01's deploy flags).
2. Attach `formamorph.ai` as the project's custom domain (Cloudflare writes the DNS record itself).
3. `.com` alias wiring: proxied placeholder A records `@` and `www` → `192.0.2.1` (documentation-reserved, routes nowhere; proxying lets rules run with no origin).
4. Single Redirect rule on the `.com` zone: any host → `https://formamorph.ai` + preserved path and query, 301.
5. Create the API token (Pages Edit scope) and add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets.
6. Flip the flag that arms ticket 01's post-deploy check step.

Wizard bar: each step states where to click, what value to enter, and a verification command the script runs before advancing (e.g. `dig`/`curl` for DNS and redirect steps, `gh` is NOT installed — verify secrets by listing them in the GitHub UI).

## Done

- Script exists, runs top to bottom with skippable/resumable steps.
- Every automated verification is a real check, not an "assume ok".

## Comments

**Implemented** as [scripts/cloudflare-setup.sh](scripts/cloudflare-setup.sh), seven stages, committed in `d1d301f`. Changelog entry grouped with ticket 01's under **formamorph.ai Deploy** in In Progress -> Minor -> Added -> 🛠️ Developer tooling.

### Two premises in the ticket turned out to be wrong

| Ticket said | Reality | What the wizard does |
| --- | --- | --- |
| Step 1 creates the Pages project in the dashboard | Cloudflare: *"If your project is a Direct Upload project, you will not have the option to configure production branch controls"* ([branch-build-controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)). The create flow also demands files up front. | Token moves to stage 1; the project comes from `wrangler pages project create --production-branch main`. All six ticket steps survive across seven stages. |
| "`gh` is NOT installed" | `gh` 2.97.0 **is** installed and authenticated as JakeJamesDev, but its PAT lacks the Actions scope — `gh secret list` and `gh variable list` both return HTTP 403. | Tries `gh`, then falls back to the GitHub UI behind a confirm gate, exactly the remedy the ticket prescribed. |

### Stage map

| # | Stage | Automated check |
| --- | --- | --- |
| 1 | Account ID + API token | `GET /user/tokens/verify` is `active`, and `GET /accounts/{id}/pages/projects` is 200 |
| 2 | Pages project | `GET` project: name + top-level `production_branch`; then a **PATCH** of that branch back to itself, which is the only thing that proves Pages **Edit** rather than Read |
| 3 | `formamorph.ai` custom domain | `GET .../domains` until the entry's `status` is `active`; polls five minutes |
| 4 | `.com` placeholder A records | DNS-over-HTTPS; rejects `192.0.2.1` (proxy off) and asserts the answer falls inside Cloudflare's published IPv4 ranges |
| 5 | Single Redirect rule | Live requests: `formamorph.com/play/` → `301 https://formamorph.ai/play/` (byte-identical to the workflow's own probe) plus `www…/a/b?x=1&y=2` to prove path and query survive |
| 6 | Repository secrets | `gh secret list` when the scope allows; otherwise the UI and a confirm gate |
| 7 | `CLOUDFLARE_CHECKS` | `gh variable list` grepped for name **and** the value `true`; otherwise the UI and a confirm gate |

### Evidence

| Claim | How it was checked | Result |
| --- | --- | --- |
| Every dashboard fact is current, not recalled | A research pass over live `developers.cloudflare.com` docs, one source URL per fact | Two facts came back **UNVERIFIED** and were designed around: no deep link exists for creating a Pages project or for the Custom domains tab |
| The redirect recipe is Cloudflare's own | [redirect-domain](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/) documents this exact case: Dynamic + `concat(...)` + Preserve query string | A Static target drops the path, so the wizard insists on Dynamic |
| `192.0.2.1` proxied is endorsed, and never comes back in a lookup | Same doc, plus [proxy-status](https://developers.cloudflare.com/dns/proxy-status/) | The check asserts a Cloudflare address, never the placeholder |
| Helpers and checkers behave | 69-assertion suite over the real helpers: live DoH, live CIDR list, live 301/200 probes, plus simulated API bodies | **69 passed, 0 failed** in 9.2 s |
| Every checker bites | Each mutated one field at a time — wrong branch, wrong project name, 404, `pending` domain, a different domain, raw `192.0.2.1`, a non-Cloudflare address, 302-for-301, dropped path, dropped query, unreachable `www`, missing secret, `CLOUDFLARE_CHECKS=false`, a similarly named variable, `gh` failing | All rejected; none passes on a wrong world |
| A Pages **Read** token cannot slip through | Simulated GET 200 + PATCH 403 | `check_project` passes (as it must), `check_project_ready` **rejects** |
| Runs top to bottom, both ways | Two full runs of the real script with stub binaries on PATH: "nothing configured, decline everything" and "everything already configured" | Both reach `finish`, **exit 0**; every stage in run B reports "already done" and skips |
| Shell is sound | `bash -n`; `shellcheck` is not installed on this machine | 0 syntax errors |
| Four gates | Run on `git archive HEAD` plus this ticket's two paths — another session holds an in-flight `ChipStructure` refactor across 18 files, so the tree-wide run is red for unrelated reasons | typecheck **0 errors** (22 s) · lint **0 errors**, 2 pre-existing TSDoc warnings (11 s) · test **451 files, 7271 passed**, 1 file / 3 skipped (43 s wall, 42.6 s reported) · build **succeeded** (19 s) |

### Bugs the dry runs and the review found, all fixed

1. **`verify` spun forever on a closed stdin.** Ctrl-D made the retry prompt loop on an empty answer. Found by the first dry run hanging; a failed `read` now stops the wizard.
2. **`check_token` proved Pages *Read*, not *Edit*.** `GET .../pages/projects` returns 200 for a read-only token, so it would pass all seven stages and 403 at deploy. Stage 2 now writes.
3. **A finished run printed an unfinished summary.** The library's `set_secret` pushes to `SKIPPED` *before* the manual fallback runs, so every real run (403 confirmed) would end with "still to do by hand" for work the human had just done. Replaced with `gh_put_secret` / `gh_put_var`.
4. **`check_alias_dns` had one "assume ok".** An unreachable IP range list made it accept any address. Now a failure.
5. **`probe` double-printed on an unreachable host** (`000 000 `). curl writes the `-w` line even on failure.
6. **The retry option on a bad token was a no-op** — `verify` re-ran the checker against the same globals. It now re-asks first.
7. **The poll budget contradicted its own text** (claimed 15 minutes, spent 3.3, and slept after the final failure).
8. British "honours" in a comment; a comment that called `/dev/null` a path that cannot exist; stages 6 and 7 duplicated as one 20-line shape, now `gh_stage`.

### Deliberately not done

- **spec.md's "It ends by triggering the dispatch failsafe and watching the post-deploy checks pass."** Ticket 02's own task list stops at step 6, and ticket 03 owns the dispatch plus a browser spot-check the wizard cannot perform. The wizard ends by naming the Actions URL. Worth a decision before ticket 03 runs: fold the dispatch into an eighth stage, or leave it where it is.
- `graphify update .` — no source AST added, and a run would index the other session's half-finished refactor.

### Note for ticket 03

Run it as `bash scripts/cloudflare-setup.sh` from the repo root. Expect the two GitHub stages to land on the UI path, because the current PAT returns 403 for Actions secrets and variables.
