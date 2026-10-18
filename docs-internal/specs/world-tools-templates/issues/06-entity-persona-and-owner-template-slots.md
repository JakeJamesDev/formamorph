# 06: Entity, Persona And Owner Template Slots

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: two new tied slot routes plus an owner route for traits, all through the fill step every template uses.

## What to build

`stat(<entitySlot>)` lists the stats of the entity picked in that slot and fills `entities[<entity>].stats[<stat>]` (Q16 A). `stat(persona)` lists each persona entity's stats and fills `persona.stats[<stat>]`. A tied stat slot clears when its entity slot changes, as a tied trait slot does. In an entity stat's box, an untied `trait` slot lists that entity's traits first under an Owner trail, then the world's, and an Owner pick fills through `owner.traits` (Q16 B). A Blueprint stat's box gets no Owner trait rows. The Scripts guide documents the new slots.

Spec: Q16; follow-ups section.

## Acceptance criteria

- [ ] A World Tool template with `entity` + `stat(entity)` slots writes the picked entity's stat in Try It
- [ ] A `stat(persona)` pick fills `persona.stats` and runs in Test Code
- [ ] Changing the entity slot clears its tied stat slot
- [ ] An entity stat's box lists Owner traits first; a global stat's and a Blueprint stat's box list world traits only
- [ ] Each guard bites when its route is reverted
- [ ] Changelog fragment written; four gates green
