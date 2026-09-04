# 03 — Quick fixes

**What to build:** Findings with an unambiguous repair fix themselves in one click. Rules gain an
optional `fix(world) → World`; the Issues row shows Fix (or Fix all on a grouped row) only when the
rule carries one. Applying a fix edits the world exactly like a hand edit — marks it dirty, the
finding disappears on recompute. The first fix applied to a never-edited downloaded world shows a
one-line note that it marks the copy as edited. No bulk fix-everything affordance. Initial fix set:
strip leading article, remove self-duplicate alias, delete dead legacy start field, delete unused
placeholder, remove orphaned entity reference.

**Blocked by:** 01 — Bench surface + Issues tracer.

Status: done
Status note: commit 19a00ca

- [x] Fix removes exactly its finding and introduces no new findings (fixture round-trip)
- [x] Fixing twice equals fixing once (idempotence)
- [x] World marked dirty; undo path is the editor's existing discard, nothing bespoke
- [x] Judgment-call findings (e.g. which location should be starting) offer Open, never Fix
- [x] Download note appears once per world

**Built:** `Rule.fix?(world) → world` + `applyRuleFix` + `FindingGroup.fixable`; Fix / Fix All on the row;
write-through in `WorldEditor.applyBenchFix`. Fix set: strip leading article · remove self-duplicate alias ·
delete legacy `isStartLocation` (promoting a truthy one to `isStarting` when nothing else claims it) · delete
unused placeholder · drop orphaned placements (an entity whose *last* placement is dead keeps it — dropping
it would raise `entity-nowhere`). The unused-placeholder rule was built here; its usage scan is wider than
the resolver's field list so a chip parked where it never resolves still counts as a mention.
