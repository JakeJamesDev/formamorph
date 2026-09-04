# Test Bench Review Fixes

Status: done

Follow-up to the Test Bench feature (`.scratch/test-bench/`), closing every finding from the
2026-08-17 two-axis review of `cac7be5...HEAD`. Governing ADR:
`docs/adr/0005-test-bench-shows-computation-never-model-judgment.md` — every addition here is
deterministic computation; nothing calls a model.

## Problem Statement

An author who runs the Test Bench today gets a World Doctor that is silent about a whole band of
authoring mistakes the master spec promised to catch — including one Error-tier defect (a location
whose parent reference points at nothing) that can ship in an exported world unnoticed. The Bench
also forgets which Instrument the author was using whenever the editor unmounts, even though the
lens survives. Meanwhile the code the next contributor inherits carries review debt: three
hand-rolled copies of the same browser-storage shape, a two-file copy-pasted test harness, a
35-prop component, a 210-line orchestration block in the editor view, and a handful of documented
convention breaches (British spellings, uncommented escape-hatch casts).

## Solution

Finish the World Doctor's rule catalog — every Appendix A rule from the original spec that never
landed, plus the three reference-integrity checks ticket 02 explicitly deferred — through the same
pure rule registry, with quick fixes only where a repair can remove exactly its finding. Persist
the open Bench tab per world in session storage, matching the lens's lifetime. Pay down the
structural debt behind one new seam (a shared keyed-record storage helper) plus a pure extraction
of the Bench orchestration into a single hook, and sweep the convention breaches.

## User Stories

1. As a world author, I want the World Doctor to flag a location whose parent reference points at a location that no longer exists, so that my world's containment tree is never silently broken.
2. As a world author, I want the World Doctor to flag a Connection whose endpoint references a missing location, so that authored travel links never dangle.
3. As a world author, I want the World Doctor to flag a stat update that names a stat that doesn't exist, so that renamed stats don't silently detach their update prompts.
4. As a world author, I want to be told when two entities' aliases collide once lowercased, so that activation doesn't fire on the wrong entity.
5. As a world author, I want to be told when an entity's name doubles as a Wildcard pool value, so that a placeholder roll can't impersonate an entity.
6. As a world author, I want to be told when an entity has no player or AI description, so that the narrator isn't improvising from a bare name.
7. As a world author, I want to be told when an entity's AI description is long but has no summary, so that I know the whole text enters the prompt every time.
8. As a world author, I want to be told when a location contains no entities, so that I can decide whether an empty room is intentional.
9. As a world author, I want to be told when an exclusive trait group has two or more defaults, so that a fresh game can't start with contradictory traits.
10. As a world author, I want to be told when a trait group holds fewer than two traits, so that a choice that isn't a choice is visible.
11. As a world author, I want to be told when unique placeholder chips share a pool too small to stay unique, so that rolls can't collide at play time.
12. As a world author, I want to be told when placeholder weights name a value the pool doesn't contain, so that my weighting actually applies.
13. As a world author, I want to be told when a Wildcard has only one value, so that I know it will never vary.
14. As a world author, I want to be told when a dictionary keyword is a substring with whole-word matching off, so that I can predict accidental activations.
15. As a world author, I want to be told when a dictionary entry or book is disabled, so that "why didn't this fire" has a visible answer.
16. As a world author, I want to be told when my world has an empty system prompt, no readme, or oversized images, so that I fix them before sharing the world.
17. As a world author, I want a one-click fix on any new rule where the repair is unambiguous, so that I spend clicks only on judgment calls.
18. As a world author, I want the Bench to reopen on the Instrument I was last using for this world, so that an edit-check-edit loop doesn't reset to the first tab.
19. As a world author on mobile, I want that remembered tab to survive the Sheet closing and reopening, so that small screens don't pay a navigation tax.
20. As a world author, I want new rules to respect my existing dismissals and seen-state mechanics, so that finishing the catalog doesn't spam a wall of loud badges on worlds I've already triaged.
21. As a returning author, I want newly added rule findings to appear as "new" exactly once and then go quiet, so that the badge stays trustworthy.
22. As a maintainer, I want one storage helper behind the lens, seen-state, download-note, and tab records, so that a storage bug is fixed in one place.
23. As a maintainer, I want the Bench orchestration in one hook instead of inline in the editor view, so that the view stops changing for Bench reasons.
24. As a maintainer, I want the Bench component's props bundled per Instrument, so that adding an Instrument doesn't grow a 35-prop signature.
25. As a maintainer, I want the two World Editor Bench test files to share one harness, so that the fixture and its lint exceptions exist once.
26. As a maintainer, I want every rule to build findings through the shared helper, so that no rule hand-copies its identity trio.
27. As a maintainer, I want the codebase's American-English rule upheld and every escape-hatch cast to carry its justification, so that conventions stay enforceable by example.

## Implementation Decisions

- **New rules go through the existing rule registry** — the pure `runRules(world) → Finding[]`
  seam. Each rule is the established `{ id, severity, section, check, summary, fix? }` shape;
  severities match Appendix A of the original Test Bench spec exactly (the location
  parent-reference orphan is the one Error). The catalog to implement is: every Appendix A rule
  absent from the registry today, plus ticket 02's three deferred reference checks (location parent
  orphans, Connection endpoint orphans, stat-update stat-name references). Appendix A of
  `.scratch/test-bench/spec.md` is the source of truth for wording and severity; do not
  re-derive rules from this list's shorthand.
- **All comparisons reuse the established primitives**: name/alias matching through the shared
  match key (case-fold + singularize), placeholder text through the placeholder describer, keyword
  semantics mirroring the dictionary matcher's own flags. A rule must never disagree with play
  (ADR-0005; the Activation Tester keeps running a filtered subset of the same registry).
- **Fixes stay rule-level and re-derive targets from the world they're handed.** Add a fix only
  where it removes exactly its finding and raises no new one; where a repair would require judgment
  (e.g. which duplicate default trait to keep), ship the rule report-only. Every added fix gets a
  round-trip fixture entry — the existing registry test already fails on a fix without one.
- **New seam: a keyed-record browser-storage helper** — parse-guarded read of one keyed record,
  try-swallow write, parameterized by backing storage (local or session) and storage key. The lens
  store, seen-state record, and download note migrate onto it with their storage keys and record
  shapes byte-identical (no data migration, existing author state survives). This is the only new
  module seam.
- **Open-tab persistence is session-scoped, keyed by world id**, riding the new helper — same
  lifetime rationale as the lens (a test setup is worth surviving a tab switch, not next week).
  On Bench open the stored tab wins if it names a built, routable Instrument; otherwise fall back
  to the current default. The dev-router `bench=` slot continues to override everything.
- **`useTestBench` is a behavior-preserving extraction**: the Bench orchestration state currently
  inline in the World Editor view moves into one hook; the view keeps only wiring. No logic
  changes ride along.
- **The Bench component's props collapse into per-Instrument bundles** (the trigger, lens, and
  opening groups already travel together). Pure mechanical regrouping.
- **Convention sweep**: the first three rules adopt the shared finding-builder helper the later
  rules already use; new "grey" spellings become "gray" (changelog prose and test names; older
  pre-Bench changelog entries stay untouched); the two uncommented `as unknown as` casts gain
  their one-line justification; the two World Editor Bench test files extract a shared harness so
  the fixture, mount-once pattern, and its lint exception exist once.
- **Zero export-shape impact.** All state remains Bench-local browser storage; the authored world
  shape and save envelope are untouched.

## Testing Decisions

- Tests assert external behavior at the seams, never implementation details: a rule is tested by
  handing `runRules` a world that contains the defect and one that doesn't, asserting the finding's
  presence, severity, section, and named items — never by calling the check internals.
- Every new fix round-trips through the existing fix-fixture table: fix applied → finding gone →
  no new finding raised → fixing twice equals fixing once. The registry test that fails on a
  fixture-less fix is the enforcement; no new mechanism needed.
- Malformed-world tolerance carries over: new rules get the same null/missing-collection guard
  cases the existing rules gained in the hardening pass.
- The storage helper gets its own small unit tests (corrupt JSON, missing record, write failure
  swallowed); the three migrated stores' existing tests run unchanged — that is the proof the
  refactor preserved behavior, so those tests must not be edited in the same change.
- Tab persistence is tested at the Bench component level: open an Instrument, unmount, remount,
  assert the same Instrument is showing; plus the fallback when the stored tab names an unbuilt
  Instrument. Prior art: the existing Bench component tests and the lens-hook tests.
- The `useTestBench` extraction and prop bundling ship with zero test edits — the existing World
  Editor and Bench component suites passing unchanged is the acceptance proof.
- Time the suite and report the number; a duration jump against the per-test sum is a finding,
  not noise.

## Out of Scope

- Anything that previews, simulates, or estimates model behavior (ADR-0005).
- Rules beyond Appendix A plus ticket 02's three deferrals — no invented checks.
- Per-item seen-marking, cross-row fix-all, or any change to the dismissal model.
- Revisiting settled Bench decisions: the lens's session-storage lifetime, the PC-as-exclusive-trait
  definition, badge-counts-rows, no-per-row-Open-button.
- Pre-existing "grey" spellings in changelog entries older than the Bench work.
- The interleaved non-Bench commits from the review range (location backdrop, per-world custom
  prompts, editor-search guards) — reviewed clean, nothing to do.
- Migrating any storage record's key or shape.

## Further Notes

- Source review: the two-axis code review of `cac7be5...HEAD` (Standards: 3 hard violations,
  5 smells; Spec: 2 gaps). This spec is the complete remediation; when it lands, every Appendix A
  rule has a registry entry and the review is closed. Two pre-existing rules still cover only half
  their appendix row and stay out of scope here: `stat-start-no-descriptor` skips the
  "active-at-start descriptor contradicts it" clause, and `stat-descriptor-duplicate-threshold`
  skips "unordered thresholds" (moot in play — the band sort is stable).
- Sequencing suggestion: storage helper → tab persistence → convention sweep → `useTestBench` +
  prop bundles → rule catalog (largest last, so the refactored ground is stable under it).
- The rule catalog will roughly double the registry; watch the World Doctor's "N rules checked"
  line — it self-updates from the registry, and the number appearing there is the cheap smoke
  test that registration worked.

**Implementation notes (2026-08-17):** landed as four commits (`6340c3a`, `3c34449`, `8ce9bd8`,
`690c35e`). Registry 25 → 44 rules. The storage helper is `lib/keyedStorage` (read-guarded JSON +
keyed-record store); the tab record is `FORMAMORPH_benchTab` via `useBenchTab`, seeded on open; the dev-router's
`bench=` slot wins exactly one seed via `routeTab` and is never recorded, so it overrides the view
without clobbering the remembered tab. The
`useTestBench` hook reads GameDataContext itself; the view passes only selection/mobile/route/navigate
wiring. Prop bundles: chrome + `onFixRule` top-level, `issues`/`lens`/`triggers`/`aiContext`/`opening`
per Instrument — the component test builds the bundle shape directly with per-bundle overrides,
every assertion unchanged. "Wildcard with a single value" maps to weights benching all but one value (type
inference makes a literal single-value def a Variable); the oversized-image rule checks byte budgets
only (pixel measure needs an async decode), a strict subset of the Optimize Images scan. Bench-suite
fixtures gained descriptions/readme/prompt/resident so clean-world assertions stay meaningful under
the doubled registry. Tab persistence is tested at the hook seam (`useBenchTab.test.ts`:
unmount/remount + unbuilt-tab fallback), not the Bench component — the component takes `tab` as a
controlled prop, so a component-level test could not show persistence. Post-review: the prop-bundle
types moved to `lib/testBench/benchProps` and `benchTabs` into `lib/testBench`, so the lib layer no
longer imports from components.
