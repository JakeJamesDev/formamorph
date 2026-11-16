# 25: Pool One Name Only

Status: done
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

- [x] A written passage puts two different unknown names in one speaking cluster. Both are discovered, each when today's rule or its own evidence allows. The test is proved by reinstating whole-cluster pooling. (`keeps two different names in one cluster apart (Q76)`, `discovers both people of a cluster the model merged (Q76)`; both went red with `[names]` as the one group.)
- [x] Two spellings within edit distance 2 still pool, as in the Mienshao case. (`pools spellings that share a cluster`, `pools a close spelling of one word of a longer name`, `sameNameSpelling (Q76)`.)
- [x] The Sunmeadow replay (`.scratch/miensao`, kept out of the repo) still discovers one character on index 3. (World exclusions: Miensao on index 3. All four lines match main's code run with `--root` on main.)
- [x] The 36-session corpus rescore, small model, still finds 24 of 24 with none of today's 23 lost. Report it in the Landed notes.

## Landed

Rulings during the build (Q76 amended on main twice): names compare word by word, one name's significant words a subset of the other's, each word within 1 edit under 5 letters and 2 from 5 up (`sameNameSpelling`). Spellings group most-used first; a name joins a group only when it spells every member, so "Smith" never chains "Anna Smith" to "John Smith". An earlier turn's link names a group, and the discover pass maps or blocks a stored name through a link, only under the same test.

**Corpus rescore, small model, 36 sessions** (`.scratch/cm19-rescore/corpus-rescore.ts`): today 23, with clusters 24, lost 0. Aiko Sato is new on t23, Cleo 4 turns earlier. Same as ticket 19.

**Sunmeadow replay** (`.scratch/cm19-rescore/miensao-run.ts`): with world exclusions, Miensao on index 3. The no-exclusions line also shows Miensao on index 4. Main's code prints the same line: the harness passes discovered names as character exclusions, so the cluster is skipped as known and the stored misspelling comes due.

Also: `editDistance` moved from `src/lib/docs/termExpansion.ts` to `src/lib/editDistance.ts` for reuse, with its own tests. `src/lib/codeSurface.ts` keeps a separate uncapped copy.

**Not verified**
- Live play with Character Mentions on: exercised through `dueDiscoveries` with recorded narrations and real model clusters only.

**For you**
- Nothing new to judge in play: this changes which names pool, not anything on screen.
