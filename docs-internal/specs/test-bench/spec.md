# Test Bench — Spec

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

The merged, authoritative spec for the Test Bench. It absorbs and retires the former
`docs-internal/world-doctor-spec.md` and `docs-internal/activation-tester-spec.md`.
Companion reading: `docs-internal/world-authoring-feature-notes.md` (motivating evidence),
ADR-0005 (the scope boundary).

---

## Problem Statement

A world can be wrong — and overwhelming — in ways the editor renders as perfectly fine.

Authors write matching rules (aliases, dictionary keywords), navigation structure, stat code, and
placeholders with **no evidence of what the harness does with any of it**. The first feedback
arrives mid-playthrough, as an absence: lore that didn't inject, a character the AI forgot, a
destination that was never offered, a trait bonus a clamp silently swallowed. Rebuilding Centaur
Breeder produced a world twice believed finished; two throwaway Node sweeps then found five classes
of real defect (leading-article aliases, cross-entity alias collisions, an entity in no location, a
descriptor/starting-value mismatch, a dead legacy field). Every one was mechanical. An author has no
equivalent of those sweeps — the honest current answer is "start a game and see."

As features grow (placeholders, connections, semantic memory, milestone memory), each adds authoring
surface that is invisible at author time. Authors also cannot see what a turn *costs*: nothing
reports that a world sends ~3k tokens of context to a small model every turn.

## Solution

The **Test Bench**: one surface in the World Editor where an author tests and understands how their
world is used by the harness at runtime. It shows **what the harness computes and what the model is
shown — never what the model will do with it** (ADR-0005).

Four instruments as tabs:

| Tab | Instrument | The author's question |
|---|---|---|
| **Issues** | World Doctor | "What's broken or probably wrong?" |
| **Triggers** | Activation Tester | "What does this text make fire — and why didn't that entry?" |
| **AI Context** | Location inspector | "What is the AI told from this place, and what does it cost?" |
| **Opening** | Start inspector | "What does a fresh game as this PC actually look like?" |

Entered from a persistent header button carrying the Issues count badge. A shared **lens bar**
(`Testing as [PC] · at [location]`) feeds every instrument. Desktop: a third resizable panel beside
the editor's list/detail split. Mobile: a full-height sheet.

## User Stories

1. As an author, I want a count badge to appear in the editor header the moment I create a structural problem, so that I learn about breakage while the edit is still fresh.
2. As an author, I want the badge to distinguish new findings from ones I've already seen, so that a still badge means something and I can trust it enough to ignore.
3. As an author, I want findings grouped by severity (error / warning / info), so that I see the broken things first, wherever they live in the world.
4. As an author, I want every finding to navigate to the owning tab with the item selected, so that fixing it is one click away.
5. As an author, I want same-rule findings collapsed into one row naming the affected items, so that fourteen bad aliases read as one problem, not fourteen.
6. As an author, I want one-click fixes where the repair is unambiguous, so that mechanical repairs don't require hand-editing each item.
7. As an author, I want to dismiss a finding I disagree with, per world, so that deliberate choices stop nagging me — without my suppressions shipping to players.
8. As an author, I want a clean world to say "no problems found" with the count of rules checked, so that silence reads as verified rather than broken.
9. As an author editing a downloaded world, I want the same findings its original author would get, so that a downloaded world is a real starting point and a teaching surface.
10. As an author, I want to paste prose into Triggers and immediately see which entities are detected as present, so that I know which words put an entity into the side panel during play.
11. As an author, I want each detected entity to show the exact alias and text span that matched, so that I understand *why* it was detected.
12. As an author, I want each dictionary entry to show fired-or-not with its evidence — the keyword, the matched text, the region — so that my matching rules stop being guesswork.
13. As an author, I want non-activations explained with their near-miss reason (secondary excluded it, beyond scan depth, whole-word blocked a substring match, entry or book disabled), so that inverted and conditional logic is authorable.
14. As an author, I want inline warnings in Triggers (leading-article alias, same-span collision, can-never-fire entry) with the same one-click fixes as Issues, so that matching problems surface where I'm already thinking about matching.
15. As an author with the semantic index built, I want an explicit semantic toggle showing each entry's similarity score against the threshold, so that I can see what semantic activation would add — and it is never quietly on.
16. As an author, I want to pick a location in the lens bar and see AI Context: every context block the harness would serve from there, so that I can audit what the AI actually knows at each place.
17. As an author, I want AI Context to list the location's navigable destinations with their travel hints, so that I can verify where a player can actually go — and see that anything not listed can never be traveled to.
18. As an author, I want AI Context to show which entities the AI is told about at each scope (here, sub-locations, reachable) and whether each arrives as full description or summary, so that summary-hiding surprises stop happening.
19. As an author, I want a ~token estimate per context block and a per-turn total for the current location, so that I can keep my world inside a small model's budget.
20. As an author, I want Opening to show every stat at its starting value with its active descriptor, so that a mismatch like "starts at 1" vs "none yet" is visible before play.
21. As an author, I want to scrub a stat's value with a slider and watch the active descriptor change, so that I can check descriptor coverage across the whole range, not just the start.
22. As an author, I want Opening to reflect the lens PC — pinned placeholders resolved, stat toggles applied, default traits active — so that per-PC wiring is a glance instead of a playthrough.
23. As an author, I want to see placeholder rolls with each value's real probability (and reroll them), so that weights and "unique" collisions are inspectable.
24. As an author, I want an expandable view of the assembled first prompt, so that I can read exactly what the model receives on turn one.
25. As a mobile author, I want the Bench as a full-height sheet whose Open actions land on the normal editor navigation, so that the feature works where I actually edit.
26. As a Simple-mode author, I want the full Bench available, so that the authors most likely to be surprised aren't the ones locked out.
27. As an author who re-downloads an updated world, I want seen-state cleared when the source actually changed, so that stale "seen" marks can't hide defects an update introduced.
28. As an author, I want my test setup (lens selections, open tab, Triggers text) to survive tab switches within a session, so that edit-and-watch is a loop, not a ritual.

## Implementation Decisions

### Surface (prototype-confirmed: variant A, "Stacked")

- **Entry**: a persistent header icon button in the World Editor; the Issues count renders as a
  badge on it (new counts prominent, known counts muted, quiet when clean). Icon-sized, never text —
  conditional header content must not reflow the row.
- **Desktop**: a third resizable panel appended to the editor's existing panel split; closable.
- **Mobile**: a full-height sheet. A finding's Open closes the sheet and sets the editor's active
  tab + selected item — the existing mobile navigation path.
- **Bench layout** (from the layout prototype, variant A): bench header row → lens bar row
  (`Testing as [PC] · at [location]`) → horizontal 4-tab strip (Issues tab carries its count) →
  instrument content. The losing variants (icon rail, unified row) are on the prototype branch.
- **Lens bar**: bench-level state shared by all instruments; seeds from the editor's selected
  location (else the starting location) on open, then holds its own state. The PC selector lists the
  traits of any exclusive group; it resolves placeholder pins and shows stat toggles.
- **Both editor modes**; rules about advanced-only features fire only when the world uses them.
- Bench-local state (open tab, lens, dismissals, seen-state) is stored locally keyed by world id —
  **never in the world**; the feature has zero export-shape impact.

### The rule engine (the primary new seam)

- One pure module: `runRules(world) → Finding[]`; a rule is
  `{ id, severity, section, check(world) → Finding[], fix?(world) → World }`.
- Surfaced twice: Issues runs the full set; Triggers runs the matching-related subset inline. One
  implementation so the two surfaces can never drift.
- Quick fixes live on the rule, are individually applied (no "fix everything"), mark the world
  dirty like any hand edit, and exist only where the repair is unambiguous.
- Finding identity is `ruleId` + the item ids it names; the seen-set and dismissals key on it.
  Editing an item re-raises its finding; a source update (changed `sourceUpdatedAt`) clears the
  world's seen-set.
- Static checks (references, syntax) run live, debounced on world change. Stat-code *execution*
  sits behind an on-demand action — each run spins a real sandbox VM and the badge must stay
  instant.
- The rules catalog with its severities and real-world evidence: **Appendix A** (carried over
  verbatim from the World Doctor spec).

### The bench view-model (the secondary new seam)

- A thin pure module assembling per-tab data from the existing builders, so AI Context and Opening
  are testable without React:
  - AI Context data for a location: each context block's rendered value + ~token estimate,
    navigable destinations with hints, entity rosters per scope with summary-vs-full flags.
  - Opening data for a PC: stats with starting values and active descriptor, descriptor lookup by
    value (drives the slider), active traits and pins, placeholder rolls with probabilities, the
    assembled first prompt, ~token total.
- Reuses — never re-implements — the game's own builders: activation explanation, entity-name
  matching, navigable-destination computation, the authored-preview assembly. The one agreed
  extension: entity matching learns to report the matched alias + span (the game's presence UI
  benefits too). A second matching path is forbidden — the tester must never disagree with play.

### Instrument details

- **Triggers**: live re-evaluation, debounced; per-entry evidence expansion; clickable highlight
  spans in the pasted text; a "rendered context" view showing the injected block as the AI receives
  it; "paste last turn" pulls narration from the world's most recent save; entries in a disabled
  book shown greyed with the reason; invalid regex flagged on the entry, not the run. Empty text
  shows constant entries with a note; "nothing fired" reports how many entries were checked.
- **Semantic**: an explicit toggle, enabled only when the embedding index exists, showing per-entry
  cosine score vs threshold. Never quietly on — it would misattribute a keyword author's results.
- **Token estimates**: a chars-based heuristic, always rendered with `~`. No tokenizer dependency —
  worlds run against arbitrary endpoints, so exact counts are impossible in principle.
- **AI Context travel caveat**, stated in the UI: the destination list is the complete, closed set
  of places the harness will ever offer; whether a given action *counts as* travel is the model's
  judgment and is out of scope (ADR-0005).

### Naming

Glossary terms (CONTEXT.md): **Test Bench**, **Instrument**, **World Doctor**, **Activation
Tester**. UI tab labels: **Issues · Triggers · AI Context · Opening** — "AI Context" deliberately
reuses the in-game dialog's established label for the same concept.

### Build order

1. Surface (button + badge, panel/sheet, lens bar) + Issues + Triggers — the two instruments with
   settled designs; rules land highest-evidence-first (alias hygiene → reference integrity →
   reachability → stat sanity → info).
2. AI Context.
3. Opening.

## Testing Decisions

- **Test external behavior at the seams**: rules are pure `check(world) → Finding[]` — feed a world
  fixture, assert findings; feed the fixed world, assert silence. Never test rule internals.
- **The regression corpus is real**: the pre-sweep Centaur Breeder states carried every motivating
  defect; each rule ships with the world snippet that motivated it.
- **Fix round-trip**: applying a rule's fix removes exactly that finding and creates no others
  (idempotence: fixing twice equals fixing once).
- **View-model tests**: location/PC in, assembled tab data out — including the summary-vs-full
  flags, destination hints, and probability math. Prior art: the existing pure-builder test files
  beside the location-context and authored-preview modules.
- **Activation evidence**: near-miss reasons asserted per failure class (secondary-exclude,
  scan-depth, whole-word, disabled) — these strings are the feature.
- **UI**: thin component tests only (badge counts render, findings navigate, tabs switch), on the
  existing panel-harness pattern; no motion or timing assertions.
- Mutation-proof per the project test bar: reinstate a representative bug per rule group and show
  the guard fails.

## Out of Scope

- **Anything that previews model behavior**: whether narration mentions X, whether an action reads
  as travel, what the planner or choice writer does, simulated turns. See ADR-0005.
- **Prose or content judgment** — no tone, spelling, or quality opinions. Every rule is structural.
- **Gating** — the Bench never blocks saving, exporting, or publishing.
- **Auto-fix on load** — existing worlds are diagnosed, never silently rewritten.
- **Saved test scenarios in the world** — export-shape-visible; if wanted later, store locally.
- **Semantic activation beyond the Triggers toggle** (no per-location semantic pulls yet).
- **A real tokenizer.**

## Further Notes

- The layout prototype (three variants in the editor, mock data) validated variant A; capture it to
  a throwaway branch per the prototype skill before implementation starts, and strip the DEV mounts
  from the editor.
- The former specs' section numbering (§ references in older docs) maps here: Doctor §4 → Appendix
  A; Doctor §9 → seen-state decisions; Tester §6 → the lens bar's PC selector.
- Dev-router coverage for the Bench (view + tab params) is required by project convention so
  verification lands in one `goto`.

---

## Appendix A — The rules catalog

Severity model: **✖ Error** — cannot work (never fires, never resolves, points at nothing).
**⚠ Warning** — works but very likely not what was meant. **ℹ Info** — completeness and
consistency; safe to ignore deliberately. "Found?" = caught a real defect in the Centaur Breeder
rebuild.

### Entities

| Sev | Rule | Found? |
|---|---|---|
| ⚠ | Alias begins with `the ` — case-sensitive matching misses at sentence start | **Yes — 14** |
| ⚠ | Two entities can match the same text (alias/name overlap incl. plural tolerance) | **Yes** |
| ⚠ | Entity appears in zero locations | **Yes** |
| ℹ | Lowercase multi-word alias with no capitalized twin | **Yes** |
| ⚠ | Entity name collides with a value in a Wildcard's pool | checked by hand |
| ℹ | Alias duplicates the entity's own name | **Yes** |
| ℹ | No player description or no AI description | **Yes** |
| ℹ | Long AI description with no AI summary | |

### Locations

| Sev | Rule | Found? |
|---|---|---|
| ✖ | Entity list references an entity id that doesn't exist | |
| ✖ | Parent reference points at a location that doesn't exist | |
| ✖ | No location is flagged as starting | **Yes** |
| ⚠ | Legacy start-location field present (dead since the TS rebuild) | **Yes** |
| ℹ | Location with no entities | **Yes — 7** |
| ℹ | Item has an AI summary, so only the narrator sees its full description | **Yes** |

### Stats

| Sev | Rule | Found? |
|---|---|---|
| ✖ | Stat code references a stat name that doesn't exist (silent break on rename) | dependency exists |
| ✖ | Stat code throws, times out, or returns a non-number (on-demand check) | |
| ✖ | Starting value outside `[min, max]` | |
| ⚠ | Stat disabled and no trait's toggles ever enable it | |
| ⚠ | No descriptor covers the starting value's band, or the active-at-start descriptor contradicts it | **Yes** |
| ⚠ | Duplicate or unordered descriptor thresholds | |
| ⚠ | Percentage stat whose min/max aren't 0/100 | |
| ⚠ | A stat has code but no stat in the world reads a clock variable (code then runs only on AI-reported turns) | **Yes** |
| ⚠ | A trait's negative starting delta lands on a stat already at its floor (clamp swallows it) | **Yes** |
| ⚠ | A trait sets a stat below a value its own code raises it back to | **Yes — 5 of 9** |
| ℹ | AI-change locks on a stat with no code | |

### Traits

| Sev | Rule |
|---|---|
| ✖ | Stat toggles reference a missing stat id |
| ✖ | Placeholder pins reference a missing placeholder, or a value not in its list |
| ⚠ | Exclusive group with two or more default traits |
| ℹ | Exclusive group containing fewer than two traits |

### Placeholders

| Sev | Rule | Found? |
|---|---|---|
| ✖ | A chip references an undefined placeholder id | |
| ✖ | A chip sits in a field the resolver never scans (stat descriptions/descriptors) | |
| ⚠ | Several Unique chips share one small-pool placeholder (independent draws repeat) | **Yes** |
| ⚠ | Weights name a value that isn't in the value list | |
| ℹ | Placeholder defined but never used | |
| ℹ | Wildcard with a single value | |

### Dictionary

| Sev | Rule |
|---|---|
| ✖ | Entry has no keywords and isn't constant — can never fire |
| ✖ | Secondary keys with no primary keywords |
| ✖ | Regex entry whose pattern doesn't compile |
| ⚠ | Keyword is a substring of another entry's keyword while whole-word matching is off |
| ℹ | Entry disabled, or its whole book disabled |

### World

| Sev | Rule |
|---|---|
| ⚠ | Empty system prompt |
| ℹ | No readme |
| ℹ | Oversized embedded images — link to the existing Optimize Images action |
