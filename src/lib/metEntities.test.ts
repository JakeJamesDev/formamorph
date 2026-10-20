import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import { metFromScene, metRosterByLocation, runtimeCharacterPositions } from './metEntities';

const bram: Entity = { id: 'bram', name: 'Bram' };
const tilly: Entity = { id: 'tilly', name: 'Tilly' };
const hesk: Entity = { id: 'hesk', name: 'Old Hesk' };
const cast = [bram, tilly, hesk];

describe('metFromScene', () => {
  it('adds each named entity in the scene, in scene order', () => {
    const met = metFromScene([], [{ name: 'Tilly', revealed: true }, { name: 'Bram', revealed: true }], cast);
    expect(met).toEqual(['tilly', 'bram']);
  });

  it('holds back an alias-only stranger until the narration names them', () => {
    const stranger = [{ name: 'Old Hesk', alias: 'the hooded man', revealed: false }];
    expect(metFromScene([], stranger, cast)).toEqual([]);
    expect(metFromScene([], [{ ...stranger[0], revealed: true }], cast)).toEqual(['hesk']);
  });

  it('skips a scene name with no entity behind it', () => {
    expect(metFromScene([], [{ name: 'A passing cart driver', revealed: true }], cast)).toEqual([]);
  });

  it('keeps an entity met after it leaves the scene', () => {
    expect(metFromScene(['bram'], [{ name: 'Tilly', revealed: true }], cast)).toEqual(['bram', 'tilly']);
  });

  it('returns the same array when nobody new is met', () => {
    const met = ['bram'];
    expect(metFromScene(met, [{ name: 'Bram', revealed: true }], cast)).toBe(met);
  });
});

describe('metRosterByLocation', () => {
  it('lists each met entity with a position at that position', () => {
    const roster = metRosterByLocation({ entities: cast, positions: { bram: 'market', tilly: 'market', hesk: 'keep' }, met: ['bram', 'tilly', 'hesk'] });
    expect(roster).toEqual({ market: ['Bram', 'Tilly'], keep: ['Old Hesk'] });
  });

  it('shows nothing for an entity the player has not met', () => {
    const roster = metRosterByLocation({ entities: cast, positions: { bram: 'market', tilly: 'keep' }, met: ['bram'] });
    expect(roster).toEqual({ market: ['Bram'] });
  });

  it('shows nothing for a met entity with no position', () => {
    expect(metRosterByLocation({ entities: cast, positions: {}, met: ['bram'] })).toEqual({});
  });

  it('skips a met id whose entity is gone', () => {
    expect(metRosterByLocation({ entities: cast, positions: { ghost: 'keep' }, met: ['ghost'] })).toEqual({});
  });
});

describe('runtimeCharacterPositions', () => {
  it('places each runtime character where it was met, and skips one with no location', () => {
    const positions = runtimeCharacterPositions([
      { entity: { id: 'cart', name: 'Cart Driver' }, locationId: 'road', sourceTurnId: 't1' },
      { entity: { id: 'voice', name: 'A Voice' }, sourceTurnId: 't2' },
    ]);
    expect(positions).toEqual({ cart: 'road' });
  });
});
