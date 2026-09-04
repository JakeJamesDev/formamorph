# Spec: Summary-rule accuracy and Simple-mode awareness in the Test Bench

Status: ready-for-human

## Problem Statement

Authors are getting Test Bench findings that read as wrong or meaningless:

- Entities and locations that already have an AI summary are flagged by the Bench, and the wording
  reads as an accusation of a defect rather than information — "something is up with the AI-Summary
  interpretation" from the author's chair.
- The Bench badge lights up for an author working in Simple mode, and the findings talk about "AI
  summaries", aliases, placeholders, and other fields Simple mode never shows. The author has no idea
  what a summary is, cannot see the field, and cannot act on the finding.
- Two info rules pincer: a long AI description with no summary raises one finding, and adding the
  recommended summary raises a different permanent finding (`ai-summary-hides-description`). Correct,
  recommended authoring produces an unresolvable row that can only be dismissed.
- `entity-missing-description` claims "the prompt carries only its name" for an entity that has an
  authored AI summary — which is false: every summary-preferring prompt (planner, choices, and even
  narration's reachable roster) serves that summary.

## Solution

Make the summary-related rules tell the truth, stop the pincer, and give the Bench a Simple-mode
policy: rules that require Advanced-only fields declare it, Simple mode excludes them from the badge
and the list, and a folded "N findings need Advanced mode" row keeps them discoverable — mirroring
the existing dismissed-findings fold.

## User Stories

1. As a new author in Simple mode, I want the Bench badge to count only findings I can act on, so that the badge is a to-do list rather than a mystery.
2. As a new author in Simple mode, I want findings about hidden fields folded behind a "need Advanced mode" row, so that I learn my world has more to look at without being lectured about fields I can't see.
3. As a new author in Simple mode, I want the folded row to tell me switching to Advanced is the way in, so that I know what to do about it.
4. As an author of a downloaded world, I want the Simple-mode fold to still count Advanced-only problems, so that a world with hidden defects never silently reads as clean.
5. As an advanced author, I want the full findings list unchanged in Advanced mode, so that the mode switch never hides work from someone who asked for all of it.
6. As an author who added an AI summary to a long description, I want no finding raised for doing so, so that following the Bench's own advice never creates a new row.
7. As an author who put an AI summary on a *short* description, I want an info finding saying the summary hides the description from most prompts for little savings, so that I can decide whether the summary is worth it.
8. As an author whose entity has an AI summary but no AI description, I want the missing-description finding to say the narrator's here-roster gets a bare name while other prompts serve the summary, so that the message matches what the game actually does.
9. As an author whose entity has neither description, I want the finding to keep saying the prompt carries only its name, so that a genuinely bare entity is still called out plainly.
10. As an author of a location with a long AI description and no summary, I want the same cost warning entities get, so that locations don't silently cost tokens every turn.
11. As an author using placeholder chips in descriptions, I want token estimates measured on resolved text, so that chip syntax doesn't inflate the count past the long-description threshold.
12. As an author in Simple mode, I want quick fixes for Advanced-only findings kept behind the fold, so that one click can't rewrite a field I've never seen.
13. As an author who saw a finding in Simple mode's fold but never expanded it, I want it still marked "new" when I switch to Advanced, so that the New marker means "you haven't seen this", not "the Bench displayed it somewhere once".
14. As a mobile author using the Bench sheet, I want the fold and badge behavior identical to desktop, so that the two layouts never disagree about what's wrong.
15. As a rule author adding a future rule, I want the build to force an explicit Simple/Advanced classification, so that a new rule can never leak an Advanced concept into Simple mode by omission.
16. As an author reading the Issues list in Advanced mode, I want no visual change from this work, so that the Simple-mode policy costs Advanced nothing.

## Implementation Decisions

- **Rule metadata, pure filter (the settled seam).** Rule heads gain an `advanced` marker alongside
  the existing `matching` marker. `runRules` stays mode-ignorant and pure — filtering happens in the
  hook/grouping layer where seen-state already partitions findings, driven by the editor mode the
  World Editor already owns. The `stat-code-execution` head (the check-less on-demand row) carries
  the marker too, so classification covers every row the Issues list can show.
- **Classification principle:** a rule is Advanced-scoped when *acting on it* requires a field or
  tab Simple mode hides (per the Simple-mode hidden-surface doc). Under that principle:
  - Advanced: the alias-hygiene rules (`alias-leading-article`, `alias-self-duplicate`,
    `alias-lowercase-no-twin`), all placeholder/chip rules (`chip-unknown-placeholder`,
    `chip-never-scanned`, `placeholder-unused`, `placeholder-unique-pool-too-small`,
    `placeholder-weight-unknown-value`, `wildcard-single-value`, `entity-name-in-wildcard-pool`),
    the stat-code and descriptor rules (`stat-code-unknown-stat`, `stat-code-never-ticks`,
    `stat-code-overrides-trait`, `stat-code-execution`, `stat-start-no-descriptor`,
    `stat-descriptor-duplicate-threshold`, `stat-ai-lock-frozen`, `stat-trait-delta-clamped`),
    the Advanced-only dictionary options (`dictionary-regex-invalid`,
    `dictionary-secondary-without-primary`, `dictionary-disabled`), trait wiring
    (`trait-pin-invalid`, `trait-toggle-missing-stat`), and the two summary rules.
  - Simple-visible: everything else, including `entity-match-collision` (name-vs-name collisions
    are Simple-fixable; rule-level granularity accepts that some alias-caused instances surface in
    Simple) and `legacy-start-location` (its field is invisible in both modes; the fix is one click).
  - Edge calls like these two are recorded here so the implementer doesn't re-litigate them.
- **Simple-mode presentation: folded note.** Advanced-scoped findings are excluded from the badge
  count, the new-count, and the visible list in Simple mode. A folded row — same pattern as the
  dismissed-findings fold — reads "N findings need Advanced mode" with a hint that the mode switch
  in the editor header is the way in. The fold does not expand into actionable rows in Simple; no
  Fix or Open affordance is reachable from it.
- **Seen-state marks only displayed findings.** Closing the Bench in Simple mode marks the shown
  list seen; folded Advanced findings keep their newness until seen in Advanced mode. Dismissals
  are untouched (identity-keyed, mode-ignorant, as shipped in the seen-state ticket).
- **`ai-summary-hides-description` is narrowed, not deleted.** It fires only when the AI
  description is at or under the long-description token threshold — i.e. when the summary hides a
  short description for negligible savings. Message reworded to state that trade
  ("~N-token description; the summary hides it from most prompts for little savings"). With the
  sibling rule firing only on long descriptions with no summary, the two rules can no longer both
  apply to any authoring state — the pincer is structurally gone. It continues to cover both
  entities and locations.
- **`entity-missing-description` becomes summary-aware.** It still fires when the AI description is
  absent (the narrator's here-roster genuinely gets a bare name — the delivery asymmetry is real and
  out of scope here), but the message branches: with an authored AI summary, it says the narrator's
  here-roster carries only the name while summary-preferring prompts serve the summary; with
  neither, it keeps the plain "the prompt carries only its name". Severity stays info.
- **`entity-long-description-no-summary` gains location coverage.** Locations share the same
  summary field and per-turn cost; the rule checks both slices. Its id stays (rename would orphan
  stored seen/dismissed identities); the summary/message wording generalizes from "entities" to
  items, matching how the narrowed sibling already speaks.
- **Token estimates measure resolved text.** Both summary rules estimate over
  placeholder-resolved text (the same resolution AI Context applies before estimating), so chip
  syntax can't push an item over the threshold.
- **Both rules share one threshold constant** — the existing long-description token bound — so
  "long" and "short" can never drift apart and reopen the pincer.
- **No export-shape impact.** All state stays Bench-local, per the Bench's standing design
  decision. The `advanced` marker lives on rule heads in code, not in any stored record.

## Testing Decisions

- Test external behavior at the existing pure seams — `runRules` in, findings out; grouped rows
  in, filtered rows out. No test reads component internals or rule-object shapes beyond the
  public head.
- Rule behavior and message wording: the rules suite, following its existing per-rule
  describe-block pattern (fire/not-fire matrices, message substrings). New cases: summary-present
  vs summary-absent messages, the narrowed short-description trigger, location coverage, resolved
  vs raw chip text on both sides of the threshold, and a case proving no authoring state raises
  both summary rules at once.
- Simple-mode filtering: the grouping/seen-state suites, which already test pure partitioning
  (new/seen/dismissed) — the Advanced partition is one more predicate through the same door.
- Badge counts and the fold: the findings-hook suite (prior art: the seen-state ticket's badge
  tests) for count/newCount excluding Advanced findings in Simple; the Bench component test for
  the folded row rendering and its absence in Advanced mode.
- A registry-style exhaustiveness test — prior art: the fix-fixture registry test — asserts every
  rule head (including the check-less execution head) has an explicit Simple/Advanced
  classification entry, so a future rule fails the build until its author decides.
- Seen-state: a test proving a finding folded in Simple mode is still "new" when first shown in
  Advanced mode.

## Out of Scope

- **The delivery asymmetry itself**: full-preferring prompt blocks serve nothing for a
  summary-only item (no full→summary fallback). Changing that is a gameplay/prompt behavior change
  requiring probe evidence per the prompt-writing guide, and a separate product decision.
- Any change to prompt text, the AI Context instrument's delivery labels (they truthfully render
  the asymmetry), or the mode switch itself.
- Per-finding (rather than rule-level) Simple/Advanced classification.
- Migrating or renaming stored seen/dismissed identities.

## Further Notes

- The working tree currently carries uncommitted wording edits to `entity-missing-description`
  (message + test) from a parallel session. The implementer should reconcile against whatever that
  session lands — the summary-aware branching here supersedes both the old "narrator improvises"
  and the interim "the prompt carries only its name" wording for the summary-present case.
- The Bench memory file records the standing decisions this spec must not undo (one rule seam,
  badge counts grouped rows, seen-state merge semantics); nothing here conflicts with them, and the
  folded note deliberately reuses the dismissed-fold interaction language.
