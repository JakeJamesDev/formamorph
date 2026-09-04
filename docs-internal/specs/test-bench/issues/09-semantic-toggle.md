# 09 — Semantic toggle

**What to build:** When the semantic memory feature has an embedding index for the world, Triggers
offers an explicit semantic toggle. On, each dictionary entry additionally shows its cosine
similarity score against the pasted text next to the activation threshold, and entries that would
activate semantically but not by keyword are labeled as such. Off (or no index), nothing semantic
renders anywhere — semantic results must never be attributable to keyword matching. The toggle is
disabled with a why-note when the index doesn't exist.

**Blocked by:** 07 — Triggers tracer.

Status: done

- [x] Toggle only enabled when the world's embedding index exists
- [x] Scores rendered as score-vs-threshold, never as a bare yes/no
- [x] Semantic-only activations visibly distinguished from keyword activations
- [x] Toggle off → zero semantic computation runs (no background embedding)

**Built:** `lib/testBench/semantic` is the pure seam — `traceSemantic(entries, {queryVec, vectors, threshold,
cap})` hands activation to the game's `selectSemanticLore` and adds only the scores play never computes, as
`activates` / `capped` / `below` / `unindexed`; `describeSemantic` is the row's sentence. `buildTriggerReport`
takes `opts.semantic`, folds it with the game's `applySemanticLore`, and carries `report.semantic` +
per-entry `semantic`. `useTriggerSemantics(active, enabled, world, text)` owns both async halves.
`SemanticToggle` in `TriggersInstrument` renders it; `WorldEditor` holds the on/off state beside the scene text.

**Decisions taken here:**

- **"Index exists" is a cache read, not a setting.** `getVectors(semanticIndexKeys(world))` returning anything
  is what enables the toggle — the vectors the semantic-lore drainer cached while the world was played. The
  probe runs with the toggle off because its answer is what decides whether the toggle can be turned on; it
  performs no embedding, which is what "zero semantic computation" means here.
- **The Bench never builds an index.** Embedding a world's dictionary in the background is exactly the quiet
  cost the toggle exists to make visible, so the disabled state says how to build one (play once with Semantic
  Lore on) rather than offering a button.
- **Activation is `selectSemanticLore`'s answer, unchanged** — including its cap, which is why `capped` is its
  own state: a bare score would say an entry fires when the cap is what kept it out.
- **A semantic firing joins the rendered block.** With the pass on, that block *is* what would be injected;
  showing the keyword-only block beside semantic rows would be the tab disagreeing with itself.
- **A vector belongs to one text.** `input` is withheld the moment the scene text changes, so the scores blank
  and return rather than aging onto prose they were not computed for. Costs a flicker; the alternative is a
  wrong number.
- **Off is not remembered.** The toggle resets every time the editor opens — a semantic run that came back on
  by itself is precisely how an author would read a semantic firing as proof their keywords work.
- **The instrument's semantic state is derived, not stored:** `entry.semantic` and `report.semantic` are both
  absent on a keyword-only run, so the panel is structurally unable to print a score it did not compute.

**Caught in review, fixed here:**

- **The index probe hashed the authored entry, play hashes the resolved one.** The drainer embeds
  `useResolvedWorld()`'s dictionary, and `resolveDictionaryEntryNames` resolves the name and the keywords
  (never the value) before `entryVectorKey` sees it — so any entry with a chip in either named a vector the
  cache never stored and read `unindexed` forever, and a wholly chipped dictionary left the toggle disabled
  beside a real index. `asEmbedded` now mirrors that resolution exactly. A Wildcard still can't match: play
  hashes what that playthrough rolled, and an author has no roll — reported honestly as `unindexed`.
- **Turning the toggle off left scores on screen for a debounce.** `useDebouncedTriggerReport` re-traces
  immediately when the semantic input is withdrawn; only arrivals are debounced.
- **A failed embed stuck.** `failed` is keyed to the `{key, text}` it happened on, so "could not be reached"
  can't sit over text that is right then being embedded successfully.
- **The index key was hashed behind a closed Bench.** The memo is gated on `active`; a keystroke elsewhere in
  the editor no longer content-hashes the whole dictionary to answer a question nobody asked.
- **A semantic firing swallowed its keyword diagnosis.** `classify` still runs for `reason: 'semantic'`, so
  the row that fired *without* the author's matching rules also says which rule missed and why.

**Known divergences from play, by design:**

- **The query text.** Play embeds the player's *action*; the Bench embeds whatever is in the scene box, which
  Paste Last Turn fills with the previous turn's narration (ticket 08's framing of that box). The keyword half
  has the same property, so the two halves at least agree with each other.
- **The entry set.** Play scores the playthrough's dictionary; the Bench scores every enabled book.
- The scored states are covered by component tests over real reports, not by a live check — a live one needs a
  populated embedding index plus a model download in the browser. The disabled default state was verified in
  the preview (`#dev?modal=worldEditor&bench=triggers`).
