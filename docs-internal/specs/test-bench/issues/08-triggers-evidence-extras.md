# 08 — Triggers evidence extras

**What to build:** Triggers grows the surrounding evidence. A rendered-context view shows the
injected dictionary block exactly as the AI receives it, with a ~token estimate. Paste-last-turn
pulls narration from the world's most recent save when one exists. An optional history input feeds
scan-depth-sensitive entries. Inline warnings appear beside results — leading-article alias,
same-span entity collision, can-never-fire entry, alias-equals-name — produced by the same rule
engine Issues runs (matching-related subset) with the same one-click fixes, so a repair offered here
is identical to the one offered there.

**Blocked by:** 03 — Quick fixes · 07 — Triggers tracer.

Status: done

- [x] Rendered context is byte-identical to what the game would inject for the same entries
- [x] Token estimate always displayed with the ~ prefix
- [x] Paste-last-turn absent (not disabled-broken) when the world has no save
- [x] Inline warnings come from the shared engine — no second rule implementation, fixes identical to Issues
- [x] History region hits labeled with their turn distance and scan-depth verdict

**Built:** `TriggerReport` grew `rendered` / `renderedTokens` / `historyCount`; `describeHitOrigin` pairs a hit's
distance with the entry's own `scanDepth`; `splitHistory` turns the new History box into the `history` array;
`lib/testBench/lastTurn` reads the world's newest save (`pickLatestSave` + `lastTurnFrom`, pure; `loadLastTurn`
the IndexedDB wrapper). Inline warnings are `selectMatchingFindings` over the pass the editor already ran —
`Rule.matching` marks the five, and Fix is the same `applyRuleFix` the Issues row calls.

**Decisions taken here:**

- The rendered block is `buildDictionaryContext(entries, false)` — the exact call `buildNarrationPrompt` makes
  for a `<DICTIONARY>` chip — with both `position` blocks shown separately. The Bench has no prompt template, so
  it cannot know whether the active prompt carries a `before` chip; showing both, labeled, is the honest answer.
- Chips in rendered lore resolve through `describePlaceholders`, not a playthrough's rolls: an author has none,
  and a Wildcard's summary is the truth about text decided at play time.
- `dictionary-regex-invalid` is deliberately *not* in the matching subset — the tracer already flags a broken
  pattern from the matcher's own compilation, and the rule would state it twice on one row.
- `TriggerEntry.scanDepth` now carries the entry's window on every row, not just on `beyond-scan-depth`; a fired
  history hit needs it to state its verdict.
- Paste Last Turn takes the last *assistant* message as the scene (a trailing player action is not the turn) and
  the ten before it as history.
- **Messages in the history box are separated by a `---` line, not a blank line.** Narration runs to several
  paragraphs, so a blank-line separator cut one pasted turn into several and every distance and scan-depth
  verdict measured from them was wrong. `joinHistory`/`splitHistory` are the pair; the round-trip is tested.
- Triggers reads `useBenchFindings`' live groups, not the raw pass, so a rule dismissed on Issues stops nagging
  on both tabs.
- A warning whose item earned no row is listed above the results rather than dropped: an articled alias is
  precisely why its entity went undetected, so hanging it on a row the entity failed to earn would hide it.
- `Foldaway` is local rather than the shared `CollapsibleSection` — that one is sized for editor forms and two
  of them cost this panel more height than its content. Same call the bench's own dismissed-rows fold made.

**Known variance from byte-identity:** a prompt with *no* `<DICTIONARY>` chip gets the legacy code append, which
carries a `## Foreground Lore` heading through `restyle`; the Bench shows chip-shaped bodies (the modern path)
and supplies the label itself. An empty block also renders as `N/A` in the real prompt, where the Bench says
nothing fired — the section exists either way, and neither wording claims otherwise.
