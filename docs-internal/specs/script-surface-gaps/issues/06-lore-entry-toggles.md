# 06: Lore Entry Toggles

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the ticket builds the lore overlay and threads it through every in-play lore reader, and it owns the overlay ticket 07 builds on.

## What to build

The game state gains a lore overlay: a map of toggles keyed by book id plus entry id, which undo rewinds (Q11). Every reader of in-play lore reads the books through it: the narration prompt, the planner, the Tool snapshot, the semantic dictionary, the scripts' map, the stats re-roll's pre-turn reset and the Before the AI undo. A Before the AI write shapes this turn's prompts through the code view, and an After the AI write shapes the next turn's (Q16). A During AI Output write lands with the After the AI batch (Q23). `dictionaries.X.entries` lists disabled entries with `enabled: false` (Q12), and editor completions, checks and hover cards list them too. When entries share a name, an enabled entry takes it, then the later one (Q26). Entry `enabled` and `constant` take writes (Q13). An entry a script enables or whose `constant` it clears gets its vector queued without waiting (Q28). User Tools see disabled entries and stay read-only (Q27). The Scripts guide and the Tools guide cover the change.

The overlay's shape includes book-level toggles for ticket 07, which adds the book reads and writes.

Spec: Q11–Q13, Q16, Q23, Q26–Q28, stories 26–33, 39.

## Acceptance criteria

- [ ] A Before the AI write switching a disabled entry on puts its value in this turn's narration request when its keyword matches
- [ ] An After the AI write reaches the next turn's request and not this one's
- [ ] A `constant = true` write injects the entry with no keyword match
- [ ] Undo after the turn restores the entry's earlier state in the next request
- [ ] A stats re-roll starts from the pre-turn lore state
- [ ] `dictionaries.Lore.entries.Hidden.enabled` reads false for an authored-disabled entry; a book with an enabled and a disabled entry of one name resolves to the enabled one, and a write reaches it
- [ ] An enabled entry gets an embedding job queued, and the turn does not wait for it
- [ ] A user Tool lists disabled entries, and its writes list as dropped
- [ ] Editor completions and hover cards list disabled entries

Remind the user in the landing: the overlay is an additive save-shape change.

## Blocked by

- None (can start immediately)
