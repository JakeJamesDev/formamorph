# 05: Persona Block in the Test Bench

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one new row in the AI Context lens's block table, rendered by the existing Context Blocks list, with the lens tests as prior art.

Parent: [Player Character Block spec](../spec.md)

## What to build

The Test Bench AI Context panel lists the context blocks the chips send. After ticket 03 the Custom Persona entity's traits and stats travel in the Persona chip, and the Bench's Stats block shows world stats only (Q21). An author who gave the Custom Persona entity stats sees them nowhere in the Bench.

The panel gains a **Persona** block, listed before Stats and Traits as the default prompts now order them, rendering the Persona chip's Markdown value for the authored scene: the Custom Persona entity's block with its traits and stats under the None rule (Q16). A world with no Custom Persona entity shows the block as having nothing to send, as an empty block already reads.

## Acceptance criteria

- [ ] Through the AI Context lens: a world with a Custom Persona entity that owns traits and stats yields a Persona block whose text equals the Persona chip's Markdown value for that scene; a world without one yields a Persona block with nothing to send.
- [ ] The Persona block sits before Stats and Traits in the block order, and the "have something to send" count includes it.
- [ ] The panel renders the block in the Context Blocks list with the same expand and collapse behavior as its neighbors, verified through the dev-router preview.
- [ ] Changelog fragment written.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
