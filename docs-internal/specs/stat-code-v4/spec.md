# Stat Code v4: Placeholder Paths And Shapes

Status: ready-for-agent
Status note: Decisions locked 2026-09-11 in discussion after v3 shipped. No tickets yet.

## Problem Statement

Stat code v3 gave every map one key: the bare name. A world that scopes placeholders per entity reuses names on purpose, so Molly's `Hair` and Anna's `Hair` are one key in code and only the last authored one is reachable. The editor shows `Molly › Hair` everywhere else, and an author cannot write that in code. An Object placeholder, one that shows every value at once, reads in code as a single joined string, and a pin on it can only name one text. A placeholder rename leaves a chip-bearing stat's code name behind, and a chip-bearing trait name still keys `traits` by this playthrough's roll.

## Solution

Code reaches a placeholder the way the editor names it: `placeholders.Molly.Hair` for a scoped or owned placeholder, brackets for a name with a space, as deep as the tree goes. Each entry carries three words with one meaning each. `values` is the authored list. `value` is what is in force, typed by kind: one text for a Wildcard, a list for an Object. `text` is `value` as one string, exactly what the prompt sees. `pin` takes the same type `value` reads. A placeholder rename follows into every stat code name it changes, and trait names get the same stable code name stats have.

## User Stories

1. As a world author, I want `placeholders.Molly.Hair` to reach the placeholder Molly owns, so that I can name a scoped placeholder the way the editor shows it.
2. As a world author, I want `placeholders["Old Molly"]["Eye Color"]` to work, so that a name with a space is not off limits at any depth.
3. As a world author, I want a placeholder held under another placeholder to be reachable as a member of its holder, so that `placeholders.Molly.Hair.Shade` follows the tree.
4. As a world author, I want an entity or dictionary that owns placeholders to read as a node with those placeholders as members, so that `placeholders.Molly` lists what Molly owns.
5. As a world author, I want the bare name to keep working when it is unique, so that `placeholders.Hair` still reads a world-level `Hair`.
6. As a world author, I want completions after an owner node's dot to list its placeholders, so that I do not have to remember which names Molly owns.
7. As a world author, I want completions to offer the path form first when a bare name is ambiguous, so that I am steered to the exact one.
8. As a world author, I want the editor to underline a path segment no entry has, so that a typo in `Molly.Hiar` is caught before the run.
9. As a world author, I want a child named like a built-in member to lose to the member and be warned about, so that `placeholders.Molly.value` never surprises me.
10. As a world author, I want `values` to be every authored value as text on every kind, benched ones included, so that I can list what the author wrote.
11. As a world author, I want `value` on a Wildcard to be the one text in force, roll or pin, so that `placeholders.Mood.value === "calm"` keeps working.
12. As a world author, I want `value` on an Object to be the list of values in force, so that I can count, search, or pass them on.
13. As a world author, I want a benched value to be absent from an Object's `value` and present in its `values`, so that the two names mean different things.
14. As a world author, I want `text` on every kind to be the exact string the prompt sees, so that a comparison against narration wording is exact.
15. As a world author, I want `pin(x)` on a Wildcard to take one text, so that it stays what it was.
16. As a world author, I want `pin(x)` on an Object to take a list, so that I can pin several values at once.
17. As a world author, I want a pinned Object to read its pinned list back through `value` exactly, so that a value with a comma in it survives the round trip.
18. As a world author, I want `unpin()` on an Object to bring every drawable value back, so that the pin is a mask and never a replacement.
19. As a world author, I want a `pin` of the wrong type to fail the run loudly, so that a mistake is not a silent no-op.
20. As a world author, I want Test Code and the turn log to print `text`, so that a pin of several values reads as one line.
21. As a world author, I want completions to say which type `value` and `pin` carry on an entry, so that I know before I run.
22. As a world author, I want the prompt, the panel, the immersive view, and the stat name resolver to read a list pin joined with `", "`, so that an Object pinned from code shows the way an unpinned Object shows.
23. As a world author, I want renaming a placeholder to offer to update stat code that reaches it through a stat's code name, so that `stats["Beast Power"]` follows `Beast` becoming `Wolf`.
24. As a world author, I want the rename offer to rewrite path forms as well as bare names, so that `placeholders.Molly.Hair` follows a rename of either segment.
25. As a world author, I want a trait whose name carries a chip to have one code name across playthroughs, so that `traits["Beast Fury"]` is reachable at all.
26. As a world author, I want the editor, Test Code, the Test Bench, and play to agree on a trait's code name, so that what completes is what runs.
27. As a player, I want a save with an Object pinned from code to load and show the pin, so that a list pin survives a round trip.
28. As a player, I want undo and re-roll to restore a list pin, so that Code Pins behave the same whatever their shape.
29. As a maintainer, I want one path resolver behind the sandbox, the completions, the diagnostics, the Test Bench, and the rename offer, so that the path grammar cannot drift.
30. As a maintainer, I want the surface list to describe an entry's five fixed members and permit named children, so that the drift guard stays honest.

## Implementation Decisions

**1. Paths in the `placeholders` map.**

- An entry or an owner node exposes its children as members by bare name, brackets for a name that is not an identifier. It nests as deep as the tree does.
- An owner node stands for an entity or a dictionary that owns placeholders. It has no `value`, `values`, `text`, `pin`, or `unpin`; only its placeholders as members. An owner named like a world-level placeholder is one key at the top level, last authored wins, with the existing duplicate warning naming the winner.
- A holder placeholder is a normal entry that also carries its owned children as members.
- The top level keeps today's rule for a bare name: unique reaches it, ambiguous reaches the last authored with a warning. The path form is the exact one. Completions offer the path form first where the bare name is ambiguous.
- A child named like one of the five fixed members loses to the member. The editor warns on the child's name field and on any reference to it.
- The path grammar is the one the editor already uses to display a placeholder: owner, then root, then each step. One resolver produces the map's keys and every surface reads it. The sandbox placeholder set carries the tree, not a flat list.
- A read or pin through a path lands on the child by id, as a bare-name read does today. The runtime side is unchanged.

**2. `values`, `value`, `text`, and `pin` by kind.**

- `values`: every authored value as text, in authored order, benched ones included. Same on every kind.
- `value`: what is in force. On a Wildcard and on a single-value placeholder, one string: the roll, or the pin. On an Object, a list: every drawable value, or the pinned list. A benched value is absent from an Object's `value`.
- `text`: `value` as one string, exactly what the prompt sees. One string is itself; a list joins with `", "`.
- `pin(x)`: the type `value` reads on that entry. A Wildcard takes a string; an Object takes a list. A string handed to an Object pins a one-item list. A list handed to a Wildcard, or any non-text item, fails the run as a `bad-write` with the existing message shape. Assigning `value` follows the same rule.
- `unpin()` releases the pin on any kind.
- The Code Pin for an Object is stored as a list, so `value` reads it back without a split. The Code Pins map in gameplay state therefore holds a string or a list per placeholder id. Every reader of Code Pins joins a list with `", "` at the point it needs text: the resolver, the prompt context, the panel, the immersive view, the stat name resolver, Test Code, and the turn log. Trait, location, and band pins stay text; they pin one value.
- Completions show the type per entry, since the kind is authored. The surface list describes the five fixed members and permits named children.
- Templates, the guide, and the help use `text` where they compare against prompt wording and `value` where they pin.

**3. A placeholder rename follows into code names.**

- Renaming a placeholder changes the code name of every stat and trait whose name carries that chip. The rename offer counts those references beside the direct `placeholders` references and rewrites both when accepted.
- The rename offer rewrites path forms as well as bare names: a rename of an owner or a holder rewrites the segment; a rename of the child rewrites the leaf.
- Everything else about the offer stays as ticket 10 of v3 built it.

**4. Traits get a code name.**

- The stat code-name rule applies to traits: a chip in a trait's name reads as the placeholder's own name. The sandbox keys `traits` on it, and completions, diagnostics, the Test Bench, Test Code, and the rename offer all read it from the same function that names stats.
- The play site stops resolving trait names before the run. The resolved text stays in use for prompts and the panel.

## Testing Decisions

A good test drives the sandbox as a turn does and reads what came out: the returned stats, the pins, the switches, the diagnostics. It never reads the prelude text or the row format.

- **Primary seam: the per-turn run.** Given a world with a world-level `Hair`, `Molly › Hair`, `Anna › Hair`, a holder with an owned child, and an Object, assert each path reads its own entry, a bare ambiguous name reads the last authored, `value` and `values` differ on an Object with a benched value, a list pin lands as a list Code Pin and reads back exactly, `text` joins, and a Wildcard pin stays a string. Prior art: the per-turn tests beside the turn module.
- **Executor seam** for sandbox-only facts: an owner node has no fixed members, a child named `value` loses to the member, a list handed to a Wildcard is a `bad-write`, `unpin()` on an Object restores every drawable value.
- **Pin collection seam.** A list Code Pin resolves through the collection everywhere a text pin does, joined with `", "`; rank against other sources is unchanged. Prior art: the pin collection tests.
- **Editor seam.** Completions after an owner node, after a holder, and inside brackets at depth; diagnostics for a bad segment, a reserved child name, and an ambiguous bare name. Prior art: the analysis tests.
- **Rename seam.** A placeholder rename rewrites bare, path, and code-name references; an owner rename rewrites the segment. Prior art: the rename tests from v3 ticket 10.
- **Code-name drift guard.** A chip-bearing trait fixture run through the sandbox, the completions, and the bench produces one name.
- **Save round trip.** A list Code Pin survives save, load, undo, and re-roll. Prior art: the gameplay-context Code Pins tests.
- **Live check.** The e2e stat-code spec gains one case pinning an Object from code and reading the joined text in the next turn's prompt, and one reading `placeholders.Molly.Hair` across a roll.

## Out of Scope

- Path addressing into `stats` or `traits`. Neither has an ownership tree.
- Drilled chips as map paths. A chip's authored drill is a placement matter, not a map key.
- Changing how trait, location, or band pins are stored. Only Code Pins gain the list shape.
- A pin API beyond `pin`, `unpin`, and assignment to `value`.

## Further Notes

- **Export-shape reminder.** The Code Pins map in gameplay state changes from text-only to text-or-list per id. Additive, but a shape change to the save envelope, so it needs the user's version call. It rides the same call that v2's `codePins` and `codeBounds` already wait on.
- The three-word contract (`values` authored, `value` in force, `text` as the prompt sees it) is the one to hold every later placeholder surface to.
- The one-item-array shape for Wildcards was considered and rejected: it breaks `value === "calm"` for the common case to buy uniformity that `text` already provides.
