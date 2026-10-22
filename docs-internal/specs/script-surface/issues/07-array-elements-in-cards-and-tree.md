# 07: Array Elements In Cards And Tree

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the resolver gains a value kind, and every element-picking form must resolve without widening what the sandbox exposes.

## What to build

The hover-card and Variable-menu analysis follow an array element. A numeric index, `at`, `find`, `filter` and the other element-picking forms on an array whose element shape is known resolve to that element's members, so `memories[0].text`, `memories.at(-1).daypart`, `location.present[0].name` and `locations.X.present.find(...).location` get cards with the element's description and access (Q13). The Variable menu lists an array's element fields under the array. Unknown arrays stay unknown.

Spec: Q13, story 15.

## Acceptance criteria

- [x] A card appears for `memories[0].text`, `memories.at(-1).timestamp` and `location.present[0].following`, each with the field's help line and read-only badge — `codeCards.elements.test.ts` "reads a memory/entity field through %s"
- [x] A chained pick, `memories.filter((m) => m.custom)[0].text`, resolves to the entry field — "a chained pick" case
- [x] An element verb, `memories[0].pin()`, shows the verb's card; on a string array, `narration.sent[0]` stays a string with no member cards — "shows the %s verb on an element", run against ticket 05's list; "gives a string list's element no card"
- [x] The Variable menu shows `memories` with its entry fields and `present` with an entry's fields under it — `statCodeVariableTree.test.ts` "array elements", each element leaf checked against its card
- [ ] Four gates green

## Blocked by

- 01 (Locations Map And Entity Place)
- 03 (Memories Reads)

## Landed

**Not verified**

- Four gates green: prepare runs them on the rebase onto ticket 05; the review gates (typecheck, changed-file lint) passed before.
- The Variable menu as drawn: the browser pane would not render the World Editor's Scripts tab, so only the tree data is tested.

**For you**

- World Editor › Scripts, any box, Variable menu: Memories holds `add`, `pin` and a `memories[0]` group; Location › present lists `present` first, then the entity fields.
- Hover `memories[0].text` and `m.custom` inside `memories.filter((m) => m.custom)`: each shows the field's card.
