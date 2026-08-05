# Inventory — an authored collection, not a stat type

**Status:** design proposal, nothing implemented. Supersedes the removed `list` stat type. Needs a user decision on export-shape versioning before any code lands.

**Tracked from:** the Parked list in [narration-quality-todo.md](docs-internal/narration-quality-todo.md), where it's the structural answer to the "possessions established in passing" and "vague inventory" findings.

**Problem:** there is no structured record of what the player carries. Items live only in narration prose, so the model re-infers them every turn from whatever text survives in context — and gets them wrong. [semantic-memory-roadmap.md:133](docs-internal/semantic-memory-roadmap.md:133) already reaches for "a keyed inventory the narration model can see"; `src/notes/TODOOLD.md:11` lists it bare.

---

## 1. What was there, and why it was removed

Upstream v1.1 shipped a third stat type, `list`, whose `value` was an array of `{ id, name, description, number }`. It arrived commented out of the type dropdown in the very first commit and was never reachable. Removed in full — the type, `StatListItem`, and the editor block — after tracing every runtime path.

The removal was **not** because the idea is bad. It's because a stat was the wrong container:

| Stat affordance | Meaning for a list |
|---|---|
| `min` / `max` | nothing — an item count isn't a bounded scalar |
| `regen` | nothing; and if authored non-zero it corrupted the array to `NaN` on turn 1 |
| `descriptors` (threshold bands) | nothing — the band lookup divides by the range, so it never fired |
| `code` (QuickJS) | must return a number; can't express items |
| `morphBindings` | nothing |
| AI stat-update channel | `Name: ±N` deltas only — no way to add or remove an item |

Every scalar path (`buildStatContext`, `applyAiStatChanges`, regen, `statBackfill`, the stat panel) did arithmetic on the array and produced `NaN`, which then serialized to `null` on save. Finishing it in place would mean a "not for lists" branch in each of those, forever, and one more branch for every stat feature added later — morph bindings and story-clock code both landed after `list` was written.

The item shape gives the game away: `{ name, description, number }` is an entity-lite, not a measurement.

---

## 2. The shape worth building

A top-level authored collection alongside stats / traits / dictionaries, with its own editor panel, its own play-panel surface, and its own AI mutation channel.

```
InventoryItem {
  id, name, description       // description is the AI-facing "what this is"
  quantity: number
  tags?: string[]             // for filtering / conditional prompt injection
}
```

Open questions, all real design decisions rather than implementation detail:

- **One inventory, or per-entity?** Per-entity is strictly more expressive (an NPC's pack, a room's contents) and strictly more prompt budget. Start with the player's.
- **Authored starting set vs runtime-only.** Needs both, and — the lesson from `list` — they must be **separate fields**. The authored roster is world data and immutable during play (hard constraint #5); the live roster is save state. `list` failed partly because both lived in the same `value`.
- **Does the AI see quantity, or a fuzzy descriptor?** Exact numerals are parrotable; see the prompt-writing guide's stance on values the model echoes into prose.

---

## 3. The expensive parts (identical either way)

These are why the stat-embedded version was no cheaper — the editor UI is the only piece the old code provided, and it'd be rewritten against a non-stat model anyway.

1. **The AI mutation channel.** An add / remove / adjust-quantity protocol: prompt text asking for it, a parser, an applier, and a reconciliation rule when the model invents an item it never picked up. This is a prompt-surface change — per [prompt-writing-guide.md](docs-internal/prompt-writing-guide.md) it ships with A/B probe numbers on both tiers, not one good-looking completion.
2. **Prompt rendering** — an inventory block in `buildContextValues`, with a chip + format variants matching how stats/locations render today, and a budget rule for a long roster.
3. **Play-panel surface** — most likely a fourth tab beside Stats / Traits / Location.
4. **Save + export shape** — a new authored `inventory` array in the world JSON and a live roster in the save envelope. Both are export-shape-visible and gated on a user version decision.

**Rough order:** data model + editor → prompt rendering (read-only; the model sees the inventory but can't change it) → probe → mutation channel → probe. The read-only half is independently useful and is most of the value in the roadmap note.

---

## 4. Migration note (already landed)

[version.ts](src/lib/version.ts) `coerceLegacyListStats` retypes any surviving `type: 'list'` stat as a `number` seeded at its floor, dropping the items. No bundled world used one, so this only affects third-party v1.1-era worlds — where the stat was already producing `NaN` in play, so nothing working is lost.
