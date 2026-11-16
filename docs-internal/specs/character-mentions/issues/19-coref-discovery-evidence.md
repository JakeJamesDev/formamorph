# 19: Coref Discovery Evidence

Status: ready-for-agent
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

- [ ] A written passage reproduces the pattern: a species label used as a name, two spellings, only "paused" and "listened" as verbs, and "she" and "her" after it. The character is discovered on its first turn with a reading, and only on a later turn without one. The test is proved by removing the cluster evidence.
- [ ] Two spellings in one cluster pool their uses. A spelling that an exclusion blocks is never the candidate name.
- [ ] A capitalized place or object whose cluster holds only "it" gains no person evidence. A cluster whose only pronoun is "they" gains none either.
- [ ] Rescore the discovery corpus that `characterCandidates.ts` cites (36 real sessions, kept out of the repo), with the model's clusters added. Report precision, recall, and how many turns earlier each character is found. Precision stays at the corpus's measured 1.00, or the ticket stops and asks. If the corpus isn't on disk, ask the spec session before scoring anything else.
- [ ] Replay the user's Sunmeadow context (`D:\Downloads\ai-context-sunmeadow-town name.json`, kept out of the repo) through the real extractor with the model's clusters. Report the turn the Mienshao character is discovered; today it is turn 5 (index 5, first seen at index 3).
