# Semantic memory — planned arc

Working roadmap for the embedding-retrieval workstream on branch **`Mem0`**. Research + decision log
lives in this doc; the shipped foundation is described below, then the planned steps in build order.
Steps ship one at a time, each behind its own probe evidence — nothing here is committed-to-all-at-once.

**▶ Resume here:** build phase done (steps 0-4 shipped 2026-07-23, unreleased, off by default), and a
real charged session (repeat.json findings below) has produced the **tuning todo** — T1 and T2 are
done, T3 tested and rejected (all 2026-07-23), T4 done 2026-07-24 (incremental verdicts, paired
protocol, save-envelope persistence), T5 done 2026-07-24 (cap default 12, gated on the 50-turn
repeated A/B — findings section below), T6 tested and rejected 2026-07-24 (browser-size rerankers
don't beat cosine on the real failure cases — see its section). **The tuning todo is complete**,
the branch merged to main 2026-07-24, and the charged-scene freeze replay PASSED (step 2 section
below). **Every validation gate is closed — whether Semantic Memory goes default-on is now purely
a product call.** Candidate follow-up work, uncommitted: the LLM-side carried-items line for
oblique possession recall (T6 verdict).

## Tuning todo (ranked, from the 2026-07-23 real-session review + literature)

Reference precedent: SillyTavern chat vectorization (the production analog — query = last 2 MESSAGES,
25% score floor, insert top-3, protect newest 5, "past events" injection template) validates our
framed injection / protected floor / top-K-with-floor shape. Divergences and fixes:

### T1. Scene-recall cooldown — DONE 2026-07-23
No re-recall of the same scene within N turns (start N=3). Kills the observed stickiness (9/27
firings identical to the previous turn's; same scene rode turns 29-31 while the context froze).
Chosen over ST's shuffle-top-K (their anti-staleness device) because sampling breaks our
paired-seed probe methodology; revisit sampling only if cooldown feels too binary.
- Cost: trivial (a per-scene last-fired turn map in GameViewer, or turnBanding arg).
- Probe: rehydrate-probe gains a consecutive-turn case; assert no repeat within N.
- Shipped: `REHYDRATE_COOLDOWN_TURNS = 3` + pure `rehydrationCooldownBlocked` in
  `semanticRehydration.ts`; last-fired map + live-vs-meter split in GameViewer (`liveRecall` flag —
  only the real turn records and advances the window, the meter replays it so it still shows what
  rode). Gap 0/negative exempt → re-rolls and rolled-back saves reproduce their recall. The
  consecutive-turn "no repeat within N" assertion landed as unit tests (windows, release at N,
  re-roll/rollback exemptions) rather than a rehydrate-probe case: the probe exercises prompt
  framing against a live model, and T1 touched no prompt text — the cooldown is deterministic
  selection logic, fully covered without an LLM.

### T2. Margin-over-baseline recall threshold — DONE 2026-07-23 (margin 0.15)
Absolute cosine floors don't transfer across worlds (literature: embedding scores are only
relatively comparable; our own knees differ per surface: 0.30 lore / 0.34 diary / 0.35 scenes; the
repeat.json session shows a one-house same-cast world where EVERYTHING clears 0.35 — the living-room
scene fired 10x during unrelated charged scenes). Fix: fire only when the candidate beats the band's
MEDIAN action-similarity by a margin (start +0.10), absolute floor kept as sanity bound. Applies to
Scene Recall first; evaluate for lore/diary after.
- Rejected alternatives: raising the fixed floor (the knob that just failed to generalize);
  cross-encoder reranking (the industry answer — retrieve loose, rerank jointly, +5-15 NDCG@10 —
  but a second on-device model + per-candidate WASM latency; parked as T6).
- Probe: semantic-lore-probe-style sweep on a SAME-CAST charged fixture (new cases file — the
  trade-coast fixture's distinct-events world overestimates separation).
- Shipped: `REHYDRATE_MARGIN = 0.15` + `REHYDRATE_MARGIN_MIN_BAND = 5` in `semanticRehydration.ts`
  (fire = sim >= max(floor, band-median + margin); median over ALL vectored candidates incl.
  cooled-down ones; below 5 candidates floor-only — a small band's median is the candidate's own
  neighborhood). Probe: `recall-margin-probe.mjs` + `semantic-recall-margin-cases.json` (same-cast
  one-house fixture; deterministic, embeddings only). Sweep: baseline 0.00 → 4/5 return-hits,
  1/4 charged-clean; 0.10 → 4/5, 1/4; **0.15 → 4/5, 3/4** (dominates); 0.20 → 3/5, 3/4. Caveat:
  fixture medians (0.11-0.36) run lower than the saturated repeat.json session, so 0.10's benefit
  is understated on it; the residual charged-kiss false-fire is a genuinely-similar single standout
  (margin can't separate it — that class belongs to cooldown + dup guard). Decided 2026-07-23:
  0.15 (dominates 0.10 on the fixture: same hits, 3/4 vs 1/4 clean); the 50+-turn A/B is the
  backstop if it proves too aggressive in saturated play.

### T3. Recall query = action + latest narration tail — TESTED 2026-07-23, REJECTED
ST queries the last 2 messages, not the bare action; our bare-action query starves recall of scene
identity in charged play ("I moan louder" distinguishes nothing). Try action + ~2 sentences of the
latest narration FOR SCENE RECALL ONLY (band trimming keeps the probe-validated bare action).
- Risk: recency bias pulls near-duplicates of the current scene (dup-guard-vs-floor held in
  repeat.json — verify it still does); our band probe showed appended METADATA poisons ranking —
  narration text may behave differently, hence the A/B.
- Probe: rehydrate-probe arm with the enriched query; targets must still rank, stickiness must not rise.
- Verdict: the risk the band probe flagged materialized. A/B on the same-cast fixture
  (recall-margin-probe `--arms bare,enriched`; tails avoid target-digest tokens, so nothing was
  handed): the ~2-sentence tail dominates the short action in mean pooling — every median jumps
  ~+0.15-0.28 (0.11-0.36 → 0.27-0.45), the whole band saturates, and at the shipped margin 0.15
  return-hits collapse 4/5 → 2/5 (return-grate's target is outranked by an unrelated bedroom scene;
  return-promise dies under its own inflated median) while charged-clean drops 3/4 → 2/4. Bare
  action + margin already yields the desired behavior: a terse charged action that "distinguishes
  nothing" correctly recalls nothing. Bare query stays. If query starvation resurfaces in the
  50+-turn A/B, try a weighted VECTOR blend (e.g. 0.7·action + 0.3·tail, renormalized) rather than
  text concatenation — the failure is length dominance in pooling, not the idea of context.

### T4. Sticky milestone verdicts — DONE 2026-07-24 (paired-forget protocol)
The T31→T32 flip-flop (keep 7 → keep all 30, recap 1.2KB → 7KB) is inherent to re-voting the WHOLE
memory list every turn with a small LLM. Mem0-class systems decide at WRITE time and never re-judge
the store. Refactor: only newly-aged digests get judged; old verdicts persist unless superseded;
pins remain the correction path. Kills flip-flop by construction and cuts a recurring request.
- Cost: selector prompt + selection-state rework; supersession (the selector's best skill) must
  still fire on new-entry-vs-old-entry pairs. Own probe cycle (milestone-select-probe extension).
- Shipped: incremental drainer in GameViewer (only unseen digests judged, kept list as context,
  rollback prunes seen so re-aging turns re-judge), `defaultMilestoneIncrementalPrompt` +
  incremental builder/parser/apply in `lib/milestoneMemory.ts`, verdicts persisted in the save
  envelope (additive `milestoneSelection` field; older saves judge the loaded history fresh once).
  The **paired-forget protocol is load-bearing**: a Forget must cite the kept new moment that
  replaces it ("2 replaced by 4"); the parser voids uncited forgets. Probe (`--mode incremental`,
  batch-of-1 replay, end-state vs labels, 2 runs/tier): wording-only arms collapsed (cloud must
  recall 'shipped' 0.38 / 'restraint' 0.53, must-forgets 21/17 — the model forgot ~one old entry
  per batch); 'paired' → cloud 0.88-0.90 / Cydonia 1.00, must-forgets 4-5/0, malformed 0.
  'paired2' (extra strictness) regressed closure keeps to 0.80 — don't re-add. Trade-off vs
  full-vote (cloud 0.95/0.20, Cydonia 0.95/0.27 on the same fixture): drop keep rises to ~0.41
  both tiers — write-time judgment keeps more incidental mass (charged beats; setups whose
  citation never fires) — accepted because the probe's full-vote number hides the real-session
  flip-flop (T31 keep 7 → T32 keep all 30) and T5's cap bounds recap mass; several probe
  kept-drops are index-0 entries resolve force-keeps anyway. Cloud's two stable bad forgets
  (relic→temple-rule, coast-promise→night-together: related-but-not-same citations) are the known
  residual; revisit only if the 50+-turn A/B surfaces them in play.

### T5. Memory Cap as default behavior once validated — DONE 2026-07-24 (default 12)
ST ships bounded injection always-on; unbounded here = 30-digest 7KB recaps. After the 50+-turn
repeated A/B, fold the cap into Semantic Memory's default (keep the number editable) instead of a
separate opt-in.
- The 50-turn A/B ran 2026-07-24 (findings section below); on its evidence `semanticBandCap`
  default flipped 0 → 12 (SettingsContext; usePersistentState → fresh installs only). Number stays
  editable, 0 = uncapped.

### T6. Cross-encoder reranker — TESTED 2026-07-24, REJECTED (browser-feasible class)
The calibrated fix for all similarity mushiness (incl. Diary Recall's hopeless 0.01 margin). Second
model download + latency; only if T1-T3 leave real quality on the table.
- Verdict: the 50-turn A/B gave T6 its live trigger (oblique probes outside the cosine top-12), and
  `t6-rerank-probe.mjs` tested the browser-feasible class against the REAL failure cases (12 probe
  turns from the semQB dumps: action + the actual 43-49 band candidates, target = the missed
  digest) plus the same-cast fixture. Three families, raw logits, q8: targets inside the top-12 —
  cosine 10/17, ms-marco-MiniLM-L-6 9/17 (1.4 ms/pair), jina-reranker-v1-turbo 9/17 (2.5),
  mxbai-rerank-xsmall (70M deberta) 10/17 (8.4). All three polish the easy cases to rank 1 but
  move the oblique failures (compass at cosine rank 22-34) only a few places — never into cap. The
  gap is inference-level ("my pack" ⊃ "the compass I took out 40 turns ago"), not scoring
  precision; no browser-size reranker bridges it. Latency was NOT the blocker (~0.1s/turn batch).
- Gotcha for any revisit: the transformers.js text-classification pipeline sigmoid-saturates every
  pair to 1.000 on this domain — rankings silently collapse to input order. Use raw logits via
  AutoModelForSequenceClassification (first probe pass showed a phantom "win" from exactly this).
- Untested residual: 280MB+ rerankers (bge-reranker-base class) — out of the on-device download
  budget, not proven bad. The realistic path to oblique recall is LLM-side (a planner/selector
  hint listing carried items, or letting the narration model see a keyed inventory), not a bigger
  similarity model.

## 50-turn repeated A/B (2026-07-24, semQA/semQB extended to 52 turns, 3 runs/arm/tier — THE gate run)

Scripts extended 24 → 52 turns (profiles.json; backup `profiles.json.bak-t5`), three planted facts
(compass T2, Harrowgate errand T1, survey-seal T32), oblique probes at T46/48/50, objective scorer
`sem-ab-score.mjs` (action-matched token greps + 8-gram pairs + request size + digests riding).
Note: the AI-context dump caps at 50 turns (GameViewer `.slice(-50)`), so the earliest entries slide
off 52-turn dumps — probe turns are unaffected.

| Tier · arm | C1 | C2 | C3 | 8gr avg | req chars | digests |
|---|---|---|---|---|---|---|
| Cydonia · A | 3/3 | 3/3 | 3/3 | 100 | 28,560 | 48 |
| Cydonia · B (cap 12) | 3/3 | 2/3 | 1/3 | 21 | 17,277 | 12 |
| Cloud · A | 0/3 | 0/3 | 1/3 | 1 | 14,089 | 48 |
| Cloud · B (cap 12) | 0/3 | 0/3 | 0/3 | 1 | 11,970 | 13 |

- **Cap verdict (T5): flip.** On the recall-capable tier the cap trades 3/9 oblique-probe passes
  (concentrated on C3, the newest planted fact) for a 40% smaller final request and a ~5× drop in
  cross-turn 8-gram repetition (avg 100 → 21; A had a 266-pair outlier run — the unbounded recap
  correlates with repetition explosions, the player-visible complaint this workstream started from).
  On cloud the cap is free: oblique recall is at the floor in BOTH arms (48 riding digests don't
  help it — presence ≠ use).
- **Recall loss mechanism verified (cloud B, C1):** milestone selection KEPT the compass (sticky
  verdicts + "Forget: none" behaving); the semantic ranking failed to place its digest in the
  top-12 for the oblique "go through my pack" action — bare-cosine mush, exactly T6's territory.
  Arm A's failures are the opposite mechanism: fact present in a 48-digest recap, never used.
- T4's incremental selector ran live all 12 runs: high keep-rate (~47-49 digests survive to T52),
  no flip-flop observed, `Forget: none` the dominant reply. The high keep-rate is the T4 trade-off
  showing up in play — the cap is what bounds it (and now does, by default).

## Play A/B findings (2026-07-23, Q profile, 25 turns, semQA/semQB in profiles.json, 1 run/arm/tier)

Machinery verified end-to-end in the real app; no measurable recall benefit at 25 turns (bands too
small — milestone selection already prunes to ~8-14 digests, cloud cap never engaged); recall B ≤ A
on 3/4 checks but inside single-run noise (milestone keep-variance dominates). Repeat with ≥3
runs/arm at 50+ turns where the band overflows.

## Real-session findings (repeat.json, 2026-07-23, 34 turns, charged, cloud default)

Scene Recall fired 27/34 turns; living-room scene recalled 10x during unrelated charged scenes
(threshold miscalibration → T2); 9/27 firings sticky (→ T1); zero copy-through, zero double-rides,
fail-opens held. The repetition the player noticed (T32-34, 38-48 shared 8-grams) is the charged
loop + milestone flip-flop (T31 kept 7, T32 kept all 30 → T4), not the semantic stack; band trimming
never engaged (cap off, band fit → T5). Final request ~6k tokens.

## Play A/B findings (2026-07-23, Q × {cloud, Cydonia}, 1 run/arm)

| Metric | Cloud A | Cloud B | Cydonia A | Cydonia B |
|---|---|---|---|---|
| C1 compass recall (T21) | PARTIAL | FAIL | PASS | PARTIAL |
| C2 destination recall (T22) | PARTIAL | FAIL | PASS | PASS |
| 8-gram repeat pairs | 0 | 0 | 11 (worst 16) | 4 (worst 12) |
| Scene recalls fired | — | 6 | — | 14 |
| Cap engaged | — | no (band ≤ 9) | — | yes (13-14 → ≤ 12) |

- **Machinery verified live:** embedding model downloads inside the harness browser, drainer covers
  digests, Scene Recall fires on-topic (sketching the ferry → the opening ferry scene; re-reading the
  notices → the notices scene), cap trims Cydonia's oversized turns.
- **Attribution trap:** each run generates a different story, and the milestone selector's keep
  decisions vary run-to-run — cloud A kept the Harrowgate digest, cloud B's selector dropped it
  (the cap never engaged there, so the semantic stack cannot have caused that recall FAIL). One run
  per arm cannot separate the stack from this noise.
- **Design caveat worth keeping:** Q's recall probes are OBLIQUE ("I check my pack" → compass) —
  exactly where action-similarity ranking is weakest. If capped trimming ever defaults on, oblique
  callbacks are the failure mode to probe hardest.
- Cydonia repetition drop (11 → 4 pairs) under B is interesting but single-run.

## Architecture decision (2026-07-23)

Mem0-style client-side memory: local embeddings + cosine retrieval over the existing milestone digests.

- **Zep/Graphiti evaluated and rejected**: Python-only, needs a graph-DB server, ingestion needs big
  structured-output models — impossible fully client-side. Its one stealable idea (supersession
  instead of deletion) is already what the milestone selector's worked example teaches.
- **Embeddings are browser-local** (transformers.js worker, MiniLM q8, ~23 MB). The cloud endpoint has
  no `/v1/embeddings` (live-verified 404, 2026-07-23); local servers would need a second loaded model
  (CPU-spill risk). No AI request is added anywhere in this arc.
- **The milestone selector stays.** Embeddings answer "does this matter *right now*" (situational,
  reversible); the selector answers "will this *ever* matter again" (supersession, importance) —
  similarity is anti-correlated with supersession (promise ≈ fulfillment vectors), so it can never
  replace that judgment. Layers: selector = what's in the library, retrieval = what's on the desk.

## Step 0 — ✅ Foundation + relevance-ranked band (SHIPPED 2026-07-23, unreleased, off by default)

Infra: `embeddingWorker.ts` / `embeddingWorkerClient.ts` (progress-aware), `embeddingCache.ts`
(`FORMAMORPH_EMBEDDINGS_DB`, hash-keyed, LRU), `memoryRelevance.ts` (pure scoring: cosine × 0.5^(age/40)).
Consumer: `buildBandedHistory` drops the lowest-scored digest instead of the oldest when over budget
(index 0 immune — scene-reset guard; any coverage gap fails open to oldest-first, byte-identical).
Settings → Generation → Semantic Memory sub-toggle (needs Memory Summaries on).

**Probed 2026-07-23** (`semantic-band-probe.mjs` + `semantic-band-cases.json`, 28-digest story, 13-drop
squeeze): trim-survival 4/4 planted targets kept by ranked / all lost by oldest-first; narration recall
of the planted fact **cloud 0/12 → 7/12 (58%)**, **Cydonia 2/12 (17%) → 9/12 (75%)**. Two probe-driven
fixes shipped with it: (a) the relevance **query is the bare action** — appending location/participants
poisoned ranking (location terms dominate; the letter target ranked 15/28 with the clause, 5/28
without); (b) **`RANKED_RECENT_IMMUNE = 2`** — the newest two band digests are immune to ranked drops
(the scene lead-in was losing to topically-hot old memories; control case now clean, newest-6 keep
5/6). Known case artifact: `letter-delivery` recalls 0/6 in stage 2 on both tiers even when the digest
rides — the wayfinding action doesn't invite mentioning the sender; stage 1 proves the memory is in
context. **Open before default-on:** a real long-session play A/B (the probe isolates the band; a full
session carries floor + prompts + planner interplay).

## Step 1 — ✅ Semantic Lore (SHIPPED 2026-07-23, unreleased, off by default)

`semanticLore` toggle (independent of memoryDigests; shares the model + download UI with step 0).
`src/lib/semanticDictionary.ts`: entries embed as name — keys — value (capped 1000 chars),
content-hash-keyed so import/duplicate id regeneration is free; `selectSemanticLore` fires enabled,
non-constant entries at cosine ≥ **0.30** (probe-tuned), cap **3**/turn; `applySemanticLore` folds
into the keyword report as `reason: 'semantic'` — a keyword reason always wins, keyword activation
untouched. Query = bare action vector, shared with band scoring (`embedActionVec`). Debug legend marks
semantic activations with ≈ + similarity tooltip (no text span exists to highlight — honesty kept).

**Probed** (`semantic-lore-probe.mjs`, keyword-free paraphrases asserted): threshold sweep gave
0.30 → **100% precision / 71% recall** (cap 3); 0.25 → 100% recall but 58% precision. The two missed
paraphrases (0.26/0.28) sit inside the negative noise band (top false fire 0.26) — a MiniLM ceiling,
not a threshold problem; revisit with a stronger embedder if real-world recall disappoints.
Live-verified in the browser: "ruined tower on the headland" → Old Beacon fires semantically (0.367),
unrelated entry stays off.

## Step 2 — ✅ Scene Recall / semantic rehydration (SHIPPED 2026-07-23, unreleased, off by default)

`semanticRehydration` toggle (requires semanticMemory; Settings "Scene Recall").
`src/lib/semanticRehydration.ts`: candidates = milestone-surviving band digests (supersession-gated),
plain cosine ≥ **0.35**, greedy best-first with near-duplicate skip at ≥ **0.75** vs both the chosen
set and floor digests, cap **2**. `buildBandedHistory` applies the token budget (existing
`rehydrateCap` = 25% free context), pulls chosen turns out of the digest band, and rides them as ONE
framed remembered-scene exchange after the recap (`defaultRehydrateUserPrompt`: "Recall in full the
earlier moment my next action returns to. This scene already happened; everything in the recap since
then still stands.") — never as live-looking pairs. Lexical selection stays disabled.

**Probed** (`rehydrate-probe.mjs`, dead-Jim fixture, 3 arms × 2 cases × 3 runs × both tiers):
detail-recall (planted gull-whistle detail, absent from all digests) 0-1/3 without recall → **3/3
framed** on both tiers (cloud bait case: framed 3/3 vs bare-splice 1/3 — framing helps the model USE
the scene). Alive-writes: **0/36 everywhere including the bare-splice control with the whistle bait**
— the temporal hazard did not reproduce in this fixture (death is strongly reinforced by recap +
prior turn), so the framing's safety value is defense-in-depth, not a measured delta; it costs
nothing and stays. The near-duplicate guard is unit-tested (twin-scene and floor-duplicate cases),
not probe-tested — the real freeze-scenario replay (close-session real failure turns) remains open
before default-on, alongside the long-session play A/B shared with step 0.

**Freeze replay DONE 2026-07-24** (`freeze-replay-probe.mjs` vs the real repeat.json dump, real
digests + actions, deterministic embeddings): the old arm (floor + dup guard only) reproduces the
reported pathology (26/34 turns firing, living-room scene 9×, 11 consecutive-repeat fires ≈ the
reported 27/34, 10×, 9 sticky — replay validated); the shipped stack (+ margin 0.15 + cooldown 3)
cuts the same session to 6/34 turns firing, every scene at most once, ZERO consecutive repeats.
Combined with the T2 fixture's held return-hits (4/5), the charged-scene freeze gate is CLOSED.

Original requirements, kept for reference:
- **Hard requirement 1: near-duplicate penalty** (MMR-style). Similarity maximally favors the repeated
  charged turns that caused the charged-scene freeze — the exact failure that got rehydration disabled.
  Dedup among candidates AND against the verbatim floor, cap charged-turn count.
- **Hard requirement 2: temporal framing** (user-raised, 2026-07-23 — the "dead Jim" problem). Models
  read position as time and vivid verbatim beats a compressed recap line: splice an old scene in as a
  bare conversation pair and a character who died in the recap walks again. Mitigations layered:
  candidates are milestone survivors only (the selector's supersession judgment already gates what can
  come back — the superseded skeever-fight digest is gone), the recap still states the later fact, and
  — the design change from v1 — the rehydrated turn rides as an explicitly framed memory exchange
  right after the recap ("Recall the earlier scene this action returns to." → old narration), never as
  live-looking history. Framing shape needs its own probe (label wording has measurably changed model
  behavior before — see digest-framing history).
- Probe: the freeze scenario (close-session real failure turns) + dialogue-hold + a dead-Jim temporal
  case: plant a death digest, rehydrate a pre-death scene of that character, count alive-writes. Both tiers.

## Step 3 — ✅ Memory Cap / always-on top-K band (SHIPPED 2026-07-23, unreleased, off by default)

`semanticBandCap` int setting (0 = off, UI derived-checkbox seeding 12, min 3; Settings "Memory Cap",
requires semanticMemory). `buildBandedHistory` gains `bandCap`: after budget trimming, the shared
`dropLowestEligible` keeps trimming to the cap even when the band fits — scored mode ONLY (no scores
→ no cap; it never blind-trims by age), protected-ends floor = 1 + RANKED_RECENT_IMMUNE = 3. Passed
to both narration and planner call sites (stage-consistency preserved).

**Probed** (`semantic-band-probe.mjs --cap 12 --budget 5000`, cap isolated from budget pressure):
deterministic — all 4 planted targets survive cap 12 (16 of 28 digests dropped), guards hold; recall —
full-28 band vs capped-12: cloud 3/12 (25%) → 4/12 (33%), Cydonia 10/12 (83%) → 11/12 (92%). Capped ≥
full on both tiers with 57% fewer memories — the needle-in-haystack dilution is real (the cloud model
recalls WORSE with all 28 in view than it did with 15 in the step-0 squeeze runs). Still open before
default-on: dialogue-hold + Q-profile on a real long session (the probe measures recall, not narration
quality).

## Step 4 — ✅ Diary Recall (SHIPPED 2026-07-23, unreleased, off by default)

`semanticDiaries` toggle (requires semanticMemory + characterDiaries; Settings "Diary Recall",
staged-mode row). `src/lib/semanticDiary.ts`: keep the newest **3** entries verbatim (continuity,
no vectors needed) + retrieve up to **2** relevant older ones at cosine ≥ **0.34**, near-duplicate
skip ≥ 0.75 vs the included set (the brooding-character guard), merged chronological — total stays 5,
token-neutral vs the old pure-recency path. Wired via `runStagedPlanning`'s optional `diaryRetrieval`
ctx field (null = byte-identical last-N path); drainer embeds diary texts (skips "nothing notable");
query = the shared bare-action vector.

**Probed** (`diary-retrieve-probe.mjs`, shared-word guard asserted): diary-shaped texts separate
WORST of any surface so far — positives 0.33-0.44, false fires to 0.33. Shipped 0.34 = the measured
knee (100% precision / 60% recall, cap 2) but the margin is ~0.01 — fragile across worlds, so the
design leans conservative (silent beats wrong memory). This surface is the strongest argument yet
for the step-5/stronger-embedder revisit. No LLM-side probe: the character pass carries the same
count of same-shaped entries, so the context contract is unchanged; what changed is *which* entries,
covered by the deterministic sweep + unit tests.

## Step 5 — Hybrid scoring (exploratory)

Blend signals: milestone keep-verdicts as importance weights, keyword/BM25 term matching alongside
cosine, entity-overlap boosts. Zep-lite "important AND relevant" without the graph. Only worth doing
if steps 1–3 show similarity-only misses in practice — don't build speculatively.

## Standing rules for every step

- Off by default until probed; every consumer fails open to today's behavior on any missing vector.
- No save-envelope changes — vectors are derived data, cache-keyed by content hash + model id.
- Model swaps invalidate via the key, never via migration.
- Work happens on branch `Mem0` only.
