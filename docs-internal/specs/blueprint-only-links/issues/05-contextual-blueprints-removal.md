# 05: Contextual Blueprints removal

Status: ready-for-human
Base: f88eee42

Parent: [Blueprint-Only Links spec](../spec.md)

## What to build

Removing the Blueprints group detaches each linked item into every entity that links it, then deletes it. Unlinked items move to the top level (Q11). The confirmation says what happens, and names the cast entities whose copies lose stat changes (Q12). This replaces the unruled "delete the links" removal from ticket 01.

## Acceptance criteria

- [ ] One pure function removes the group: detaches, deletes the linked items with their subtrees, and moves the rest to the top level.
- [ ] A linked item inside an unlinked group goes; the group moves up with what is left.
- [ ] The confirmation gives the detach count, says the rest move to the top level when any are left, and names the cast entities that lose stats.
- [ ] Tests for each rule, each shown to bite. The changelog and the Blueprints wiki section match.
