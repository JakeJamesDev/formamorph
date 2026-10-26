# 08: Location Tree And Exits

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the places input gains parent ids and the router's destination list for play and the editor, built lazily.

## What to build

Each location entry and `location` gain `parent`, a code name that is empty at the top level, and `children`, code names (Q15). They also gain `exits`, an array of `{ name, hint }` from the destination list the AI router reads, with Connection hints (Q29). No entry holds another, so `JSON.stringify(location)` works. The fields build lazily, after Script Surface Q53. After a Before the AI `location.move`, `location` and its `exits` still read where the turn started (Q30). The editor's Test Code, World Tools and user Tools read the same fields. Cards, the Variable menu and the Scripts guide cover them.

Spec: Q15, Q29, Q30, stories 40–43.

## Acceptance criteria

- [x] A child location reads its parent's code name; a top-level one reads empty; a parent lists its children: `sandboxSnapshot.locationLinks.test.ts` "reads a child’s parent…", plus the missing-parent case
- [x] `location.exits` lists the router's destinations for the current location, with a Connection's hint, and a one-way Connection lists only its own direction: `sandboxSnapshot.locationLinks.test.ts` router-order and one-way cases
- [x] `locations[location.exits[0].name]` reads that location's entry: `sandboxSnapshot.locationLinks.test.ts` "names exits by the keys of locations"
- [x] `JSON.stringify(location)` returns text and does not throw: `sandboxSnapshot.locationLinks.test.ts` "turns the current location into text"
- [x] After `location.move("Old Mill")` in a Before the AI script, `location.name` and `location.exits` still read the starting location: `sandboxSnapshot.locationLinks.test.ts` Before the AI world-script run
- [x] Test Code and a user Tool read the fields for the authored world: `sandboxSnapshot.locationLinks.test.ts` opening-state and read-only Tool runs; `useScriptWorldNames.test.ts` checks the editor passes Connections
- [x] Hover cards, the Variable menu and the Scripts guide list `parent`, `children` and `exits`: `codeCards.location.test.ts`, `statCodeVariableTree.test.ts` exits group and element-card sweep; guide table and field rows

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- None. No live-preview frame: every criterion is a script read, covered by unit runs.

**For you**

- In the World Editor, run Test Code with `return location.exits;` on a world with Connections, and check the list matches where the AI can move you.
