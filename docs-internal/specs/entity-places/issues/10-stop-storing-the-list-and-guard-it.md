# 10: Stop Storing the List and Guard It

Status: ready-for-agent
Blocked by: 03, 04, 05, 06, 07, 08, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An entity with a kind stops storing `locations`. Its routine is the only source of its places. A lint rule then keeps every reader on the Entity Places module.

**This changes the export shape** of world files and entity card files (Q1). Say so in the landing and in the hand-off. Released v3.6.2 has no entity kinds, so it reads such an entity from a newer world as placed nowhere. That is accepted.

- **The writers.** Every edit that today rebuilds the derived list stops doing so. The helper that rebuilds it goes, with all of its call sites. Changing an entity's kind, adding or removing a Start, editing a row, deleting a location, and the dev fixtures all leave an entity with a kind without the field.
- **Reading an old file.** A world or card from v3.6.2 or earlier has entities with no kind and a membership list. The existing migration that gives such an entity its kind and Starts keeps reading that list as its input, through the module, and then drops it. There is no new migration step for unreleased worlds that have a kind and a stored list (Q5): the module ignores the field for an entity with a kind, and the next save drops it.
- **The one-time rewrite.** Remove the stored list from every entity with a kind in the bundled worlds and in `worlds-wip`. Follow the bundled-worlds skill: work through its image-stripped copy, and update the bundled fingerprints. The rewrite changes nothing else in those files.
- **No-kind entities.** The Custom Persona and any entity with no kind keep the stored list. Only the module reads or writes it.
- **The lint rule.** A read of an entity's `locations` outside the module fails lint. It joins the existing custom rules. It must not fire on a `locations` field of another type, such as the world's location list. Any reader still outside the module at this point moves here; the landing names each.
- **Docs.** The world format doc states the new shape and what an older build shows. The script guide changes if it names the stored list.

Spec rulings: Q1, Q2, Q3, Q5. ADR-0017.

## Acceptance criteria

- [ ] After any routine edit in the editor (kind change, Start added, Start removed, row edited, location deleted), an entity with a kind has no `locations` field. One test per edit; each fails when the old rebuild is restored.
- [ ] An exported world and an exported entity card hold no `locations` on an entity with a kind.
- [ ] A world from v3.6.2 loads, each legacy entity gets its kind and Starts as before, and its Presence equals its old membership list. A test uses a stored v3.6.2 fixture.
- [ ] An unreleased world whose entity with a kind still stores a stale list loads with places from the routine only, and saves without the field.
- [ ] The Custom Persona keeps its stored locations across a load and a save.
- [ ] No bundled world and no `worlds-wip` world stores `locations` on an entity with a kind. The bundled world test asserts it.
- [ ] For every bundled world, each entity's Presence after the rewrite equals what the stored list gave before, plus only the places Q7 adds (Player's Starting Location expansion and Can Also Go). A test compares against the pre-rewrite files from git.
- [ ] The rewrite's diff to each bundled world contains only removed `locations` entries. The landing shows the diff stat.
- [ ] The helper that rebuilt the derived list is gone, with no caller left.
- [ ] The lint rule fails on a read of an entity's `locations` outside the module, passes inside it, and does not fire on the world's location list. Tests in the custom-rule test file cover all three.
- [ ] The whole app source passes the new rule. The landing lists any reader that had to move in this ticket.
- [ ] The agreement test still passes with the field gone.
- [ ] The world format doc states the new shape and the older-build behavior.
- [ ] The landing and the hand-off carry the export-shape reminder.
- [ ] A changelog fragment records the file format change for authors.

For you: open one bundled world and one of your `worlds-wip` worlds, and check that every character is where you expect on the Presence tabs and in a new game.
