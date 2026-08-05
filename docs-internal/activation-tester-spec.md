# Activation Tester — Spec

Companion to [world-authoring-feature-notes.md](world-authoring-feature-notes.md), where this ranks first.

---

## 1. The problem

**Two of the app's most powerful authoring systems are invisible until mid-session.**

When an author writes a dictionary entry or an entity alias, they are writing a *matching rule* — and the editor shows them no evidence that the rule does what they think. The first feedback arrives during play, buried in a turn, as an absence: lore that didn't inject, a character the AI forgot was standing there.

Three failure classes, all found in a "finished" world during this rework:

| Class | Real example | Why the editor couldn't show it |
|---|---|---|
| **Silent half-failure** | 14 aliases began with "the". Matching is case-sensitive, so they missed at the *start of a sentence* — where narration puts them constantly. Presence detection worked ~half the time for eleven characters. | Nothing in the editor renders a match attempt |
| **Cross-entity collision** | Bramble's alias `the visitor` lost to Farm Visitors' `visitors` under plural-tolerant matching. **She was undetectable by her own alias.** | Aliases are authored per-entity; collisions are only visible across the whole cast |
| **Inverted logic** | `secondaryExclude` fires only when a keyword is *absent*. Authoring one blind is close to guesswork. | The condition has no observable behavior anywhere in the editor |

Every one of those was found by writing throwaway vitest harnesses. **Five separate times.** An author has no equivalent — the honest current answer is "start a game and see."

### Why existing surfaces don't cover it

- The **in-game AI-context popup** shows activation, but only for a turn that already happened, in a world already published, one scene at a time.
- The **stat-code tester** proves the precedent — a "run it and show me" affordance already exists for the other executable authoring surface. Matching has none.

---

## 2. What it does

A panel where an author pastes prose and immediately sees **what would fire, and why it did or didn't.**

Critically, it reports **non-activations with their near-miss reason**, not just a list of hits. "Office Window did not fire: keyword `office` matched, but secondary `watching` is present and the entry excludes it" is the sentence that makes `secondaryExclude` authorable.

It runs the real engine. No parallel implementation, so the tester can never disagree with play.

---

## 3. Reuse map

Almost all of it exists:

| Need | Existing |
|---|---|
| Per-entry activation + evidence | `explainActivation(entries, scene, { history })` → `ActivationReport` with `activated`, `reason`, `hits` (keyword, matchedText, region, start/end), `secondary` (`keywords`, `requireAll`, `exclude`, `present`), `rule` ([dictionaryUtils.ts:206](../src/lib/dictionaryUtils.ts:206)) |
| Highlighted text with clickable chips | `locateMatches` → `MatchSegment[]` ([dictionaryUtils.ts:317](../src/lib/dictionaryUtils.ts:317)) — already drives the in-game popup |
| The injected block, as the AI receives it | `buildDictionaryContext(entries)` |
| Entity presence | `findEntityNames(text, entities)` ([entityMatch.ts:126](../src/lib/entityMatch.ts:126)) |

**New work is the panel and the explanation strings.** `ActivationReport` already carries every fact the UI needs to say *why*.

One genuine gap: entity matching returns names, not spans or which alias hit. Presence highlighting needs `matchNames` to surface the matched alias and offset, or a thin wrapper that does.

---

## 4. UX

### Placement — a docked panel

A **right-hand dock in the World Editor**, toggled from the header, persisting across tab switches. Not a modal: the point is to edit an alias or a secondary key and **watch the result change without losing the test text**. A modal forces close → edit → reopen → retype, which is the loop that made this hard in the first place.

The dock hosts tabs, so the World Doctor lands beside it later rather than claiming its own surface (see [world-doctor-spec.md](world-doctor-spec.md)).

Implementation notes: the editor already uses `react-resizable-panels` (`Panel`/`PanelGroup`/`PanelResizeHandle` in `WorldEditor.tsx`), so the dock is another panel rather than new layout machinery. On mobile it should fall back to a sheet — the editor already has a mobile path. Add a `devRoutes` entry so it's reachable in one `goto`.

### Layout

Two columns, input left, results right.

```
┌─ Test Activation ─────────────────────────────────────────────┐
│ SCENE TEXT                      │ ENTITIES PRESENT (3)         │
│ ┌───────────────────────────┐   │  ● Bellamy      "The alpha"  │
│ │ The alpha shouldered past │   │  ● Centaur Mare "mare"       │
│ │ her at the barn door...   │   │  ● Juniper      "Juniper"    │
│ └───────────────────────────┘   │  ⚠ 2 entities matched the    │
│                                  │    same span — see details  │
│ ▸ History (optional)             │──────────────────────────────│
│ ▸ Player action (semantic)       │ DICTIONARY            4 / 9  │
│                                  │ BACKGROUND                   │
│ [Paste last turn]  [Clear]       │  ✓ Anatomy        constant   │
│                                  │ FOREGROUND                   │
│ Highlighted preview:             │  ✓ The Serum      "injection"│
│  The ⟦alpha⟧ shouldered past her │  ✓ Schedule       "queue"    │
│  at the ⟦barn⟧ door...           │  ✗ Office Window  suppressed │
│                                  │  ✗ Tours          no match   │
│                                  │──────────────────────────────│
│                                  │ [Entries] [Rendered context] │
└───────────────────────────────────────────────────────────────┘
```

### Interactions

**Live re-evaluation on input**, debounced. Matching is synchronous and cheap; there is no reason to make the author press a button.

**Every row expands to its evidence:**

- ✓ *fired* — reason badge (`constant` / `keyword` / `recursive` / `semantic`), the matched keyword, the literal matched text, and the region (`scene` / `history:2` / `recursion:<entry>`)
- ✗ *did not fire* — **the near-miss reason**, which is the whole point:
  - `no keyword matched`
  - `keyword "office" matched, but secondary [watching, watched] is present and this entry excludes it` ← the one that makes inverted secondaries authorable
  - `keyword matched only in history beyond scanDepth 6`
  - `matched "reinjected" as a substring, but whole-word matching is on`
  - `entry is disabled` / `its book is disabled`

**Clicking a highlight in the preview** opens the same evidence popover — reusing the in-game chip behavior, so one mental model covers both.

**Rendered context tab** shows the block exactly as the AI receives it via `buildDictionaryContext`, with a token estimate. Answers "what is this costing me per turn", which nothing currently does.

**`Paste last turn`** pulls narration from the most recent save of this world, when one exists. The best test corpus is real output.

### Inline warnings — the shared rule engine

These come from **the same `lib/worldRules.ts` engine the World Doctor runs**, filtered to the matching-related rules and rendered inline. One implementation, surfaced twice — see [world-doctor-spec.md §8](world-doctor-spec.md). Quick fixes are the rule's own `fix()`, so a repair offered here is identical to the one offered there.

Surfaced in this panel because it's where an author is already thinking about matching:

- ⚠ **Alias begins with "the"** — case-sensitive matching means it misses at sentence start. *(would have caught all 14)*
- ⚠ **Two entities matched the same span** — name the pair. *(would have caught Bramble)*
- ⚠ **Entry can never fire** — every keyword is empty, or secondary keys with no primary.
- ⚠ **Alias equals the entity's own name** — redundant.

Each links to the offending item in the editor.

### Empty and error states

- **No text yet** — show only `constant` entries with the note that these inject on every turn regardless. That alone is useful.
- **Nothing fired** — say so plainly, plus "N entries were checked", so silence reads as a result rather than a broken panel.
- **Invalid regex** on a `useRegex` entry — flag the entry inline rather than failing the run.

---

## 5. Scope

**In:** dictionary activation (all controls: constant, secondary any/all/exclude, regex, whole-word, case, scanDepth, recursion), entity presence, rendered context + token estimate, inline warnings, history and player-action inputs.

**Out of v1:**

- Not a turn simulator — no AI call, no stat changes, no narration.
- **Semantic activation** needs the embedding index; include only as an explicitly-labeled toggle when a semantic index exists, since it can activate entries keywords never would. Never quietly on — it would misattribute a keyword author's results.
- **Saved scenarios.** Persisting test snippets *in the world* is export-shape-visible and would ship an author's scratch text to players. If wanted later, store them locally, keyed by world id — not in the world.

---

## 6. The PC selector

A `Testing as: [Breeder ▾]` control at the top of the dock, listing the traits of any exclusive group. It does two things:

**Resolves placeholder chips through that trait's `placeholderPins`.** Select *Breeder* and the breeder's name resolves to the pinned `Juniper`; select *Sarah* and it rolls, exactly as a real playthrough does. This makes a mis-authored pin visible — a pin naming a value that isn't in the placeholder's list is currently a silent no-op with no surface anywhere.

**Shows which stats that trait switches on**, from its `statToggles`. Verifying the per-PC stat wiring in this world otherwise required starting a game; here it's a glance.

Deliberately *not* a full turn preview (no live descriptors, no assembled prompt). The tester stays a matching tool with enough trait context to be honest about what each PC actually sees.

---

## 7. Resolved decisions

| Question | Decision |
|---|---|
| Modal or docked? | **Docked panel** — edit and test without losing the test text |
| Placeholder chips | **Resolve via the PC selector's pins** (§6) |
| Entity match spans | **Extend `entityMatch` to report spans and the matched alias properly**, rather than re-deriving them in the tester. A second matching path would drift from the real one — the same reasoning behind the shared rule engine — and the game's own presence UI benefits too |
| Entries in a disabled book | **Shown greyed, labeled "book disabled"** — a book you forgot you toggled off is otherwise an invisible cause of missing lore |
