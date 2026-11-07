# 02: Month Close

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/active-installs/spec.md` in formamorph (Server: totals table, Month close, admin route)

Model rationale: a destructive close that must be safe to repeat and must leave the admin numbers unchanged.

## What to build

Once a calendar month ends, the hourly retention sweep closes it. It writes each day's totals and the month's total, then deletes that month's daily rows and its key, in one transaction. The admin route reads closed months from the totals and shows the same numbers it showed before the close.

## Acceptance criteria

- [ ] An additive schema step creates the totals table, with a unique index on kind, period, platform and version.
- [ ] The close runs from the retention sweep at boot and every hour, with an explicit `now`, in its own try/catch. It runs even when the sweep's other steps return early, and its count joins the sweep's result.
- [ ] For each month before the current one that still has rows, the close writes day and month totals and deletes the rows and the key, in one transaction.
- [ ] The month total counts each hash once, under the platform and version of its first row that month.
- [ ] The admin route returns the same numbers before and after the close.
- [ ] A close that runs twice writes the totals once, and a month that already has totals is never closed again.
- [ ] A close that runs days late produces the same totals.
- [ ] CONTEXT.md gains **Month Close**.
- [ ] Removing the key delete turns a test red.
