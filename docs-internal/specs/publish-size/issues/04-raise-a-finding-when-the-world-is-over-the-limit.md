# 04: Raise A Finding When The World Is Over The Limit

Status: ready-for-human
Base: be50291d
Blocked by: 03 - Show Publish Size In The World Doctor
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

One rule head, one hook branch, one merge line, following the stat-code-execution pattern exactly. Sonnet with the pattern in front of it.

## Parent

`docs-internal/specs/publish-size/spec.md`

## What to build

When the measured size reaches the world limit, the World Doctor lists a warning: "The world is <size>, over the <limit> publish limit." The flask badge counts it like any other row. Clicking the item opens the Overview. There is no Fix. The finding is a head outside the rule catalog, produced from the size hook and merged into the findings, so Triggers never runs it and the rule count is unchanged.

## Acceptance criteria

- [x] A `world-too-large` head exists with severity warning, section overview, no check, no fix
- [x] Under the limit yields no finding; at the limit yields one warning with the message
- [x] The rule count is unchanged and Triggers output is unchanged
- [x] The badge counts the row; seen-state and dismissal work on it as on any row
- [x] The test fails with the bug reinstated (finding never raised)
- [x] Four gates green

## Blocked by

- 03, Show Publish Size In The World Doctor

## Comments

- 2026-09-10: Standards and Spec review against `be50291d` both came back clean — no missing/partial requirements, no scope creep, no hard standards violations. Two judgment-call duplication smells noted (the finding-message wording echoes `publishLimitRefusal`'s shape, and the `{ ruleId, severity, section, message, items }` literal re-derives the private `finding()` helper) — both inherited from mirroring the stat-code-execution pattern as instructed, not introduced by this change, so left as-is rather than expanding scope.
