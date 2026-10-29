# 09: Inventory Pass

Status: done
Blocked by: 06, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

Opus at xhigh: a new AI pass with a schema, a text fallback, a new parser, presets, samplers and routing, plus two prompt changes that need probes.

## What to build

The story changes the inventory. A new post-narration **Inventory pass** is due when the world has authored items or the game has Item Copies (Q37). It joins the parallel batch under Concurrent Turn Requests. Its request lists the present owners' Item Copies and the location's Item Copies, hidden ones marked hidden (Q38), and asks for operations through a JSON schema: gain, lose, transfer, equip, unequip, consume and reveal (Q23).

On a schema refusal it uses the shared refusal handling and remembered per-endpoint text mode, with its own text prompt, text line format and parser (R2). It gets prompt-preset keys for its system and user prompts, a sampler entry that pins temperature and penalty, and per-prompt Native Reasoning and endpoint routing.

Parsed operations go to the Inventory module with the source `pass`. A name matches an authored item ignoring case and surrounding spaces, on resolved names; an unmatched name reuses an earlier runtime item of that name or creates one, Stackable and Consumable with no slot and no effects (Q24, Q36, Q56). Inventory changes commit before stat-pass deltas, and the stat pass prompt gains a line stating the turn's item effects are already applied (Q53).

Spec: R1, R2, Q18, Q22, Q23, Q24, Q36, Q37, Q38, Q53, Q55, Q56, Q62; stories 25, 54–68.

## Acceptance criteria

- [x] A world with no items and no Item Copies never sends the pass (`turnPasses.test.ts` "is due only in a world with items or Item Copies"; `inventoryDue` in GameViewer's `turnSettings`)
- [x] With Concurrent Turn Requests on, the pass runs in the parallel batch (`turnRunner.test.ts` "dispatches the Inventory pass in the post-narration batch")
- [x] Each of the seven operations applies through the module; an invalid one is skipped with a diagnostic (`pass.test.ts` "applies each of the seven operations", "skips an invalid operation")
- [x] A schema refusal falls back to the text prompt and parser, and the endpoint is remembered as text mode (`requestTransport.test.ts` "sends the Inventory pass its text request"; `turnPasses.test.ts` "sends the text request alone")
- [x] "iron sword" matches the authored Iron Sword; "rusty key" twice makes one runtime item; "iron swords" does not match (`pass.test.ts`, mutation-tested)
- [x] An entity discovered this turn can receive a transfer (`pass.test.ts` "gives an item to an entity the turn discovered")
- [ ] Inventory changes commit before stat deltas
- [x] Preset keys, sampler pins, Native Reasoning and endpoint routing exist for the pass and export with settings (`inventoryPrompt`/`inventoryUserPrompt` in `PROMPT_TEXT_KEYS`; `inventory` pin; `inventory` in `PROMPT_REQUEST_KINDS` and the prompt rail, whose generic tests cover every kind)
- [x] Probe numbers on the cloud default and Cydonia with in-batch controls: operation accuracy on a fixed scene set, and the stat pass no longer double-adds a drunk potion's effect (`inventory-pass-probe.cli.ts`; numbers in the spec's Stat pass change notes; Cydonia still double-adds, see For you)
- [x] The guide pages for the turn and for items describe the pass; changelog fragment written (How-to-Play "When the story changes your items", World-Editor-Items "Items in the story", Prompts table; `changelog.d/inventory-09.md`, `inventory-09-probe.md`)
- [ ] Discarding an unpaired user turn and the stats-only re-roll restore Item Copies the pass wrote (from ticket 02's landing)
- [x] A re-roll of a turn that consumed an item restores its running timed effects; a test drives it (from ticket 06's landing) (`GameplayContext.itemCopies.test.tsx` "bring back the turn's running timed effects and runtime items")
- [x] The panel lists runtime items, and a runtime item gets the Use button (the `consume` op already accepts them; from ticket 06's landing) (`GamePanels.inventory.test.tsx` "lists a runtime item by name and uses one")

For you: play a few turns that pick up, give and drink items and check the panel follows the story.

## Blocked by

- 06
- 07

## Landed

**Not verified**

- Inventory changes commit before stat deltas: the order lives in `applyTurnCommit` (GameViewer), which no test drives. `landInventoryPass` runs before `applyStatChanges` and hands it the post-inventory state as its base.
- Discarding an unpaired user turn and the stats-only re-roll restore Item Copies the pass wrote: the re-roll half is tested (`GameViewer.inventoryPass.test.tsx` "replays the pass and the After the AI script's item write once each", mutation-checked by removing the restore). The discard half rests on reading: the pass lands only inside `applyTurnCommit`, after the narration lands, so no discard can follow it; ticket 11's `turnStartItemsRef` restores the before-box writes.

**For you**

- Play a few turns that pick up, give and drink items and check the panel follows the story.
- On Cydonia the stat pass still double-adds a drunk potion's effect: the item line changes nothing there (3/3 with and without it). Cloud: 12/12 → 0/12.
- On Cydonia, text-mode pass accuracy is 14/21 (schema mode 18/21). Cloud text mode is 84/84.
- The Inventory request shows the shared sparkles glyph in the status strip; judge whether it wants its own.

**Notes**

- ⚠️ Save shape: `GameState.runtimeItems` and `AITurnResult.inventoryOps` are new, additive fields.
- The pass fires item timings (ticket 11's `runItemEvents`) once the turn settles and before its snapshot arms; the re-roll fires them again after its replay. `GameViewer.inventoryPass.test.tsx` "fires its When Gained script" drives it; firing them inside the landing raced the stat commit, which overwrote the script's write.
- Resolver rules the probes drove (no ruling of their own): a gain of an item lying here moves that copy (a hidden one is revealed first); a transfer from "here" of an item the place never listed is a gain; a gain onto a place that already shows the item is skipped; a name with the Items Here summary after a colon reads as the name; "the player", "player character", "I" and "me" read as `you`; an item named "nothing" or "none" is dropped; one operation moves at most 99.
- `RuntimeItem.description` exists but the pass does not fill it yet.
- Presence for the pass reads entity positions after the turn's entity moves, plus the turn's discoveries (Q62).
