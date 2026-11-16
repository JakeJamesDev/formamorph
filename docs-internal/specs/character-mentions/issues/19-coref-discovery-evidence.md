# 19: Coref Discovery Evidence

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Spec Q73: when Character Mentions has read a turn, a new character is discovered from the turn's coref clusters, so it no longer waits for repeated mentions and a person verb.

- **Person evidence:** a capitalized run in `characterCandidates.ts` counts as a person when its span shares a cluster with he, she, him, her, his, hers, himself or herself. "They" does not count.
- **Pooled spellings:** the capitalized runs in one cluster pool their mid-sentence uses. They count under the most-used spelling that no exclusion blocks, with ties going to the first one. A misspelled or variant name no longer splits its evidence.
- **Source:** the turn's saved Mention Reading clusters (Q59). A turn without a reading uses today's rule unchanged. The clusters only add evidence and never remove a candidate.
- **Timing:** `readNarration` already takes the turn's reading. Check whether the reading is ready when the turn commits. If it isn't, apply the evidence where the discover pass reads names (`dueDiscoveries`), so the character is found in the same turn's idle window.
- **Fixture rule:** real narration never goes into tracked tests (spec constraint). Tests use written passages that reproduce the pattern.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] A written passage reproduces the pattern: a species label used as a name, two spellings, only "paused" and "listened" as verbs, and "she" and "her" after it. The character is discovered on its first turn with a reading, and only on a later turn without one. The test is proved by removing the cluster evidence. — `discovers a character on the first turn its clusters qualify (Q73)` in `backgroundPassQueue.test.ts`; the no-cluster and no-reading arms find it on t2.
- [x] Two spellings in one cluster pool their uses. A spelling that an exclusion blocks is never the candidate name. — `pools spellings that share a cluster, and only those` and `names the most-used spelling no exclusion blocks` in `characterCandidates.test.ts`.
- [x] A capitalized place or object whose cluster holds only "it" gains no person evidence. A cluster whose only pronoun is "they" gains none either. — `gives no person evidence to an it-only or they-only cluster`, with a she control.
- [x] Rescore the discovery corpus that `characterCandidates.ts` cites (36 real sessions, kept out of the repo), with the model's clusters added. Report precision, recall, and how many turns earlier each character is found. Precision stays at the corpus's measured 1.00, or the ticket stops and asks. If the corpus isn't on disk, ask the spec session before scoring anything else. — small model, the app's discover path: 23 → 24 discoveries, none lost, precision 1.00 (table below). Cleo found 4 turns earlier; Aiko Sato found where the name rule never finds her. The big-model run was skipped by the user's call.
- [x] Replay the user's Sunmeadow context (`D:\Downloads\ai-context-sunmeadow-town name.json`, kept out of the repo) through the real extractor with the model's clusters. Report the turn the Mienshao character is discovered; today it is turn 5 (index 5, first seen at index 3). — index 3 in all four runs (small and big model, with and without the world's exclusions); one character each, named "Miensao" under the world's exclusions.

## Landed

Rulings during the build (Q73 amended on main): pooled spellings stay linked across turns; only a cluster a speech verb ties to a quote on its page proposes a name; a cluster holding a known character adds and links nothing; pools read the world's own names only.

**Timing:** the reading is never ready at commit (`readNarration` gets none there), so the evidence applies in `dueDiscoveries`.

**Speaker gate, small-model corpus (36 sessions, name rule alone finds 23):**

| gate | discoveries | Aiko | Mika | Maya | Thornwood | lost | Cleo |
|---|---|---|---|---|---|---|---|
| none | 27 | ✅ t22 | kept ❌ | kept ❌ | kept ❌ | 0 | 4 turns earlier |
| speaker, all quote rules | 25 | ✅ t23 | kept ❌ | dropped | dropped | 0 | 4 turns earlier |
| speaker, speech-verb quotes only (shipped) | 24 | ✅ t23 | dropped | dropped | dropped | 0 | 4 turns earlier |

**Not verified**
- Live play: no session ran with Character Mentions on; the path was exercised through `dueDiscoveries` with recorded narrations and real model clusters.
- The big-model corpus run (skipped by the user's call).

**Known edges**
- A diary written under a misspelling before its reading linked it would come due again under the pooled name. Diaries only go to known names, and readings land before discovery, so this needs a misspelling discovered on its own first.
- `quoteSpeakingClusters` keeps one cluster per span; a span the model puts in two clusters speaks for the first only.
- The discover pass re-judges each turn's clusters on every queue tick; most clusters stop at the known-name check before any tally is built.

**For you**
- Play a turn where a new character is named only by species and speaks: with Character Mentions on, they should appear in the Entities tab right after that turn, not several turns later.
