# 08: Narration Inventory Chip

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a prompt change that must ship with probe numbers on two models.

## What to build

The narrator knows what people carry. A new prompt chip renders an inventory block: each present owner's equipped items with their AI Summary, carried items by name, and the Item Copies lying at the location, with hidden ones marked hidden (Q25, Q27). Built-in presets gain the chip; user presets are never migrated, and their authors add it from the picker. The block follows the prompt-writing guide: positive contract, no example values. It reads through 02's owner query helper.

Probe Q19: after a panel action, does narration handle the change from state alone, or does a one-time event line help? Settle it with numbers and record the result in the spec.

Spec: Q19, Q25, Q27, Q62; stories 69–72.

## Acceptance criteria

- [x] The chip renders equipped items with AI Summary, carried names, and location items with hidden marked, for present owners only — `inventoryContext.test.ts` (summary, description fallback, carried, location, hidden, absent owners, played entity, runtime skip); mutation-checked
- [x] Built-in presets include the chip; a user preset is unchanged until its author adds it — `GamePrompts.test.ts` token list; `inventoryContext.test.ts` stored-preset case; DOM read of Settings → Prompts → Narration shows **Inventory (Markdown)**
- [x] The chip is empty and adds no text when nobody present has items — `inventoryContext.test.ts`: the narration prompt with and without the chip is byte-equal
- [x] Probe numbers on the cloud default and Cydonia with in-batch controls: the narrator names carried items correctly and does not reveal hidden ones unprompted — `inventory-chip-probe.cli.ts`; numbers in the spec's Narration context
- [x] The Q19 event-line decision is recorded in the spec with its numbers — no event line
- [x] The prompt chips docs page lists the chip; changelog fragment written — `docs/Prompts.md` → The Inventory Chip; `changelog.d/inventory-08.md` and `inventory-08-probe.md`

For you: play a scene with a hidden item and check the narrator doesn't hint at it before you search.

## Blocked by

- 02

## Landed

**Not verified**

- The live game path (GameViewer passing world items and Item Copies to the scene) has no test of its own. Unit tests cover the scene and renderer; the wiring is two props.

**For you**

- Play a scene with a hidden item and check the narrator doesn't hint at it before you search. Look in the AI Context viewer's narration request for the **Items Here** section.
- On the cloud model, a search finds the hidden item 1 time in 12; on Cydonia, 3 in 3. On cloud, the reveal will mostly come from the Inventory pass (09).
- The Open Chat world's narration prompt gained the chip too, as its parity test requires (header **What is here**).
