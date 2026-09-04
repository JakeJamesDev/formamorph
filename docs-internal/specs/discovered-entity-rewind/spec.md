# Spec: Discovered entities survive regenerate / rollback

Status: ready-for-agent

## Problem Statement

As a player, when the game invents a character for me (an auto-generated entity) and I edit its description, that edit disappears the moment I re-generate a turn or roll back. Either the description silently reverts to the pre-edit text, or the character is re-described from scratch by the AI — my curation is gone either way. This most visibly happens when re-generating the turn right after the character was first described, and when rolling back to the turn that introduced them.

## Solution

Regenerate and rollback stop resetting discovered-entity state from the frozen per-turn snapshot. Instead they keep the *live* discovered entities — which carry the player's edits — pruned to only the characters whose introducing turn still exists after the rewind. Suppressed character names (characters the player deleted so they're never re-proposed) get the same keep-live treatment, unpruned. This mirrors exactly how narration edits and notes already survive a rewind.

Player-visible behavior after the fix:

- Editing a discovered character's description, then regenerating a later turn, keeps the edit.
- Rolling back to (or past) the turn that introduced a character keeps the character and its edited description, as long as the introducing turn survives the rewind.
- Re-rolling the very turn that introduced a character discards that character (the new roll may not include them) — and if the fresh narration names them again, they are discovered anew. This is correct, not a bug.
- A character the player deleted stays deleted across regenerate/rollback instead of being re-proposed.

## User Stories

1. As a player, I want my edits to an auto-generated entity's description to survive re-generating the next narration, so that my curation of the story's cast is not thrown away.
2. As a player, I want my edits to survive rolling back to an earlier turn, so that undoing story beats doesn't undo my bookkeeping.
3. As a player, I want a discovered character to remain known after a regenerate, so that the game doesn't spend an AI request re-describing someone it already knows.
4. As a player, I want a character introduced by a turn I re-roll to be dropped with that turn, so that my cast list only contains characters the current story actually introduced.
5. As a player, I want a character re-introduced by the fresh roll of a re-rolled turn to be discovered again, so that the cast stays consistent with the new narration.
6. As a player, I want a character I deleted (suppressed) to stay deleted after regenerate or rollback, so that the game doesn't keep re-proposing someone I removed.
7. As a player, I want visitor entities (authored characters pulled in from a sibling location) to follow the same rewind rules as discovered characters, so that presence stays consistent with the surviving turns.
8. As a player, I want rollback and regenerate to behave identically with respect to my entity edits, so that I don't have to learn two sets of rules.
9. As a player on an older save, I want discovered entities without a recorded source turn to be kept (never silently dropped) on rewind, so that loading legacy data is safe.
10. As a player, I want saves written after a rewind to contain the kept (edited) entity state, so that quitting and reloading doesn't resurrect the bug.

## Implementation Decisions

- **Root cause being fixed:** discovered-entity state is restored from frozen per-turn snapshots on regenerate/rollback, but discovery (idle drainer), visitor pulls, and player edits all land *after* the relevant snapshot commits. Restoring the snapshot therefore drops or reverts them, and the discovery drainer then re-describes the "unknown" name.
- **Wiring seam (existing):** the gameplay context's state-restore function already takes a `keepLiveHistory` option that preserves the live message history and notes on rewind. Its meaning is extended: when set, the restore also skips resetting `discoveredEntities` and `suppressedCharacterNames`, leaving the live values in place. Load-from-save paths (no `keepLiveHistory`) are unchanged.
- **Prune seam (existing module):** a new pure helper in the runtime-characters helper module computes the discovered records to retain, given the live records and the rewound message history: keep a record iff its `sourceTurnId` matches a turn id present in the rewound history; records with no `sourceTurnId` (legacy/unanchored) are always kept. The two rewind handlers (rollback, regenerate) call it against the rewound slice they already compute and write the result to state.
- **Suppressed names:** kept live, unpruned — they are bare strings with no turn anchor, and the player intent "never re-propose this character" should survive any rewind.
- **No shape changes:** no save-envelope or world-export field changes; `DiscoveredEntity.sourceTurnId` already exists for exactly this anchoring. Snapshots keep their current contents — only what a rewind *restores from them* changes.
- **No prompt changes**, no settings changes, no UI changes.

## Testing Decisions

- Good tests here assert external behavior: "after a rewind, the retained set / live state is X", never "function Y was called".
- **Pure helper:** unit tests in the runtime-characters test file (existing prior art: tests for `selectDueDiscovery`, `cleanDiscoveredDescription`). Cases: record whose source turn survives is kept; record whose source turn was sliced off is dropped; record with no `sourceTurnId` is kept; empty history drops all anchored records.
- **Wiring:** a provider-level test mounting the gameplay context (prior art: the save-compat / context tests, and the GamePanels harness with real providers) that seeds live discovered entities + suppressed names, calls the restore with `keepLiveHistory` and a snapshot containing stale values, and asserts the live values survive; plus the inverse — restore *without* `keepLiveHistory` still adopts the snapshot's values (the load-save path must not regress).
- Per the test bar: each new guard is proven by reinstating the bug (removing the carve-out) and watching the test fail.
- The re-discovery symptom itself (drainer re-describing a known name) needs no new test: once the name survives the rewind, `selectDueDiscovery`'s existing known-name filtering — already under test — prevents it.

## Out of Scope

- Turn-scoped semantics for `visibleEntities` or any other snapshot field — only `discoveredEntities` and `suppressedCharacterNames` change restore behavior.
- Rehydrating or migrating existing saves that already lost edits — nothing recoverable exists.
- The discovery prompt, the regenerate-description feature in the entity modal, or any AI-call text.
- Making snapshots themselves capture late-landing discoveries (the deferred-snapshot timing stays as is; the fix makes rewinds stop depending on it).

## Further Notes

- Reported by GenerallyCurious, Aug 14 2026 ("Re-generating narration also causes auto-entities to re-generate"). Both reported variants — fresh re-description and revert-to-pre-edit — are the same root cause under different discovery-path timing (idle drainer vs. staged-planning commit).
- The asymmetry that motivated the design: narration edits and notes already have this exact carve-out; discovered entities carry player edits of the same kind and simply lacked it.
