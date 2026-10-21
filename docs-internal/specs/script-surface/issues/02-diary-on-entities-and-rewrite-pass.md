# 02: Diary On Entities And The Rewrite Pass

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the load-time script-text rewrite is a tree-sitter splice over shipped code, and tickets 03 and 09 reuse the pass it builds.

## What to build

`diary` moves onto entity entries: `entities.Mira.diary(line)` sits beside `move` and `follow`, and the top-level `diary` no longer exists (R2). The persona's entry has no diary; a call on it fails the script as the old call did. On world load, a script-text rewrite pass turns `diary("Mira", line)` into `entities.Mira.diary(line)` and `diary(expr, line)` into `entities[expr].diary(line)`, in every script of the world's stats, traits, world and World Tools; the pass is idempotent and lives beside the existing retired-route rewrite so later tickets add their rewrites to it (Q1). The Variable menu draws a group with one child as a leaf, so Discover inserts directly (R3). Cards and the menu show `diary` on the entity entry and no longer at the top level.

Spec: R2, R3, Q1, stories 5, 12, 14.

## Acceptance criteria

- [ ] `entities.Mira.diary("She hid the key.")` lands a diary line for Mira after the AI's entry; a call on the persona fails the script with the old message
- [ ] A world whose scripts call `diary("Mira", x)` and `diary(name, x)` loads with both rewritten to the entry form, dotted for the literal and bracketed for the expression; loading the migrated world again changes nothing
- [ ] The rewrite pass is one function other rewrites register with; a test adds a dummy rewrite and sees it applied to a stat, a trait, a world and a World Tool script
- [ ] The Variable menu inserts `discover("Name")` as a leaf with no group; a test renders the tree and finds no one-child group
- [ ] Hover cards show `diary` on an entity entry and mark the top-level name unknown
- [ ] Four gates green

## Blocked by

- None (can start immediately)
