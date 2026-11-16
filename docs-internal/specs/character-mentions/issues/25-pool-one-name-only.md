# 25: Pool One Name Only

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Spec Q76: Q73's pooling may only join spellings of one name, so a model merge of two different people never hides one of them from discovery.

- **The rule:** two capitalized names in one speaking cluster pool only when they are spellings of one name: an edit distance of at most 2, or one a word subset of the other (`sameCharacterName`). Otherwise each name keeps its own evidence.
- **Where:** the pooling in `src/lib/characterCandidates.ts`, and the stored-name mapping in `participantTurns` in `src/lib/backgroundPassQueue/backgroundPassQueue.ts`. That mapping must never map a name onto a different name.
- **Unchanged:** the speech-verb gate, the known-character guard, and pools reading only the world's own names.
- **Changelog:** none; this corrects unreleased behavior inside the existing entry.

## Acceptance criteria

- [ ] A written passage puts two different unknown names in one speaking cluster. Both are discovered, each when today's rule or its own evidence allows. The test is proved by reinstating whole-cluster pooling.
- [ ] Two spellings within edit distance 2 still pool, as in the Mienshao case.
- [ ] The Sunmeadow replay (`.scratch/miensao`, kept out of the repo) still discovers one character on index 3.
- [ ] The 36-session corpus rescore, small model, still finds 24 of 24 with none of today's 23 lost. Report it in the Landed notes.
