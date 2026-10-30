# 02: Item State

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Every Item Copy has a **State**: a short free-text word. The Item holds the starting State. A new `change` operation in the validator sets one copy's State, and the Changes State outcome of When Empty sets it on the last use. Copies with different States never stack. The player sees the State beside the name in the Inventory tab, and the AI sees it beside the name in Items Here, together with uses left. Scripts read `state` and set it with `setState`. The Inventory tab has no control to change it.

The pass prompt does not change here; 04 adds `change` to the pass.

Spec: Implementation Decisions under The Item and the Item Copy, The operation validator and What each reader shows; Q1, Q3, Q7, Q13.

## Acceptance criteria

- [ ] The Item has a State field in the editor, and seeding sets each copy's State from it
- [ ] The validator's `change` sets one copy's State; on a stack the changed copy splits off, then merges with any row it now matches
- [ ] State is part of the merge key
- [ ] When Empty offers Changes State with a State word; on the last use it sets that word
- [ ] The Inventory tab shows the State beside the name and has no control to change it
- [ ] Items Here shows each copy's State and uses left beside the name
- [ ] Scripts read `state` and set it with `setState`, through the validator
- [ ] Formaquestion's player view shows the State
- [ ] The glossary and the Items wiki page describe State

## Blocked by

- 01
