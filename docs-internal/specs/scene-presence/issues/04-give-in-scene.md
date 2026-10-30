# 04: Give Offers In Scene by Label

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Inventory tab's Give list offers **In Scene** only, each person under their label. A person with no label, or with no entity, is not offered. The player types that action instead.

## Acceptance criteria

- [x] Give lists In Scene entities only, under their labels. Test "offers only the entities in scene…"; swapping to Look Around turned it red.
- [x] A stranger in scene shows by alias or Stranger Name, never the true name. Test "is offered by the Stranger Name and never by the true name".
- [x] A stranger with no label is not offered. Test "is not offered with no label".
- [ ] The panel's give operations accept only those entities.

## Landed

**Not verified**
- The panel's give operations accept only those entities: `onOps` builds its presence set from the same array Give renders, but no test sends a transfer to a quiet or absent entity.
- No frame or dev-router check of the Give popover.

**For you**
- Play a few turns with a stranger in scene and open Give in the Inventory tab. Check that it lists the stranger by label.
