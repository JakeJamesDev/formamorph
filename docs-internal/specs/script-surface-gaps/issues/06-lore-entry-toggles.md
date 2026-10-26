# 06: Lore Entry Toggles

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the ticket builds the lore overlay and threads it through every in-play lore reader, and it owns the overlay ticket 07 builds on.

## What to build

The game state gains a lore overlay: a map of toggles keyed by book id plus entry id, which undo rewinds (Q11). Every reader of in-play lore reads the books through it: the narration prompt, the planner, the Tool snapshot, the semantic dictionary, the scripts' map, the stats re-roll's pre-turn reset and the Before the AI undo. A Before the AI write shapes this turn's prompts through the code view, and an After the AI write shapes the next turn's (Q16). A During AI Output write lands with the After the AI batch (Q23). `dictionaries.X.entries` lists disabled entries with `enabled: false` (Q12), and editor completions, checks and hover cards list them too. When entries share a name, an enabled entry takes it, then the later one (Q26). Entry `enabled` and `constant` take writes (Q13). An entry a script enables or whose `constant` it clears gets its vector queued without waiting (Q28). User Tools see disabled entries and stay read-only (Q27). The Scripts guide and the Tools guide cover the change.

The overlay's shape includes book-level toggles for ticket 07, which adds the book reads and writes.

Spec: Q11–Q13, Q16, Q23, Q26–Q28, stories 26–33, 39.

## Acceptance criteria

- [x] A Before the AI write switching a disabled entry on puts its value in this turn's narration request when its keyword matches — `GameViewer.loreToggles.test.tsx` "puts an entry a Before the AI script switches on…"
- [x] An After the AI write reaches the next turn's request and not this one's — same file, "keeps an After the AI write out…"
- [x] A `constant = true` write injects the entry with no keyword match — same file, "injects an entry made constant…"
- [x] Undo after the turn restores the entry's earlier state in the next request — same file, "restores the earlier lore state… after a rewind"; `GameplayContext.codePins.test.tsx` save/load round trip
- [x] A stats re-roll starts from the pre-turn lore state — same file, "starts a stats re-roll from the pre-turn lore state" (mutation-checked)
- [x] `dictionaries.Lore.entries.Hidden.enabled` reads false for an authored-disabled entry; a book with an enabled and a disabled entry of one name resolves to the enabled one, and a write reaches it — `statCodeTurn.dictionaryEntries.test.ts` (Q12, Q26, Q49 cases)
- [x] An enabled entry gets an embedding job queued, and the turn does not wait for it — `GameViewer.loreToggles.test.tsx` two Q28 cases (the entry's batch never answers; an entry enabled mid-drain queues when the drain ends)
- [x] A user Tool lists disabled entries, and its writes list as dropped — `toolRunner.test.ts` "lists a disabled entry as off… (Q27)"
- [x] Editor completions and hover cards list disabled entries — `codeCards.worldItems.test.ts`, `statCodeVariableTree.test.ts`

Remind the user in the landing: the overlay is an additive save-shape change.

## Blocked by

- None (can start immediately)

## Landed

**Not verified**
- None of the criteria. No live play in the browser; every check is a jsdom or node test.

**For you**
- Save shape: `GameState.loreToggles` (the overlay) and an optional `lore` list on the saved World Tool trigger-write row (Q50). Both are additive.
- `dictionaries.X.entries` shipped in v3.4.0 without disabled entries. The changelog entry says scripts now see them; the Tools guide tells old `world.dictionary` scripts to filter on `enabled`.
- The planner reads no lore (only the narration prompt fills the dictionary chip), so the spec's "the planner" reader needs no change.
- For ticket 07: the Tool snapshot's built-in lookup (`world.dictionary`) reads the world's authored books, not the playthrough's, so a library book added at world entry never reaches it. Q39 makes that reachable.

