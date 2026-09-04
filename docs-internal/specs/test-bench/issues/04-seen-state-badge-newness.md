# 04 — Seen-state + badge newness

**What to build:** The badge distinguishes new findings from accepted ones, so a still badge is
trustworthy. Finding identity is rule id + the item ids it names. On Bench close, the identity set
persists locally keyed by world id (same store family as dismissals — never in the world). On
recompute, unknown identities are new: the badge shows new counts prominently and known counts
muted; new findings sort to the top of their severity group with a marker; a Mark-all-seen action
exists. Editing an item re-raises its finding as new. Dismissal mutes a finding per world. A source
update on a downloaded world (changed source timestamp) clears the seen set; a plain re-download of
unchanged content keeps it.

**Blocked by:** 01 — Bench surface + Issues tracer.

Status: done

- [x] Badge renders new-vs-known distinctly and stays quiet when nothing is new
- [x] Identity survives reload; editing a named item re-raises the finding
- [x] Dismissed findings stay hidden per world and survive re-download of unchanged content
- [x] Source-update reset proven with a fixture (changed timestamp → seen set cleared)
- [x] Nothing written into the world object (export shape untouched)

**Built:** `lib/testBench/seenState` (pure) + `useBenchFindings` (the React binding). Identity is
`ruleId` + sorted item ids; the seen record stores a hash of the finding's wording beside it, which is what
makes editing a named item re-raise it — no world diffing. `withSeen` merges rather than replaces so a defect
that flickers mid-keystroke isn't announced twice; dismissals key on identity alone so a rename can't un-mute
one. One localStorage record per world id (`FORMAMORPH_benchFindingState`), source-version stamped: a changed
`sourceUpdatedAt` clears the seen set on load, dismissals survive it (the author's own call).
`groupFindings` gained an optional `isNew` predicate + `newCount`, sorting new rows to the top of their
severity, so the rules stay ignorant of what anyone has read.

**Decided here:** "quiet when nothing is new" reads as *muted*, not absent — the badge shows the new count in
the warning color, then drops to a grey total once seen, and disappears only at zero. A still badge means
"nothing changed since you looked". Row-level dismissal (matching Fix All) with a folded "n dismissed"
section and per-row Restore, since a one-way dismissal is a trap. Closing the Bench marks its list seen.

**Not done:** the row's New marker is binary, not "2 of 14 new" — a row is the unit the author acts on, and
per-item seen-marking doesn't exist to make the finer count answerable.
