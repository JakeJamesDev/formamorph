import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import { metRosterByLocation, runtimeCharacterPositions } from './metEntities';

const bram: Entity = { id: 'bram', name: 'Bram' };
const tilly: Entity = { id: 'tilly', name: 'Tilly' };
const hesk: Entity = { id: 'hesk', name: 'Old Hesk' };
const cast = [bram, tilly, hesk];

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
