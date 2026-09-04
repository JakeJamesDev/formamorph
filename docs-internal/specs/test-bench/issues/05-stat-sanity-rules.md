# 05 — Stat sanity rules + on-demand code check

**What to build:** Issues catches the stat bugs that faked authored numbers. Static rules (live,
debounced): starting value outside min/max, no descriptor covering the starting band or an
active-at-start descriptor contradicting the value, duplicate/unordered thresholds, percentage stat
with non-0/100 bounds, stat code present while no stat in the world reads a clock variable, a
trait's negative starting delta landing on a floor (clamp swallows it), a trait setting a stat below
what its own code raises it back to, AI-change locks on a codeless stat. Plus an on-demand "check
stat code" action in the Issues tab that executes each stat's code in the real sandbox and reports
throws, timeouts, and non-number returns — on demand because each run spins a VM and the badge must
stay instant.

**Blocked by:** 01 — Bench surface + Issues tracer.

Status: done
Status note: (commit a5c50c4)

- [x] Each static rule fixture-paired; the clamp-swallow and code-overrides-trait cases match the real defects that motivated them
- [x] Static rules run live; code execution only on explicit action
- [x] Execution findings carry the stat name and the failure kind (throw / timeout / non-number)
- [x] Badge latency unaffected by worlds with many coded stats

**Two catalog lines were narrowed, deliberately:**

- *Unordered thresholds* is **not** a rule. `buildStatContext` sorts descriptors ascending before picking
  the band, so authored order decides nothing at runtime. Duplicates **are** a rule — the later one is
  unreachable. (`docs/WorldEditor.md` and `lib/helpTopics.ts` both still tell authors that list order
  decides which band wins. That is stale; worth a separate doc fix.)
- *"The active-at-start descriptor contradicts the value"* needs reading the descriptor's prose, which the
  spec's Out of Scope forbids. Only the structural half ships — no descriptor covers the starting band.
  The `starts at 1` vs `none yet` mismatch stays a human read in **Opening** (ticket 12, user story 20).
