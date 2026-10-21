# 07: Array Elements In Cards And Tree

Status: ready-for-agent
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the resolver gains a value kind, and every element-picking form must resolve without widening what the sandbox exposes.

## What to build

The hover-card and Variable-menu analysis follow an array element. A numeric index, `at`, `find`, `filter` and the other element-picking forms on an array whose element shape is known resolve to that element's members, so `memories[0].text`, `memories.at(-1).daypart`, `location.present[0].name` and `locations.X.present.find(...).location` get cards with the element's description and access (Q13). The Variable menu lists an array's element fields under the array. Unknown arrays stay unknown.

Spec: Q13, story 15.

## Acceptance criteria

- [ ] A card appears for `memories[0].text`, `memories.at(-1).timestamp` and `location.present[0].following`, each with the field's help line and read-only badge
- [ ] A chained pick, `memories.filter((m) => m.custom)[0].text`, resolves to the entry field
- [ ] An element verb, `memories[0].pin()`, shows the verb's card; on a string array, `narration.sent[0]` stays a string with no member cards
- [ ] The Variable menu shows `memories` with its entry fields and `present` with an entry's fields under it
- [ ] Four gates green

## Blocked by

- 01 (Locations Map And Entity Place)
- 03 (Memories Reads)
