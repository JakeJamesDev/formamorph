# 11 — Shared rows and per-row weight overrides

Status: ready-for-agent
Blocked by: 10

Spec: `../ownership-spec.md` (Sharing and weight overrides).

## Scope

- A shared row carries its own weight map, **deny-list**: it says what is held back here, and a value added to
  the original afterwards rolls everywhere. No snapshot, no drift reporting — the widening is the intent.
- The override lives on the placeholder holding the shared row, keyed by that row's chip value → path walked
  under it → value id. It exports and absorbs with the placeholder. Placement re-minting on duplicate and
  paste carries the keys.
- Authorable only along explicit-pick paths. A slot is not a fixed node, and the tree only shows explicit
  picks, so the ambiguous case is unreachable — state it as a boundary, not an accident.
- Shared rows nest all the way down; each level may carry its own override.
- The resolution walk carries the active shared row and the path under it, the same shape as the placement
  chain it already carries for Unique rolls, and consults the override when it draws.
- Sharing an Object is allowed; its panel shows no weights and says why.
- The editor panel serves both: a shared row opens it with name, kind and value list locked, weight controls
  live and writing to the override. The chance reveal reads merged weights, so the percentages are local. The
  weightedness and chance helpers take the effective map instead of reading the placeholder's own.
- A value benched to zero drops out of the describe pass, the chip tooltip and the read-only pill. This
  changes existing behavior — today display ignores weights.

## Done

- Tests: a benched value resolves nowhere under its shared row and still rolls under the original; a value
  added to the original later rolls in the shared row; a deeper override applies at its own level; a duplicate
  carries its overrides; the locked panel writes the override and not the placeholder; a benched value is gone
  from pills and tooltips. Mutation-proven where guarding.
- Export-shape reminder in the response — the override map is new.
- Live-verified via dev-router against `saltmarsh-reach.json`; four gates green; changelog entry appended.
