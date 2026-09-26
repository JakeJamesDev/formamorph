# 04: Recall Tool, Lexical

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new lookup source that touches the snapshot builder, the memory override layer, the verbatim floor, and rollback; wrong reads here leak deleted memories to the AI.

## What to build

The AI calls `recall` with a few words and gets up to five matching memories, oldest first, each with its turn number. The Tool searches each committed turn's digest as the player sees it after Memory Manager edits and deletes, plus each diary entry with its character. It never returns hand-written memories, per-turn scene notes, "nothing notable" entries, or turns inside the verbatim floor. A rolled-back turn no longer matches. The `memories` source is catalog-only: the Search picker does not offer it and import rejects it, so the stored Tool shape is unchanged. The locked editor shows the Memories label. Try It with no world open searches sample memories.

## Acceptance criteria

- [ ] `recall` listed on every preset, default off, locked, Offered To narration
- [ ] Snapshot carries a frozen memory list built from committed history through the override layer, with the verbatim floor removed
- [ ] Lexical match rule and tie order as specified; output shape matches the spec
- [ ] Tests: digest hit, diary hit with character, floor turn skipped, kept milestone outside the floor matches, rewritten digest found by new text only, deleted digest never matches, hand-written memory never matches, five-match limit, oldest-first order, "nothing notable" skipped, no digests, rolled-back turn gone
- [ ] Import of a Tool with the `memories` source is rejected
- [ ] The script surface is unchanged
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
