# 05: Recall Tool, Hybrid Matching

Status: ready-for-human
Base: e1d604d5
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: ranking over cached vectors with the Scene Recall margin rule and a per-kind gate; the Scene Recall margin tests are prior art.

## What to build

With Semantic Memory on, recall ranks memories by meaning and by words together. Digests match by meaning under the Scene Recall floor and median margin. Diary entries match by meaning only when Diary Recall is also on, else by words. A record with no cached vector, a missing model, or a failed query embed falls back to words, and recall never waits on a download or adds embedding work. Records that match both ways rank first for the limit, then meaning-only, then word-only; survivors sort oldest first. The output shape does not change.

## Acceptance criteria

- [ ] Ranking is a pure function over query, records, vectors, and query vector
- [ ] Tests with fixed vectors: meaning-only match with no shared words, word-only match below threshold, both-ways ranked first, record without a vector matches by words, failed query embed returns the lexical result, same-cast world where the margin keeps the result small
- [ ] Diary Recall off: a diary entry that would match by meaning matches by words only
- [ ] Semantic Memory off: result equal to ticket 04's lexical result
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
