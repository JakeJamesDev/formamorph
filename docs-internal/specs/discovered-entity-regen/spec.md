# Discovered-Entity Description: Regenerate + Manual Edit — Spec

Runtime-discovered characters (AI-invented, materialized via `runtimeCharacters.ts`) get exactly one
generated description at discovery time, built from only the single passage they first appeared in.
By the time a playthrough is 30 turns deep that description is stale, and if the first roll was bad
there is no recovery. This feature adds, for discovered entities only:

1. **Regenerate** — remake the description using the character's accumulated story context.
2. **Manual edit** — the player rewrites the description by hand.

## Decisions (interview 2026-08-06)

| Question | Decision |
|---|---|
| Surface | EntityModal (the entity popup during play) — both controls live there |
| Scope | Discovered entities **only**; authored entities stay immutable in play |
| Edit model | **Direct overwrite** of the stored description; no override layer, no history |
| Regen apply | **Preview → Keep / Discard** — never silently replaces (no revert exists) |
| Edit UX | Pencil button → textarea with Save / Cancel |
| Regen timing | **Idle only** — disabled while any AI call is in flight |
| Regen context | First passage always + **exactly one** supplemental source by settings priority (below) |
| Prose-fallback cap | First passage + last N appearance passages under a token budget |

## Regen context: the supplemental-source ladder

The regen request always includes the **discovery passage** (the narration turn that first named
them). On top of that, pick the **first enabled** source — one, never stacked:

| Priority | Setting gate | Source |
|---|---|---|
| 1 | `semanticMemory` on | Relevance-retrieved digests, queried by the character (name + current description as the query vector) |
| 2 | `characterDiaries` on | The character's diary entries (already per-character, already relevance-shaped) |
| 3 | `memoryDigests` on | Digest summaries of the turns where the character participated |
| 4 | fallback (always available) | Full narration prose of turns where the character participated |

Appearance detection for 3–4: turns whose parsed `entities[]` matches the character via
`sameCharacterName` (same matcher the discovery pipeline uses).

**Cap (tier 4, and defensively for 2–3):** discovery passage always included, then newest-first
appearance passages until a budget of ~8 passages / ~3k tokens is hit. Log nothing; just truncate.

## Storage & save shape

- The description lives at `discoveredEntities[i].entity.aiDescription` (GameplayContext + save
  envelope). Edit and accepted regen **overwrite that field in place** via a new Gameplay setter
  (`updateDiscoveredEntityDescription(id, text)` or similar).
- **No new save fields.** No `edited` flag — nothing needs it. → **No export-shape change.**
- EntityModal already mirrors `aiDescription` into the player-visible description for discovered
  entities (GameViewer's `selectedEntity` wiring), so one field serves both AI and player views —
  editing it updates both, which is the intent.
- Rollback semantics come for free: `discoveredEntities` rolls back with the turn.

## Request plumbing

- Reuse the `discoverEntity` request type (silent, non-narrated), so sampler resolution and the
  request viewer's "Character" label apply unchanged. No new `promptSamplers.ts` pin decision —
  `discoverEntity` already resolves to the global/creative default, and regen is the same kind of
  writing task.
- New user-message builder (pure, in `runtimeCharacters.ts`): name + discovery passage + the
  supplemental block, using the existing `DISCOVER_NAME_LABEL` / `DISCOVER_PASSAGE_LABEL` scaffold
  plus one new label for the supplemental section (exported, same parrot-cleaning contract).
- Response cleaning: `cleanDiscoveredDescription` as-is, extended to also cut from the new label.
- **Prompt-surface note:** the regen user message is new AI-call text → it falls under
  `docs-internal/notes/prompt-writing-guide/notes.md`; probe the format (does the supplemental block help or
  distract a 12B?) before shipping the prompt wording as final.

## EntityModal UX

Controls render **only when the entity is discovered** (the modal needs a `isDiscovered` +
callbacks prop, or a small wrapper; authored entities see no change).

- **Edit:** pencil button beside the description → textarea in place → Save (writes through the
  Gameplay setter) / Cancel. Empty save = disallowed (keep the old text).
- **Regenerate:** button; disabled while any AI activity is in flight (same idle gates the
  discover drainer uses: `isWaitingForAI`, digest/diary/discover drains) with a tooltip saying
  why. On click: spinner in place → result shown as a **preview** with Keep / Discard. Keep
  writes through; Discard restores the current text. Closing the modal mid-flight aborts the
  request and discards any un-kept preview.
- Edit and Regenerate are mutually exclusive states (entering one exits the other).

## Out of scope

- Authored-entity per-save description overrides.
- Regen/edit history, revert, or an override layer (memory-editing-style) — direct overwrite is
  the decided model.
- Auto-regeneration (e.g. periodic refresh as the story evolves) — manual button only.

## Test plan

- Pure: context-ladder selection (each toggle combination picks exactly one source), appearance
  filtering via `sameCharacterName`, cap behavior, message-builder output, cleaner handling of the
  new label.
- Component: EntityModal shows controls only for discovered entities; edit save/cancel; regen
  preview Keep/Discard paths; disabled-while-busy state.
- Wiring: accepted regen / saved edit actually lands in `discoveredEntities` state (GamePanels-style
  harness), and the next AI context reflects the new description.
