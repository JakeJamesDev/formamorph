# 01: Chip Values On Demand

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prefactor under every prompt request, the Preview tab, Tools, Test Bench and the probe harnesses; a missed reader drops a chip's value in play.

Parent: [Chip Options spec](../spec.md)

## What to build

Chip values come from a lazy source over a scene, looked up by token key and memoized, instead of a pre-rendered map of every option combination. No new piece exists yet; this ticket changes how today's values are produced, with byte-equal output.

- The source decodes a token's selection and renders that value on first lookup. Two placements with the same key share one value.
- Every reader keeps working through the lookup: prompt requests and the user-message templates, the Settings preview pool, Tool templates and the Tool snapshot, Test Bench, the dictionary scan corpus, the stat request merge, the World Editor, and the probe harnesses that enumerate variant ids today.
- The Settings preview pool reads live values first. An in-game token the live source has not rendered yet renders from the live scene, never from the sample world.
- The Stats chip's stat-pass override keeps working: the request's keyed names still reach the chip.
- The drift guard that asserts a value for every registry variant is replaced by a guard that every token a prompt can spell renders.

Rulings: Q5, Q7. Prior art: the earlier prefactor that proved byte-equal request bodies against recorded history.

## Acceptance criteria

- [ ] Default prompts send byte-identical request bodies before and after this ticket, proven against recorded history.
- [ ] A token with any combination of today's ids renders in Preview and in a live turn.
- [ ] An in-game Preview of a token never shows the sample world's value.
- [ ] Tool templates, Tool snapshots, Test Bench and the dictionary scan read the same values as before.
- [ ] The probe harnesses run.
- [ ] The stat pass still names stats by their request keys in the Stats chip.
