# 10: Open From A Card

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Navigation out of the code box. Opus at medium: it extends the World Editor's reveal path one step.

## What to build

A card on a world name shows Open. It jumps to the item in the World Editor through the select-and-reveal path. For an entity's own stat or trait it selects the entity, opens its Stats or Traits tab and reveals the row. From full screen it leaves full screen first. The template dialog, the Tool editor and the library editor hide Open.

Spec: Q8, Q25; Implementation Decisions: Open.

## Acceptance criteria

- [ ] Open selects and reveals a world stat, trait, placeholder, entity and dictionary
- [ ] Open on an entity's own stat or trait reveals the row in its tab
- [ ] Open leaves full screen first
- [ ] Guard bites: Open is hidden in the template dialog, the Tool editor and the library editor
- [ ] Changelog fragment; four gates green

## Blocked by

- 06
