# 03 — Stat request invents changes on Cydonia

Type: task
Status: needs-triage
Blocks: release

## Problem

The stat request misses its probe bar on Cydonia 24B, one of the two test models. With the shipped wording, the request records many stat changes the narration didn't cause, mostly a drain on the player's Vigor every turn. Exact replies fell to 30% against 47% before the last wording change. The cloud model clears the bar with the same wording.

Owning effort: [Entity Stats](../../entity-stats/spec.md), rulings Q45, Q56, Q64 and Q66. Ticket 17 tried 13 wordings. Every line that lifted cloud recall raised Cydonia's invented changes.

## Progress

- 2026-10-11, ticket 23 (Q78): wording FB lifts Cydonia. With groups, exact is 54–57% against 43–44%, and invented changes are 37–39 against 49–50. Flat, exact is 37% against 29–32%, and invented changes are 55–56 against 63–64. The blocker stays open until a Cydonia run against the full Q28 bar clears it.
- 2026-10-11, ticket 26 (Q86): a lean prompt without the "What to change" rules made Cydonia far worse, at 3–21% exact with 66–94 invented changes. The rules are what hold Cydonia's invented changes down. Lean did not ship.

## Done when

- The entity stats probe meets Q28 and Q45 on Cydonia without a drop on the cloud model.
- Or the user rules the blocker closed.
