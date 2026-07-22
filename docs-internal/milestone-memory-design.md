# Milestone Memory — design spec

**Status:** Phase 2 **shipped** (2026-07-21). Selector prompt is `fewshot` — the worked commitment→resolution example fixed the inversion that six instruction-wording attacks could not (cloud 0.88→0.94 must-recall, Cydonia drop-keep 0.58→0.17; both models pass the ≥0.90 gate). Digest-side anchoring was falsified first (anchored and state-voice fixture variants: null and worse, respectively; list-order reversal also null). End-to-end re-validated with fewshot (arm M ≈ bare history in-batch at ~¼ flat context; carry-forward clean modulo soft-fact judge noise). App integration: `milestoneSelect` silent request (temp 0), drop-set filtering in `buildBandedHistory` for narration and planner, Memory side-panel tab with pins persisted in the save envelope (`memoryPins`, additive), `memoryDigests` default flipped to on (reaches fresh installs only — the persistence hook writes the default on first run, so explicit-off is indistinguishable from never-touched in existing stores).

## The problem this solves

Two measured findings from the dialogue-collapse investigation (2026-07-21) point the same direction:

- **The quiet register rides in verbatim history mass.** A 3-turn-only window (arm W) matched full history on dialogue level and was the only condition that ever *recovered* mid-run — long verbatim history makes the silent register sticky.
- **History can't just be cut.** Zero history means turn-to-turn hallucination; the model needs the plot. Per-turn digests (arm E) carry facts with far less register-carrying mass, and with the present-tense voice fix they damp echo and drain the re-ask attractor.

So the target is: **the smallest history that still carries the plot.** Per-turn summaries accumulate forever, though — 60 turns = 60 digest pairs, and most record noise ("you walk the bridge road toward Teldoril") that stops mattering within a few turns. Milestone memory compacts the old band by *dropping* those.

## Core design decisions

### 1. Selection, never rewriting

The AI never writes the compact memory. Every turn it reads the list of old per-turn summaries and outputs **which ones to keep** (indices). Code assembles the surviving list verbatim.

- No compounding rewrite: a rolling "fold turn N into the blob" chronicle stacks lossy rewrites — one hallucinated fold poisons everything after it, with no ground truth left. Selection can't corrupt text.
- Mechanically verifiable: the output is a list of numbers; a malformed reply falls back to keep-everything (fail-safe, never fail-drop).
- A bad selection is a bad *filter*, instantly fixable by a better prompt — retroactively, because of decision 2.

### 2. Per-turn summaries stay the immutable source of truth

Summaries are already stored per turn (save envelope, unchanged). The milestone list is a **derived view**, recomputed from scratch each turn over the full summary list — never an evolving mutable state.

- No export-shape change (the view lives in runtime state only).
- A dropped item is not deleted — it re-qualifies whenever a later selection pass (or the rehydration layer, when re-enabled) finds it relevant. This answers "the $5 might be the plot token later": hindsight relevance is recoverable because nothing is destroyed.
- Idempotent and re-derivable: an improved selector prompt upgrades old saves' memory for free.

### 3. Milestones ride as their original condensed pairs

Selection decides *which* banded pairs survive; it never restructures them. The context shape stays exactly the proven arm-E form — user action + present-tense digest reply, chronological — just with the noise pairs gone. (The Sukino single-block lesson: restructuring history into one quoted blob backfired badly; purely subtractive is the safe evolution.)

### 4. Three bands, recency-graded

| Band | Content | Width |
|---|---|---|
| **Floor** | Full verbatim turns | last 3 (existing `narrationVerbatimTurns`) |
| **Recent band** | Per-turn digests, **unfiltered** | `MILESTONE_RECENT_BAND` — **0 as shipped** (user call, 2026-07-21) |
| **Milestone band** | Per-turn digests, **selected only** | everything older |

The middle band was hypothesized to protect scene-level continuity ("she just agreed to guide you" is no milestone but load-bearing for a few turns). Shipped at 0 per the user's directive — and then **proved right in a 50-turn paired cloud batch** (M0 vs M6, 6 runs each, 2026-07-21): M6 decayed to 0% last-8 dialogue in all six runs (every run silent by ~turn 42), while M0 held 10% last-8 with two steady runs and the only late-session recoveries. Six permanently-unfiltered digests are enough recent-history mass to make the quiet register sticky (the arm-W lesson again). The `--recent` harness knob and per-arm `M<width>` tokens remain for future width tests.

**Floor sweep (paired 50-turn batches ×6, 2026-07-21): the peak is 4.** F2 45 < F3 84 (same batch); next batch F3 49 < F4 73; next batch F4 79 ≥ F5 76 with F4 holding the tail twice as well (last8 15% vs 8%, slope −0.49 vs −0.68) at less context. Digests carry no quoted speech, so the verbatim floor is the model's only dialogue-formatting exemplar — too few turns starve imitation, and past 4 the extra mass only feeds the quiet register. Shipped: `narrationVerbatimTurns` default 4 (explicit user values untouched), recent band 0. Cross-batch totals are not comparable (cloud mood drift ±2×) — only in-batch pairings count. (Arm tokens support recent + floor suffixes, e.g. `M0F4`.)

### 5. Selection runs every turn (for now)

Highest-cost, highest-fidelity variant first: one extra temp-0 call per turn (input = numbered summary list, output = indices). If it doesn't work at this cost, cheaper variants (recompact on band overflow only) can't work either; if it does, cost reduction is a follow-up experiment.

## Selector prompt — draft contract

System (sketch; final wording iterates against the fixture probe):

> You are the memory keeper of an interactive story. You are given the story's remembered moments as a numbered list, oldest first. Keep the entries a player returning after a month would still need: what was gained or lost, promises made, quests taken or finished, characters met who matter, doors opened that stay open, wounds and debts that persist. An entry that only records passing movement, small talk, or a moment already superseded by a later entry has served its purpose - let it go. When unsure whether something still matters, keep it.
>
> Reply with only the numbers to keep, comma-separated.

Notes per the prompt-writing guide: positive contract, shape shown, no parrotable example values, keep-when-unsure bias stated once. The two error types cost differently — dropping a real milestone is expensive, keeping noise is cheap — so the bias sentence stays.

Voice guard: kept entries are the existing present-tense digests untouched, so the 2026-07-21 tense lesson (past-tense history teaches past tense) is satisfied by construction.

## Phase 1 — prove it in the harness (no app changes)

1. **Selection-quality probe** (new, `milestone-select-probe.mjs`):
   - Fixture: ~50 hand-labeled summaries (milestone / noise / superseded) drawn from real saved chains (`dialogue-hold-*`, `format-E-*` runs) plus Sedge baselines. Labels are ours, committed with the fixture.
   - Metrics, scored separately: **milestone recall** (target ≥ 0.9 — the expensive error) and noise-keep rate (informational — cheap error, expected nonzero given the keep bias). Both test models.
   - Iterate the selector prompt against these numbers before anything touches a chain.
2. **End-to-end arm** (`dialogue-hold-probe.mjs` arm `M`): floor 3 + recent band 6 unfiltered + selected milestones, selection re-run each turn.
   - Gates: the strict dialogue-hold metric (does compaction help the hold?), context-size curve vs arms B/E (the point is that M's history stops growing), and fact carry-forward (`--factmode carryforward` method) to prove dropped noise wasn't load-bearing.
   - 25-turn corpus first; if promising, a longer (~40-turn) corpus is the real payoff test — milestone memory should make turn 40 behave like turn 10.

## Phase 2 — app integration (only after Phase 1 passes)

- New silent request type `milestoneSelect`, sampler pin `temperature: 0`, fired post-narration alongside the existing summary request; failure → keep-everything fallback.
- `buildBandedHistory` gains the recent/milestone split; selected-set lives in GameplayContext runtime state (recomputed, not persisted — **no export-shape change**; if we later decide to persist the selection, that's an explicit shape decision).
- Settings: milestone memory rides the existing `memoryDigests` toggle (it is a refinement of banding, not a new mode); `RECENT_BAND` width starts as a constant, promoted to a setting only if tuning proves worth exposing.
- AI-context debug view: the selection call and its kept/dropped lists must appear like any other request, so bad filtering is visible in the field.

## Open questions

- Does the selector need the *current scene* as context ("what matters now") or is timeless selection enough? Timeless is simpler and re-derivable; scene-aware selection overlaps with the rehydration layer's job. Start timeless.
- Superseded-entry handling ("you agree to help her" → later "the task is done"): the draft prompt asks for it; the fixture must include such chains to measure whether small models can actually do it.
- Long-horizon corpus authoring (40 turns with plantable milestone facts and later recall probes) — needed for the real payoff claim.
