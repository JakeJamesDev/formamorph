# ADR-0011 — An app-internal function may read the open world when its purpose needs it

**Status:** Accepted · **Date:** 2026-10-05

## Context

Formaquestion's fixed functions are app-internal: the app defines them, and they are no Tool ([ADR-0009](0009-docs-lookup-is-an-app-internal-function.md)). Until now each one read only app data: the guide lookup reads the bundled docs, the dice roll reads nothing, and the face call reads the Mascot rig. The help request held text of the player's world only through a Formaquestion Tool the player turned on ([ADR-0010](0010-formaquestion-tools-are-switched-per-device.md)).

The AI writes stat code that fails without an error: a wrong clock field reads `undefined`, a whole stat compared to a number is always false, and a switch of an unknown trait is dropped. The editor's analysis and **Test Code** catch these, but only against the world's names. A check without the names misses a stat or trait the AI guessed wrong (Help Stat Code Accuracy spec, Q12–Q13, Q21).

## Decision

- **An app-internal function may read the open world when its purpose needs it.** The code test is the first. It runs the stat-code analysis and a **Test Code** run on the open world, and its results carry the world's stat, trait, entity, placeholder and dictionary names to the help endpoint.
- **It reads the authored world, with no playthrough.** The game and the editor register their authored world beside the Tool Snapshot. In the game, the code test reads the authored world, not the live stat and trait state, as **Test Code** does in the editor.
- **It applies nothing.** The run's writes are reported, never committed.
- **With no world open, it reads nothing.** The analysis runs with every name check off, and the run is skipped: a run on an empty world reports throws on correct code.
- **It keeps the ADR-0009 pattern.** Its own module and executor, the shared capability gate, no Tool catalog entry, and a built-in name a Formaquestion Tool cannot take.
- **The player can switch it off.** It has its own switch and call limit on the **Tools** tab, as the lookup and the roll do. The help preset file carries both.

## Consequences

- A help request on a code turn can send world names to the help endpoint with no Tool on. The **Tools** tab row and the guide say so.
- A later fixed function that reads the world needs a purpose that the world's data serves, and the same per-device switch.
- The help preset file's `functions` block gains the code test's entry. A file without it is refused; the file is unreleased.
- No world or save export changes shape.

## Alternatives rejected

**A code test with no world names:** keeps the help request free of world text, but it cannot catch a guessed stat or trait name, which is one of the failures it exists to catch.

**The code test as a catalog Tool:** the world boundary of Tools would hold, but a preset could drop it and the **Tools** tab would show it among the player's own, against ADR-0009.
