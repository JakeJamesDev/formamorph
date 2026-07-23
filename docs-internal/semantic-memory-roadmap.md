# Semantic memory — planned arc

Working roadmap for the embedding-retrieval workstream on branch **`Mem0`**. Research + decision log
lives in this doc; the shipped foundation is described below, then the planned steps in build order.
Steps ship one at a time, each behind its own probe evidence — nothing here is committed-to-all-at-once.

**▶ Resume here:** steps 0 and 1 shipped (2026-07-23, unreleased, both off by default). Next up is
**step 2 (semantic rehydration)** — read its section's hard requirement (near-duplicate penalty)
before starting.

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

## Step 2 — Semantic rehydration (phase 2 of the original plan)

Re-enable the disabled rehydration slot (`turnBanding.ts` step 3, scorers kept) with embedding
similarity instead of lexical matching: pull whole *verbatim* turns back when the action touches them.
- **Hard requirement: near-duplicate penalty** (MMR-style). Similarity maximally favors the repeated
  charged turns that caused the charged-scene freeze — the exact failure that got rehydration disabled.
  Dedup among candidates AND against the verbatim floor, cap charged-turn count.
- Probe: the freeze scenario itself (close-session real failure turns) + dialogue-hold, both tiers.

## Step 3 — Always-on top-K band (the full Mem0 shape)

Today ranking fires only under budget pressure. Cap the digest band at K most-relevant memories every
turn — smaller prompts, denser signal, mid-game benefit. This changes narration context on *every*
turn, so it needs the strongest probe evidence of the arc (dialogue-hold + recall + Q-profile) and
likely its own setting (band cap) rather than a hidden constant.

## Step 4 — Diary retrieval

Staged mode feeds each character's *recent* diary entries; retrieval pulls the *relevant* one
("she remembers the last time you drew a blade"). Embed diary entries at write time (same cache);
score against the current action + that character's presence. Small, contained, staged-mode-only.

## Step 5 — Hybrid scoring (exploratory)

Blend signals: milestone keep-verdicts as importance weights, keyword/BM25 term matching alongside
cosine, entity-overlap boosts. Zep-lite "important AND relevant" without the graph. Only worth doing
if steps 1–3 show similarity-only misses in practice — don't build speculatively.

## Standing rules for every step

- Off by default until probed; every consumer fails open to today's behavior on any missing vector.
- No save-envelope changes — vectors are derived data, cache-keyed by content hash + model id.
- Model swaps invalidate via the key, never via migration.
- Work happens on branch `Mem0` only.
