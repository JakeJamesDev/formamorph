# 01: Shared Text Edit Layer

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every player change to AI-written turn text moves into one layer on the save, `turnTextEdits` (spec Q1, Q9). This ticket moves memories onto it with no visible change: a player's memory edits, rewrites and deletions work exactly as before, in new games and in saves from released builds. Diaries join the layer in ticket 05.

- **Shape.** This ticket owns the layer's type, its resolution for memories, and the save field. The type shape from the spec:

  ```ts
  interface TextEdit { text?: string; source: 'player' | 'ai'; deleted?: true }
  turnTextEdits?: Record<string /* turn id or written-memory id */, {
    memory?: TextEdit;
    diaries?: Record<string /* diary name as stored on the turn */, TextEdit>;
  }>;
  ```

  The `diaries` part is declared here and stays unused until ticket 05.
- **Migration.** `migrateSave` folds `memoryEdits` into `memory` and `memoryDeleted` into `memory.deleted`, idempotently, and drops the old fields. Saves write only the new field.
- **Readers.** The memory recap, the Memory Manager ledger, the side panel and script memories read the layer. Pins and written memories stay where they are.
- **Narration edit.** Editing a turn's narration drops that turn's text changes in the layer and keeps its deletes (spec, Narration edit).
- Don't call the layer an override in code or docs; that word is the glossary's Blueprints term.

## Acceptance criteria

- [x] A save holding `memoryEdits` and `memoryDeleted` loads with every edit, rewrite and deletion intact, and saves back with `turnTextEdits` only. `GameplayContext.textEdits.test.tsx` (load, then save) and `LoadGameDialog.test.tsx` "stores a released save's memory changes…" (import).
- [x] Migrating twice gives the same save; a save with neither old field is unchanged. `saveCompat.test.ts` "released memory changes fold into the text edit layer".
- [x] Edit, Revert, Delete, Restore and Reset All My Changes in Memories behave as before, on the new layer. `MemoryManagerModal.edits.test.tsx`, `MemoryManagerModal.reset.test.tsx`, `MemoryManagerModal.names.test.tsx`.
- [x] The memory recap the AI receives reads edits and skips deleted memories, as before. `memoryOverrides.test.ts` (band and selector cases), `toolRecall.test.ts`; mutation of the delete check turned 7 tests red.
- [x] Editing a turn's narration drops that turn's record in the layer. Per the spec session's ruling, it drops the turn's rewrites and keeps its deletes. `GamePanels.test.tsx` "drops the player's own rewrite…" and "keeps the player's delete…"; `turnTextEdits.test.ts`.
- [x] The landing body records the export-shape change: saves gain `turnTextEdits` and lose `memoryEdits` and `memoryDeleted`. Landing commit body.

## Landed

**Not verified**

- No live check in the app: the ticket has no visible change, and the jsdom tests drive the Memory Manager and the save round trip.

**For you**

- Load a save from 3.7.0 that has memory edits and deletions, and check Memories shows them as before.
- Naming follow-up: the layer rides inside `MemoryOverrides` / `applyMemoryOverrides` (lib/memoryOverrides), older names that still say "override". A rename (e.g. `MemoryChanges`) is out of this ticket's scope.
- Pre-existing: loading a deep-nested legacy save in `GameplayContext` keeps the previous game's `turnTextEdits` (it kept `memoryEdits` before, too).
