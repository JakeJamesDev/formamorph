# 02: Month Close

Status: ready-for-human
Base: 2ea9b20
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/active-installs/spec.md` in formamorph (Server: totals table, Month close, admin route)

Model rationale: a destructive close that must be safe to repeat and must leave the admin numbers unchanged.

## What to build

Once a calendar month ends, the hourly retention sweep closes it. It writes each day's totals and the month's total, then deletes that month's daily rows and its key, in one transaction. The admin route reads closed months from the totals and shows the same numbers it showed before the close.

## Acceptance criteria

- [x] An additive schema step creates the totals table, with a unique index on kind, period, platform and version. (step `activeInstallTotals`; "refuses a second total for one period, platform and version", bootSchema and smoke lists)
- [x] The close runs from the retention sweep at boot and every hour, with an explicit `now`, in its own try/catch. It runs even when the sweep's other steps return early, and its count joins the sweep's result. ("closes even when the sweep cannot read its deadline", "keeps the rest of the sweep running when the close throws"; boot and hourly calls are the existing `sweepRetention()` and `hourly` wiring, unchanged)
- [x] For each month before the current one that still has rows, the close writes day and month totals and deletes the rows and the key, in one transaction. ("closes a past month into totals and deletes its rows and key", "leaves the current month live")
- [x] The month total counts each hash once, under the platform and version of its first row that month. (same test; mutating `ORDER BY day` to `DESC` turned 5 tests red)
- [x] The admin route returns the same numbers before and after the close. ("shows the admin the same numbers before and after the close")
- [x] A close that runs twice writes the totals once, and a month that already has totals is never closed again. ("writes the totals once when it runs twice, and never closes a closed month again"; skipping the check turned it red)
- [x] A close that runs days late produces the same totals. ("produces the same totals when it runs days late")
- [x] CONTEXT.md gains **Month Close**.
- [x] Removing the key delete turns a test red. (2 tests red; narrowing it to months with rows turns "deletes a past month key that has no rows" red)

## Landed

**Not verified**

- None.

**For you**

- Nothing a player can judge: the change is server-side only and stays behind the off `active_installs` setting.
