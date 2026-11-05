# 11: MainMenu And Formaquestion Moves

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: The pattern is set, but the age gate sits in a Q5 area.

Parent: [Test Sweep spec](../spec.md)

## What to build

`MainMenu` and Formaquestion panel tests move to the right level (Q7). Age gate tests sit in a Q5 area and keep their mutation kills.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q5, Q7, Q22, Q23.

## Acceptance criteria

- [x] Time before and after is recorded per family in the ticket. See Results.
- [x] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red. `MainMenu.ageGate` and `MainMenu.sessionSync` did not change (Q54), so their kills hold with no run. 23 coverage pairs exit 0, and four reinstated bugs turned tests red.

## Results

The spec session ruled on this ticket's Q5 proof in Q54.

**Groups:** the largest time per test that had a smaller module to land on.

| Family | Moved from | Moved to | Tests |
|---|---|---|---:|
| `MainMenu` | `MainMenu.entry`, `MainMenu.avatarStep` | `src/views/EnterWorldFlow.test.tsx`, `src/views/EnterWorldFlow.avatarStep.test.tsx` | 42 |
| `Formaquestion` | `Formaquestion.codeInsert` | `src/components/formaquestion/CodeInsert.test.tsx` | 10 |
| `Formaquestion` | `Formaquestion.entityCards` | `src/components/formaquestion/EntityCard.test.tsx` | 10 |
| `Formaquestion` | `Formaquestion.sourcesFold`, `Formaquestion.thinkingFold` | `src/components/formaquestion/useAnswerFolds.test.tsx` | 12 |
| `Formaquestion` | `Formaquestion.codeBlock` | `src/components/formaquestion/CodeSnippet.answer.test.tsx` | 2 |

**What stays on the view:** 7 tests in `MainMenu.entry`, and 6 in `Formaquestion.answerWiring`. The window keeps the reader, the sheet closing on a write, and the entity note in the next request.

| 3 alternating runs of each layout, medians | Tests | Body before | Body after | Wall before | Wall after |
|---|---:|---:|---:|---:|---:|
| `MainMenu` | 49 | 20.8 s | 8.8 s | 24.5 s | 9.8 s |
| `Formaquestion` | 40 | 17.1 s | 8.2 s | 12.7 s | 8.6 s |

The other tests in both families did not change. Peer sessions were working during these runs.

**Kept protection:** no test was deleted, and no `expect` line or test name changed (299 old lines all present, 85 test names). The one added line is the `finalize` helper, which each entry file now holds.

| Pairs | Modules |
|---|---|
| View | `MainMenu.tsx`, `Formaquestion.tsx` |
| Panels | `EnterWorldFlow.tsx`, `EnterWorldWorkspace.tsx`, `entryDraft.ts`, `AskParts.tsx`, `CodeInsert.tsx`, `CodeSnippet.tsx`, `EntityCard.tsx`, `useAnswerFolds.ts`, `useHelpChat.ts`, `entityBlock.ts` |
| Q5 code under Q50 | `blueprints.ts`, `GameDataContext.tsx`, `WorldStorageService.ts`, `version.ts`, `statLookupMigration.ts`, `scriptTextMigration.ts`, `statCodeRoutes.ts`, `scripts.ts`, `scriptInsert.ts`, `helpSession.ts`, `helpPrompt.ts` |

Every pair exits 0 with 0 lost lines and branches. The panel pairs list the kept tests in their after list where those tests reach the module, because those tests did not move.

Two tests went back to the view because their coverage had no other holder: the session Rolls test covers a stat-name line in `MainMenu.tsx`, and the remount test covers the stored-layout read.

| Reinstated bug | Red |
|---|---|
| `MainMenu.tsx` passes no default persona (view path) | "starts on the global default and hands it to the game, then remembers it for the world" |
| `blueprints.ts` finds no Custom Persona entity | "lists the Custom Persona entity in None's place…" and 1 more |
| `scriptInsert.ts` keeps a slot word in the code | "drops a slot word the model put on the first line, and reads it as the tag" |
| `helpSession.ts` drops an answer's sources (help path) | "starts open with a toggle that exposes its state…" and 6 more |

A fifth bug, `flagged: false` on the streaming `answer` event in `helpSession.ts`, turned nothing red in `CodeInsert` and `CodeSnippet.answer`. The `done` event sets the flag again. The assertions are the old ones, so this gap predates the move.

⚠️ **The gap (Q52, Q54):** `MainMenu.tsx` took no whole-file mutation run, at 28 h projected. Its proof is the coverage pair and the reinstated bug above. Mutants in its Enter World wiring could survive and this proof would not show it.

## Landed

**Not verified:** nothing.

**For you:** nothing; no product code changed.
