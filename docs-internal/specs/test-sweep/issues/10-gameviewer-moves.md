# 10: GameViewer Moves

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: GameViewer is the god node and much of it sits in Q5 areas, so proof runs matter.

Parent: [Test Sweep spec](../spec.md)

## What to build

`GameViewer` panel tests move to the right level (Q7). Turn pipeline, prompt and save tests sit in Q5 areas and keep their mutation kills. The slowest file loads every bundled save for 132 s; decide from the ledger which of its cases the view must run, and keep the migration guarantee.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q5, Q7, Q22, Q23.

## Acceptance criteria

- [x] Time before and after is recorded per family file in the ticket. See Measured, from `testLedger` single runs.
- [x] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red. `GameplayContext.tsx` kills 331 to 331. Coverage pairs hold on three modules, and six reinstated bugs went red.
- [x] Every bundled save still loads in a test. All 23 cases in `GameplayContext.bundledSaves.test.tsx`, with the real settle on load (Q51).

## Measured

Body seconds from single `testLedger` runs, on the final source. Peer sessions were running other tickets.

| File | Before | After |
|---|---:|---:|
| `src/views/GameViewer.bundledSaves.test.tsx` | 64.8 s, 24 tests | 14.5 s, 5 tests |
| `src/views/GameViewer.storyCard.test.tsx` | 64.8 s, 9 tests | 47.2 s, 17 tests |
| `src/views/GameViewer.demoAITurnCount.test.tsx` | 19.8 s, 8 tests | merged into `storyCard` |
| `src/views/GameViewer.storyCard.noHosted.test.tsx` | 8.6 s | 3.8 s |
| `src/contexts/GameplayContext.bundledSaves.test.tsx` | new | 2.1 s, 24 tests |
| **Total** | **158.0 s** | **67.6 s** |

| Proof | Result |
|---|---|
| Coverage, `GameViewer.tsx` | kept, with `clockAdvance` and `inventoryPass` as context |
| Coverage, `GameplayContext.tsx` | kept |
| Coverage, `useSettleOnSaveLoad.ts` | kept |
| Kills, `GameplayContext.tsx` (Q52) | 724 mutants, 331 detected before and after, 0 lost, 5 static survivors. 25.7 and 22.5 min on 4 workers |
| Load call removed from the view | `a save of rampage` red |
| Count recording broken (Q53) | `stays away through the fourth turn, then shows on the fifth` red |
| Settle commit removed from the hook | 7 context cases red |
| Stat backfill removed from `loadGame` | 3 context cases red |
| Scene filter removed | the new discovered-character test red |
| `knownDiscoveredNames` emptied | the new discovered-character test red |

- **Kept view cases (Q51):** rampage and open-chat pre-refresh, drone and emberwatch pre-expansion, and a slime stat cut. Each plays a turn. Five, not three, because `GameViewer.tsx` coverage needed them.
- **Not moved:** the turn pipeline, script, pay and item files play real turns through the view's commit path, which has no lower level. The AI Context search box lives inline in the view. The landing, surface request, help world and chip option files test view wiring.
- **The discovered-entity lines:** the old file reached them only on some runs. No bundled world script calls `discover`, and the stub narration names no entity. That cause is unexplained. Two new tests in `GameViewer.inventoryPass.test.tsx` now cover them.
- **One production change (Q15):** `settleTraitsWithItems` in `src/lib/inventory/settle.ts` replaces the view's inline settle, so the view and the new test call the same code.

## Landed

**Not verified:**
- No alternating before and after timing runs. The times above are single runs.
- No mutation run on `GameViewer.tsx`. Q52 ruled one out, since it projects 5070 mutants and 202 worst-case hours.

**For you:**
- The 18 bundled save cases that left the view now load and settle at the `GameplayContext` level, and no longer play a turn after the load. The five kept view cases still do.
- The view's ledger records are stale until refreshed, because `GameViewer.tsx` changed.
