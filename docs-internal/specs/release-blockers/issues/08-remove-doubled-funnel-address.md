# 08 — Remove the doubled offer count address

Type: task
Status: ready-for-agent
Blocks: release
Repo: FormamorphServer

## Problem

3.6.0 builds send offer steps to `/api/api/funnel/<step>`, because `funnel.ts` added `/api` to a base that already ends in it. The client is fixed for the next release. The server also accepts the doubled address so 3.6.0 builds can count in the meantime.

That address has no use after the next release, and it must not stay as permanent dead code.

## Clears when

- The next release ships with the client fix.
- The `/api/api/funnel` mount in `src/app.js` and its test in `tests/funnelTotals.test.js` are gone from FormamorphServer.
- That server change is deployed.

## Notes

- User ruling, 2026-11-05: remove it on the next release. Builds still on 3.6.0 go back to a silent 404 after that, which is accepted.
