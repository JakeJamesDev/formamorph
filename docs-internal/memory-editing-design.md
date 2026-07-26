# Memory Editing — design spec

**Status:** ✅ SHIPPED 2026-07-25. Spec below is what was built; §7 is the done-state as run.
**Builds on:** `milestone-memory-design.md` (the shipped selector + Memory panel).

Today the player's only lever over long-term memory is a keep/drop pin. This adds the other four:
**rewrite · add · delete · regenerate**, in a dedicated Memory Manager.

---

## 1. Principles

| # | Principle |
|---|---|
| 1 | **The AI's original is never destroyed.** Every player change is an override layer keyed by turn id, exactly like `memoryPins`. Clearing an override restores the AI's text and verdict. |
| 2 | **Editing is intent.** Player-authored text is force-kept and ranks top-of-importance — it never has to argue with the selector. |
| 3 | **Chronology is sacred.** A manual memory is anchored where it was created and reads to the AI like it happened then. |
| 4 | **One source of truth.** Every consumer — narration recap, planner, selector input, semantic retrieval, panel — reads the *effective* text. The AI can never see a pre-edit version. |
| 5 | **Gameplay never writes the authored world.** Everything lives in the save envelope (hard constraint #5). |

---

## 2. The four operations

### ✏️ Rewrite

- Player edits the summary text of any digest-carrying turn.
- Stored as an override, **not** a mutation of `summary` on the turn.
- **Auto-pins `keep`** and ranks **top of importance** (the selector's 1–3 weight scale rank-normalizes; player-touched entries sort at the top).
- Does **not** re-open the sticky incremental verdict. No re-vote.
- Clearing the pin later falls back to the stored verdict; the *text* stays edited. Text and pin are separate overrides that an edit happens to set together.
- **Revert to original** per row restores the AI's text and drops the auto-pin.

### ➕ Add

- Player writes a free-form memory that no turn produced.
- **Player-authored, per-save only.** No World Editor seeding in this scope (that would be a world export-shape change — separate feature).
- **Anchored at creation** and **not re-anchorable**. A misplaced note is deleted and re-added.
- **Never enters the selector.** No candidate list, no verdict, no forget — it rides until deleted.
- **Enters context immediately**, even though its anchor sits inside the verbatim floor. The aging rule that gates fresh *digest verdicts* doesn't apply to something that was never judged.
- **Reads identically to a digest** in the recap — no marker, no framing word. This keeps the feature off the prompt surface entirely.
- Needs its own id (`crypto.randomUUID()`), having no `turnId`.
- Soft character counter that turns amber past roughly digest length. No hard cap.

### 🗑️ Delete

- **Tombstone, restorable.** The entry leaves the manager's default view and never enters context; the turn's original `summary` survives untouched in the save.
- A **Show deleted** filter lists tombstoned entries with restore.
- Distinct from the `drop` pin: `drop` = *the story doesn't need this now* (still numbered context for the selector); delete = *this shouldn't exist* (removed from the selector's input entirely).
- **Deleting the oldest memory warns once.** `resolveMilestoneKeep` force-keeps index 0 because losing the story's opening causes observed full scene resets. Deletion is allowed after a one-time confirm explaining that; the force-keep guard then slides to the new oldest surviving memory.

### 🔄 Regenerate

- One click: re-runs the existing digest prompt on that turn at its pinned sampler, spinner in the row, **fires silently** (no confirm — the app already makes silent requests every turn).
- No player hint/steer in this scope — that would be a new prompt surface needing probe evidence per `prompt-writing-guide.md`.
- **No auto-pin, no importance boost.** The player authored no content, so the selector's verdict still governs.
- Result lands in the same override slot a rewrite would use, so *revert to original* still means the AI's **first** summary.

---

## 3. Storage — the override layer

All additive fields on the save envelope, alongside `memoryPins` / `milestoneSelection`.

```ts
/** Player rewrites (and regenerations) of AI summaries, keyed by turn id. `summary` is never touched. */
memoryEdits?: Record<string, string>;

/** Tombstoned memories: turn ids and manual-memory ids the player removed. */
memoryDeleted?: string[];

/** Player-authored memories with no source turn. */
memoryNotes?: Array<{
  id: string;         // crypto.randomUUID()
  text: string;
  anchorTurn: number; // index in the turn list at creation time
}>;
```

> ⚠️ **Export-shape change (additive).** Three new optional save-envelope fields. Per hard constraint #2 this is flagged for the version/migration call, which is the user's. Older saves read as "no edits" — correct behavior by construction.

**Resolution order** for one entry's text and fate:

1. tombstoned → excluded everywhere, full stop
2. `memoryEdits[id]` → that text; force-kept and top-ranked **if player-written**, plain replacement **if regenerated**
3. otherwise → `turn.summary` + existing pin/selection resolution

`memoryNotes` bypass 2–3 and are always kept.

Regenerate needs to distinguish itself from a rewrite in storage — a `source: 'player' | 'ai'` marker on the edit entry, or a parallel set of regenerated ids. Implementation's call; behavior above is the contract.

---

## 4. Where memories ride in context

| Case | Placement |
|---|---|
| Digest whose turn has aged into the banded section | unchanged — the existing banded recap |
| Note whose anchor has aged into the banded section | spliced at its anchor position |
| Note whose anchor is still inside the verbatim floor | standing block immediately before the verbatim floor |
| **Memory Digests off** (no banding at all) | all notes as one standing block ahead of the verbatim history |

The last two are the same mechanism: when chronological anchoring has nothing to anchor *into*, notes group as standing truths at the front. Digests-off is just the degenerate case where that's true of every note.

**With digests off the manager still opens, in add-only mode** — there are no AI memories to edit, but notes are independent of the digest system and still ride in context.

---

## 5. Code touch points

| File | Change |
|---|---|
| `src/lib/milestoneMemory.ts` | `resolveMilestoneKeep` / `resolveMilestoneDrop` honor edits (imply keep) and tombstones (imply drop + excluded from candidates) |
| `src/lib/turnBanding.ts` | `buildBandedHistory` reads effective text; splices notes per §4; `importanceFactor` ranks player edits top |
| `src/lib/semanticRehydration.ts` | retrieval indexes effective text, excludes tombstones, includes notes |
| `src/contexts/GameplayContext.tsx` | new state + setters, persisted in the envelope |
| `src/types/gameplay.ts` | the three fields above |
| `src/components/game/MemoryPanel.tsx` | keeps its quick pin ledger, gains a **Manage** button |
| `src/components/modals/MemoryManagerModal.tsx` *(new)* | the manager |
| `src/lib/devRoutes.ts` | entry for the new modal (drift-guard test) |
| `src/lib/helpTopics.ts` | help topic for the manager |

The selector prompt is **unchanged** — this is a data-layer feature. No probe evidence required.

---

## 6. UI — the Memory Manager

Reachable from the **Memory tab's Manage button** only — not the game menu, not the main menu against a save file. The side panel keeps its current quick pin/unpin ledger; the manager is the full surface, not a replacement.

- **Openable while a turn is generating**, edits included. Overrides resolve at read time so nothing races; the in-flight turn has already built its recap, so changes land next turn.
- Chronological list of all memories, turn-derived and manual interleaved, with the existing **Recent** divider preserved. Each row shows its turn number.
- Row: text · state badge (kept / let go / edited / mine) · actions (edit, regenerate, pin, delete).
- Edit is a real textarea with room to breathe — the reason for a modal over the narrow side panel — with the soft character counter.
- **Add memory** button, anchoring at the current turn.
- **Search box + state filter chips**: kept · let go · edited · mine · deleted.
- Edited rows offer **revert to original**, showing the AI's text.
- **Reset all my changes** with a confirm dialog: clears edits, pins, tombstones and notes back to pure AI memory.
- Header line: `N of M moments remembered · K edited · J yours`.
- Mobile: full-height sheet, same content.

---

## 7. Done-state — as run

- [x] Four gates green (typecheck 0 · lint 0 errors · 1856 tests pass · build succeeds)
- [x] Unit tests: `memoryOverrides.test.ts`, 27 cases — resolution precedence (tombstone > edit > pin > verdict) · note splicing per §4 including the digests-off block · notes excluded from selector input · tombstones excluded from selector input · revert target preserved · regenerate does *not* claim importance · oldest-entry guard slides after deletion · no-override path returns the identical array
- [x] Guards bite — three mutations proved failure: tombstone branch removed → 5 fail; regenerate claims top importance → 1 fails; notes dropped from `bandPieces` → 5 fail
- [x] `devRoutes.ts` entry (`memoryManager`) + drift-guard updated and green
- [x] Verified live on the whiteRoom fixture: add → edit (auto-pin lifted kept 2→3) → delete-oldest warning → confirm → restore; mobile 375px, zero clipped controls
- [x] **Wiring proof** — deleting a note moved the context meter's Summary band 78 → 64 tok at an unchanged turn count, so the override layer reaches the assembled request, not just the panel
- [x] `helpTopics.ts` → `game.memoryManager`
- [x] `docs/Changelog.md` In-Progress (👤) + new `docs/Memory.md` wiki page, linked from Home and the sidebar
- [x] Export-shape reminder stated in the response
- [x] `graphify update .` — 3808 nodes, 9499 edges

**Not done, deliberately:** the World Editor author-seeded starting memories (§2, out of scope — world export-shape change) and the player-hint regenerate steer (§2, needs probe evidence).

### Post-implementation review — defects found and fixed

| Found | Why it mattered | Fix |
|---|---|---|
| **Narration edit didn't clear the memory override.** `clearTurnDerived` dropped the digest for rebuild, but `memoryEdits[turnId]` survived and masked the rebuilt digest permanently. | The player rewrites their prose; the memory keeps describing text that no longer exists, silently and forever. The most likely way this feature would have gone wrong in real play. | `GamePanels` drops that turn's override alongside the digest. Verified live: editing turn 8's narration dropped only turn 8's memory edit, leaving turn 1's intact. |
| **Regenerating over a rewrite orphaned the auto-pin.** Regenerate overwrote `source` to `'ai'`, and `revert` only clears the pin when `source === 'player'`. | A keep-pin outlives the intent that set it, on text the player never wrote. | Regenerate clears the pin when it replaces a player rewrite. |
| **Regenerate could fire mid-turn.** The digest/selection drainers all gate on `isWaitingForAI`; this new AI call didn't. | Contends with the live turn. Editing staying live mid-turn was the design call; firing an AI request was not. | Button disabled while a turn is generating, with a tooltip saying why. |
| `isPlayerEdited` exported but only its own test called it. | Dead API. | Removed, with its test.|

**Known, accepted:** notes are exempt from the band's budget trimmer by design (they're not band turns), so a pathologically long note can push the recap exchange over budget. The soft counter warns; there is no hard cap, per the design call in §2. Overrides for turns removed by rollback linger in the save as dead keys — harmless, and the milestone selection's own prune already handles the verdict side.
