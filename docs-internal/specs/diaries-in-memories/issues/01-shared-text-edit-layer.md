# 01: Shared Text Edit Layer

Status: ready-for-agent
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
- **Narration edit.** Editing a turn's narration drops that turn's whole record in the layer, where it dropped only the memory edit before.
- Don't call the layer an override in code or docs; that word is the glossary's Blueprints term.

## Acceptance criteria

- [ ] A save holding `memoryEdits` and `memoryDeleted` loads with every edit, rewrite and deletion intact, and saves back with `turnTextEdits` only.
- [ ] Migrating twice gives the same save; a save with neither old field is unchanged.
- [ ] Edit, Revert, Delete, Restore and Reset All My Changes in Memories behave as before, on the new layer.
- [ ] The memory recap the AI receives reads edits and skips deleted memories, as before.
- [ ] Editing a turn's narration drops that turn's record in the layer.
- [ ] The landing body records the export-shape change: saves gain `turnTextEdits` and lose `memoryEdits` and `memoryDeleted`.
