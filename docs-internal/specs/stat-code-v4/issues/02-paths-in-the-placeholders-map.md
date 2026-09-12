# 02: Paths In The Placeholders Map

Status: ready-for-human
Status note: Implemented in "Reach A Placeholder By Its Path In Stat Code". Four gates green; review fixes folded into that commit.
Base: 9f53696b
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

- [x] With a world-level `Hair`, `Molly › Hair`, and `Anna › Hair`, each path reads its own entry and `placeholders.Hair` reads the world-level one
- [x] With only `Molly › Hair` and `Anna › Hair`, `placeholders.Hair` reads the last authored with the duplicate warning, and completions offer the two paths first
- [x] A holder's owned child reads as a member of the holder at any depth
- [x] An owner node has none of the five fixed members; `Object.keys` on it lists its placeholders
- [x] A child named `value` loses to the member; the editor warns on the child's name and on the reference
- [x] `placeholders.Molly.Hiar` is underlined with a suggestion; the Test Bench unknown-name rule reports it
- [x] `pin` through a path pins the child by id and the holder resolves through it
- [x] Completions after `placeholders.Molly.` list Molly's placeholders; inside `placeholders.Molly[` quoted names
- [x] One exported resolver names every entry; a drift test proves the sandbox, completions, and the bench agree on a nested fixture
- [x] Guide and help show the path form once
- [x] The e2e stat-code spec gains a case reading `placeholders.Molly.Hair` across a roll
- [x] Four gates green; graph updated

## Blocked by

- 01 — Values, Value, Text, And Pin By Kind

## Comments

**2026-09-12 — implemented.**

`src/lib/statCodePaths.ts` is the one resolver. It builds the map from the world's placeholders and the owner index, and every surface reads it: `sandboxPlaceholders` turns its nodes into the sandbox map, the completions and the checks walk it, and the bench reports a miss by the path it names. The drift guard in `statCodeNameDrift.test.ts` holds the four together on one nested fixture, reading the sandbox's own keys back through a pin.

Three decisions the ticket left open:

- **The bare name is two-tier, not one.** The ticket asks for both "`placeholders.Hair` reads the world-level one" and "with only scoped ones, the last authored." Those cannot both come from one last-wins list, so the map's own top level is the world's unowned rows plus one node per owner, and a scoped or owned row's bare name is a *fallback* that takes a key only where nothing at the top level claims it. The duplicate warning names whichever rule picked the winner, so it no longer says "the last one authored" when the world's own row won.
- **Six fixed members, not five.** The ticket counts five (`value`, `values`, `text`, `pin`, `unpin`); `roll` is the sixth and a child named `roll` would otherwise clobber the function. `placeholderEntryFields` always listed all six, so the ticket miscounted. `PLACEHOLDER_ENTRY_MEMBERS` is the one list, and a test holds it to `placeholderEntryFields` on either kind — a seventh field there would otherwise make every write to it report as a path no placeholder answers.
- **Two spellings, deliberately.** `placeholderPathExpression` is valid code, for a message that quotes what to write; `placeholderPathLabel` is the `Molly › Hair` every other editor surface uses, for a message that names a placeholder. `unknownPlaceholders` and Test Code carry the label.

One change outside the ticket's own surface: the nearest-name suggester now counts a transposition as one slip. The acceptance line asks for a suggestion on `placeholders.Molly.Hiar`, and plain Levenshtein scores that two, so it suggested nothing. Every suggestion site in stat code gets the better answer.

No export-shape change. Writes carry the placeholder id internally, and the Code Pins map keeps the text-or-list shape ticket 01 gave it.

**2026-09-12 — two open calls for you, from the closing review.**

Neither is a defect; both are consequences of the ticket's own rules that it did not spell out. I built what the ticket asked and left these as they stand.

1. **A bare name resolves differently in a world that already shipped.** A scoped row authored *after* a world-level row of the same name used to win the bare name under v3's flat map. Under acceptance criterion 1 it now loses to the world's own row. That is the criterion, not a slip — but code in a live world can change what it reads, with no migration hook and no version call. Your ratification, please; it is the kind of change hard constraint 1 reserves for you.

2. **An owner node and a same-named placeholder contest one key, and the loser goes unreachable.** The spec says "an owner named like a world-level placeholder is one key under that rule", so the contest is sanctioned; it never said what happens to the half that loses. Today the loser has no other path, so code cannot reach it at all. The editor does warn — *"'Molly' names both a placeholder and an owner of placeholders. This reads the owner."* — and renaming either one fixes it.

   The alternative is to **merge** that key: carry the placeholder's six members *and* the owner's children on one node, so both halves stay reachable. It is a small change in `buildMap` and loses nothing, but it replaces "last authored wins" with a third rule the spec does not name, so I did not ship it unasked. Say the word and it is a short follow-up.

One review finding was real and is fixed: the members-versus-surface guard I first wrote compared the list to itself and could not go red. It now asserts against `placeholderEntryFields`, and a seventh member fails it.
