# 09 — Remove the old spend report route

Type: task
Status: ready-for-agent
Blocks: release
Repo: FormamorphServer

## Problem

The Usage tab replaces the Spend Report section of the Server tab, and it reads `/api/hosted-ai/admin/usage-report`. Builds up to 3.6.0 still read `/api/hosted-ai/admin/spend-report` from the Server tab, so the server keeps that route until the next release.

That route has no use after the next release, and it must not stay as permanent dead code.

## Clears when

- The usage report route is deployed before the release ships.
- The next release ships with the Usage tab.
- `getSpendReport`, its route in `src/routes/hostedAiAdmin.js` and its test in `tests/hostedAiState.test.js` are gone from FormamorphServer.
- That server change is deployed.
