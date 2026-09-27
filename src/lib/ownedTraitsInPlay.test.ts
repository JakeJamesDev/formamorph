import { describe, it, expect } from 'vitest';
import type { Entity, Placeholder, PlaceholderPin, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { collectPinLayers, collectPins } from './placeholderPins';
import { activeOwnedTraitIds, addedCharacters, inPlayLibrary, pinTraitsInOrder } from './ownedTraitsInPlay';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';

const pin = (placeholderId: string, value: string): PlaceholderPin => ({ placeholderId, value });
const trait = (id: string, pins: PlaceholderPin[] = [], extra: Partial<Trait> = {}): Trait =>
  ({ id, name: id, statChanges: [], ...(pins.length ? { placeholderPins: pins } : {}), ...extra });
const placeholders: Placeholder[] = [{ id: 'mood', name: 'mood', values: phValues(['calm', 'wary', 'fierce']) }];

// Ash sits before the world's Class group in the tree; Bo is placed after it.
const ash: Entity = {
  id: 'ash', name: 'Ash', traitPlacement: { groupId: null, order: 0 },
  traits: [trait('t-tamed', [pin('mood', 'calm')])],
};
const bo: Entity = {
  id: 'bo', name: 'Bo', traitPlacement: { groupId: null, order: 5 },
  traits: [trait('t-feral', [pin('mood', 'fierce')])],
};
const world = {
  traits: [trait('t-paladin', [pin('mood', 'wary')], { groupId: 'g-class' }), trait('t-plain', [], { groupId: 'g-class' })],
  traitGroups: [{ id: 'g-class', name: 'Class', parentId: null, order: 1 }],
  entities: [ash, bo],
};

describe('pinTraitsInOrder — every owner lays its pins, the player last', () => {
  it('lets an NPC’s active owned trait pin a placeholder', () => {
    const traits = pinTraitsInOrder(world, [world.traits[1]], { ash: ['t-tamed'] }, null);
    expect(collectPins({ traits, placeholders })).toEqual({ mood: 'calm' });
  });

  it('lets the player’s world trait beat an NPC’s owned trait on the same placeholder', () => {
    // Bo's node sits after Class in the tree, so tree order alone would hand Bo the win.
    const traits = pinTraitsInOrder(world, [world.traits[0]], { ash: ['t-tamed'], bo: ['t-feral'] }, null);
    const { pins, layers } = collectPinLayers({ traits, placeholders });
    expect(pins).toEqual({ mood: 'wary' });
    expect(layers.map((l) => [l.source.kind === 'trait' && l.source.id, l.wins])).toEqual([
      ['t-tamed', false], ['t-feral', false], ['t-paladin', true],
    ]);
  });

  it('counts the played entity’s owned traits as the player’s, in tree order beside the world traits', () => {
    // Playing as Bo: Bo's Feral now lays after Ash's Tamed, and after Paladin since Bo's node follows Class.
    const asBo = pinTraitsInOrder(world, [world.traits[0]], { ash: ['t-tamed'], bo: ['t-feral'] }, 'bo');
    expect(asBo.map((t) => t.id)).toEqual(['t-tamed', 't-paladin', 't-feral']);
    expect(collectPins({ traits: asBo, placeholders })).toEqual({ mood: 'fierce' });
    // Playing as Ash: Ash's node sits before Class, so Paladin still lays after Tamed.
    const asAsh = pinTraitsInOrder(world, [world.traits[0]], { ash: ['t-tamed'], bo: ['t-feral'] }, 'ash');
    expect(asAsh.map((t) => t.id)).toEqual(['t-feral', 't-tamed', 't-paladin']);
  });

  it('places a library entity’s node last', () => {
    const lib: Entity = { id: 'lib', name: 'Lib', traits: [trait('t-lib', [pin('mood', 'calm')])] };
    const traits = pinTraitsInOrder(world, [world.traits[0]], { lib: ['t-lib'], bo: ['t-feral'] }, 'lib', [lib]);
    expect(traits.map((t) => t.id)).toEqual(['t-feral', 't-paladin', 't-lib']);
  });

  it('lays nothing for an owned trait that is not active, or an owner the playthrough does not hold', () => {
    const traits = pinTraitsInOrder(world, [], { ash: [], ghost: ['t-gone'] }, null);
    expect(traits).toEqual([]);
  });
});

describe('activeOwnedTraitIds', () => {
  it('reads each entity’s chosen traits less the ones switched off', () => {
    expect(activeOwnedTraitIds({ ash: { chosen: ['a', 'b'], disabled: ['a'] }, bo: { chosen: ['c'] } }))
      .toEqual({ ash: ['b'], bo: ['c'] });
  });
});

describe('the library entities in play', () => {
  const world = { traits: [trait('w-paladin', [], { name: 'Paladin' })], traitGroups: [], entities: [] };
  const persona: Entity = {
    id: 'lib-wren', name: 'Wren', persona: true,
    traits: [trait('t-oath', [], { requires: [{ kind: 'trait', id: 'elsewhere', name: 'Paladin' }] })],
  };
  const added: Entity = { id: 'copy-moss', name: 'Moss', traits: [trait('t-calm')] };

  it('lists the library persona, then the characters added at Enter World, never a character met in play', () => {
    const discovered = [
      { entity: added, locationId: 'dock', sourceTurnId: INITIAL_SOURCE_TURN_ID },
      { entity: { id: 'met', name: 'Met' }, locationId: 'dock', sourceTurnId: 'turn-3' },
    ];
    expect(inPlayLibrary(world, persona, addedCharacters(discovered)).map((e) => e.id)).toEqual(['lib-wren', 'copy-moss']);
  });

  it("binds the library persona's requirements to the world by name", () => {
    expect(inPlayLibrary(world, persona)[0].traits![0].requires).toEqual([{ kind: 'trait', id: 'w-paladin', name: 'Paladin' }]);
  });
});
