# 01: Values, Value, Text, And Pin By Kind

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

A list-shaped Code Pin has to be read correctly by every surface that reads pins today, and the sandbox entry gains a type that depends on the placeholder's kind. The breadth across readers and the type-by-kind rule earn Opus at high effort.

## What to build

Every placeholder entry in the sandbox carries three words with one meaning each. `values` is every authored value as text, in authored order, benched ones included, on every kind. `value` is what is in force: on a Wildcard or a single-value placeholder, one string, the roll or the pin; on an Object, a list of every drawable value, or the pinned list, with benched values absent. `text` is `value` as one string, exactly what the prompt sees; a list joins with `", "`.

`pin(x)` takes the type `value` reads on that entry. A Wildcard takes a string; an Object takes a list, and a string handed to an Object pins a one-item list. A list handed to a Wildcard, or any non-text item, fails the run as a `bad-write` with the existing message shape. Assigning `value` follows the same rule. `unpin()` releases the pin on any kind.

An Object's Code Pin is stored as a list, so `value` reads it back exactly, comma-bearing values included. The Code Pins map in gameplay state holds a string or a list per placeholder id. Every reader of Code Pins joins a list with `", "` where it needs text: the resolver, the prompt context, the stat panel, the immersive view, the stat name resolver, Test Code, and the turn log. Trait, location, and band pins stay text. Save, load, undo, and re-roll carry a list pin unchanged.

Completions show the type `value` and `pin` carry on each entry, since the kind is authored. The surface list describes `text` beside the existing members. Templates, the guide, and the help use `text` where they compare against prompt wording and `value` where they pin.

## Acceptance criteria

- [ ] `values` lists every authored value on every kind, benched included
- [ ] Wildcard `value` is the roll or the pin as a string; Object `value` is the drawable list or the pinned list, benched values absent
- [ ] `text` equals `value` on a Wildcard and the `", "` join on an Object, and matches the prompt's text for the same placement
- [ ] `pin(["Grey", "Long"])` on an Object reads back as that list through `value` and as `Grey, Long` through `text` and in the next turn's prompt
- [ ] `pin("Grey")` on an Object pins a one-item list; `pin(["a"])` on a Wildcard and `pin({})` anywhere fail as `bad-write`
- [ ] `unpin()` on an Object restores every drawable value
- [ ] A list Code Pin survives save, load, undo, and re-roll; a save with text-only Code Pins loads unchanged
- [ ] Test Code and the turn log print `text` for a list pin
- [ ] Completions state the type per entry; the surface drift guard passes with `text` added
- [ ] Templates, guide, and help use `text` for comparisons and `value` for pins; the pin template still runs
- [ ] The e2e stat-code spec gains a case pinning an Object from code and reading the joined text in the next prompt
- [ ] Closing response states the save-envelope shape change for Code Pins
- [ ] Four gates green; graph updated

## Blocked by

- None (can start immediately)
