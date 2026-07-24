# Semantic memory — planned arc

Working roadmap for the embedding-retrieval workstream on branch **`Mem0`**. Research + decision log
lives in this doc; the shipped foundation is described below, then the planned steps in build order.
Steps ship one at a time, each behind its own probe evidence — nothing here is committed-to-all-at-once.

**▶ Resume here:** ALL of steps 0-4 shipped (2026-07-23, unreleased, everything off by default). The
arc's build phase is done. **First real-app play A/B run 2026-07-23** (Q profile, 25 turns, semQA/semQB
profiles in profiles.json, 1 run/arm/tier — see "Play A/B findings" below): machinery verified
end-to-end in the real app; no measurable recall benefit at 25 turns (bands too small — milestone
selection already prunes to ~8-14 digests, cloud cap never engaged); recall B ≤ A on 3/4 checks but
inside single-run noise (milestone-selector keep-variance dominates). What remains before any
default-on: a REPEATED A/B (≥3 runs/arm) at 50+ turns where the band genuinely overflows
(dialoguehold-length), the charged-scene freeze replay (step 2), and step 5 only if real-world use
shows similarity misses.

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
