# 02: Item State

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Every Item Copy has a **State**: a short free-text word. The Item holds the starting State. A new `change` operation in the validator sets one copy's State, and the Changes State outcome of When Empty sets it on the last use. Copies with different States never stack. The player sees the State beside the name in the Inventory tab, and the AI sees it beside the name in Items Here, together with uses left. Scripts read `state` and set it with `setState`. The Inventory tab has no control to change it.

The pass prompt does not change here; 04 adds `change` to the pass.

Spec: Implementation Decisions under The Item and the Item Copy, The operation validator and What each reader shows; Q1, Q3, Q7, Q13.

## Acceptance criteria

- [x] The Item has a State field in the editor, and seeding sets each copy's State from it (WorldEditor.itemsListEditor "writes a Changes State word and the starting State"; state.test "starts each placed and gained copy")
- [x] The validator's `change` sets one copy's State; on a stack the changed copy splits off, then merges with any row it now matches (state.test "splits one copy off a stack, then merges it")
- [x] State is part of the merge key, trimmed and case-insensitive (state.test "never stacks", "differ only in case"; reinstating the bug turns 5 tests red)
- [x] When Empty offers Changes State with a State word; on the last use it sets that word (state.test "sets the State word on the last use"; editor test)
- [x] The Inventory tab shows the State beside the name and has no control to change it (GamePanels.inventory "shows each copy’s State beside its name")
- [x] Items Here shows each copy's State and uses left beside the name (inventoryContext "gives each copy its State, then its uses left")
- [x] Scripts read `state` and set it with `setState`, through the validator (statCodeTurn.itemScripts "reads a copy’s State and sets it"; statCodeExecutor.items)
- [x] Formaquestion's player view shows the State (playerView "one row per item and State"; gameWorld.test; playerViewWorld; worldIndex)
- [x] The glossary and the Items wiki page describe State (CONTEXT.md, docs/World-Editor-Items.md, docs/ScriptsGuide.md)

## Blocked by

- 01

## Landed

**Not verified**

- None. The Inventory tab's State label was checked in jsdom only, not in the live preview.

**For you**

- Open the World Editor's Items tab on an item: check the **State** field under **Uses**, and **Changes State** with its word under **When Empty**.
- In a game, give the player a copy with a State: check the muted word beside the name in the **Inventory** tab.
