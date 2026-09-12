# 02: Paths In The Placeholders Map

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The map's grammar changes from one bare name to a tree, and the same path resolver has to feed the sandbox, completions, diagnostics, and the Test Bench without drift. Opus at high effort.

## What to build

Code reaches a placeholder the way the editor names it. An entry or an owner node exposes its children as members by bare name, brackets for a name that is not an identifier, as deep as the tree goes: `placeholders.Molly.Hair`, `placeholders["Old Molly"]["Eye Color"]`, `placeholders.Molly.Hair.Shade`.

An owner node stands for an entity or a dictionary that owns placeholders. It has no `value`, `values`, `text`, `pin`, or `unpin`, only its placeholders as members. A holder placeholder is a normal entry that also carries its owned children as members. The top level keeps today's rule for a bare name: unique reaches it, ambiguous reaches the last authored with the duplicate warning, and an owner named like a world-level placeholder is one key under that rule. The path form is the exact one, and completions offer it first where the bare name is ambiguous.

A child named like one of the five fixed members loses to the member. The editor warns on the child's name field and on any reference to it. The editor underlines a path segment no entry has, with a nearest-name suggestion. A read or pin through a path lands on the child by id, so the runtime side is unchanged.

One path resolver produces the map's keys, and the sandbox placeholder set carries the tree rather than a flat list. Completions after an owner node or a holder list its children; inside brackets they list quoted names. The Test Bench's unknown-name rule walks paths.

## Acceptance criteria

- [ ] With a world-level `Hair`, `Molly › Hair`, and `Anna › Hair`, each path reads its own entry and `placeholders.Hair` reads the world-level one
- [ ] With only `Molly › Hair` and `Anna › Hair`, `placeholders.Hair` reads the last authored with the duplicate warning, and completions offer the two paths first
- [ ] A holder's owned child reads as a member of the holder at any depth
- [ ] An owner node has none of the five fixed members; `Object.keys` on it lists its placeholders
- [ ] A child named `value` loses to the member; the editor warns on the child's name and on the reference
- [ ] `placeholders.Molly.Hiar` is underlined with a suggestion; the Test Bench unknown-name rule reports it
- [ ] `pin` through a path pins the child by id and the holder resolves through it
- [ ] Completions after `placeholders.Molly.` list Molly's placeholders; inside `placeholders.Molly[` quoted names
- [ ] One exported resolver names every entry; a drift test proves the sandbox, completions, and the bench agree on a nested fixture
- [ ] Guide and help show the path form once
- [ ] The e2e stat-code spec gains a case reading `placeholders.Molly.Hair` across a roll
- [ ] Four gates green; graph updated

## Blocked by

- 01 — Values, Value, Text, And Pin By Kind
