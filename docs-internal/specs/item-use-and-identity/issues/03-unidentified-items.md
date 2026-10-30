# 03: Unidentified Items

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Shares the merge key and the copy name line with 02. Expect a rebase merge, not a shared helper.

## What to build

An author gives an item an **Unidentified Name** and an **Unidentified Description**. When either is filled, every copy starts unidentified, and a blank field shows the normal value. Unidentified is its own copy flag, so a hidden placement stays unidentified when found. The player sees only the unidentified face, in the Inventory tab, the log and item lines, and Formaquestion's player view. The narrator sees both faces in Items Here, the true one marked unknown to the player. Effects apply while unidentified. The validator's `reveal` on a visible unidentified copy identifies it, and the copy merges into an identified stack. Scripts read both faces and the flag, and can reveal. The pass can name the item by either face.

The pass prompt does not change here; 04 describes the second job of `reveal` to the pass.

Spec: Implementation Decisions under The Item and the Item Copy, The operation validator and What each reader shows; Q2, Q8, Q14–Q19.

## Acceptance criteria

- [x] The Item has Unidentified Name and Unidentified Description in the editor; filling either starts every seeded copy unidentified; a blank field shows the normal value. `WorldEditor.itemsListEditor.test.tsx` writes both; `unidentified.test.ts` seed case; Items Here and tab tests read the blank fallback
- [x] The unidentified flag is apart from visibility; a copy can be hidden and unidentified. `unidentified.test.ts` seeds a hidden unidentified copy
- [x] `reveal` on a hidden copy shows it and leaves it unidentified; `reveal` on a visible unidentified copy identifies it. `unidentified.test.ts` two-step reveal case
- [x] Unidentified and identified copies never stack; a revealed copy merges into an identified stack in the same place. `unidentified.test.ts` gain, merge and partial cases; mutation of the merge-key clause goes red
- [x] Effects of an unidentified item apply. `unidentified.test.ts` moves Strength by -2 on an unidentified copy
- [x] The Inventory tab, the log and every item line use the unidentified face. `GamePanels.inventory.test.tsx`, `settle.test.ts` grant lines, `unidentified.test.ts` stat lines and diagnostics, `statCodeTurn.itemScripts.test.ts` run lines; Equipped list by inspection
- [x] Items Here shows the unidentified face and the true face marked unknown to the player. `inventoryContext.test.ts` (Q38 shape)
- [x] Formaquestion's player view, world index facts and script state never hold the true face. `playerViewUnidentified.test.ts`: split rows (Q40), pages, scene, Inventory chip, script state
- [x] Scripts read both faces and `unidentified`, and `reveal()` identifies. `statCodeExecutor.items.test.ts`, `statCodeTurn.itemScripts.test.ts`
- [x] `applyInventoryPass` resolves a name against both faces. `unidentified.test.ts` pass cases, Q43 unique and shared names
- [x] The glossary and the Items wiki page describe unidentified items. CONTEXT.md **Unidentified**; World-Editor-Items.md "Unidentified items"; ScriptsGuide.md items members

For you: play a world with an unidentified item and judge whether the narrator keeps the mystery until a reveal.

## Blocked by

- 01

## Landed

**Not verified**

- No browser check of the editor fields or the Inventory tab: covered by the jsdom tests above only.

**For you**

- Play a world with an unidentified item and judge whether the narrator keeps the mystery until a reveal.
- Read the editor's two new fields on an item's **Descriptions** tab and judge their place and help lines.
- Ticket 06 measures the narrator's leak rate; the pass prompt learns about identifying in ticket 04.
