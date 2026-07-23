# Semantic memory — planned arc

Working roadmap for the embedding-retrieval workstream on branch **`Mem0`**. Research + decision log
lives in this doc; the shipped foundation is described below, then the planned steps in build order.
Steps ship one at a time, each behind its own probe evidence — nothing here is committed-to-all-at-once.

**▶ Resume here:** step 0 shipped (2026-07-23, unreleased). Next up is **step 1 (semantic dictionary
activation)** — highest player-visible value, no interaction with narration-band tuning.

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

**Open before default-on:** a real long-session A/B (ranked vs oldest-first trimming) per the
prompt-writing guide — the band only ranks under budget pressure, so the probe needs a history past
the budget. Not yet run.

## Step 1 — Semantic dictionary activation (NEXT)

Lorebook entries activate on keyword match today (`dictionaryUtils` / `dictionaryScan`); embed entries
so "the ruined tower on the hill" activates the *Old Beacon* entry with zero shared words. The
SillyTavern "vector storage" feature players expect, on a surface with no narration-band coupling.
- Embed entry title+keywords+content once (same cache, hash-keyed); score against the current action
  (+ recent narration?); activate above a similarity threshold, unioned with keyword hits (never
  replacing them — keyword activation is authored intent).
- Needs: threshold tuning against real worlds; the AI-context dictionary popup must show semantic hits
  distinctly (it currently shows real activation hits only — keep that honesty).
- Probe: activation precision/recall on authored worlds (Sedge Landing dictionaries), both test tiers.

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
