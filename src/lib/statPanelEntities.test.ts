import { describe, expect, it } from 'vitest';
import type { Entity, EntityStatValues, PlayerStat, SceneEntity } from '@/types';
import { shownEntityStats, statPanelOptions, statPanelSelection, firstShowableEntity } from './statPanelEntities';

const entity = (name: string, overrides: Partial<Entity> = {}): Entity =>
  ({ id: name.toLowerCase(), name, ...overrides }) as Entity;
const stat = (name: string, overrides: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id: name.toLowerCase(), name, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], value: 5, ...overrides });
const seen = (name: string, extra: Partial<SceneEntity> = {}): SceneEntity => ({ name, revealed: true, ...extra });

const bram = entity('Bram');
const odette = entity('Odette');
const wick = entity('Wick');
const you = entity('Sera');
const values: EntityStatValues = { bram: [stat('Trust')], odette: [stat('Stock')], wick: [stat('Nerve')] };

// An earlier scene where the player met all three, so an absent entity reads by name unless a case says otherwise.
const met = [[seen('Bram'), seen('Odette'), seen('Wick')]];
const options = (over: Partial<Parameters<typeof statPanelOptions>[0]> = {}) =>
  statPanelOptions({ entities: [bram, odette, wick], persona: null, scene: [], history: met, values, ...over });

describe('statPanelOptions', () => {
  it('lists present entities first, in scene order, then absent entities that own stats', () => {
    const list = options({ scene: [seen('Wick'), seen('Bram')] });
    expect(list.map((o) => [o.label, o.present])).toEqual([['Wick', true], ['Bram', true], ['Odette', false]]);
  });

  it('leaves out an absent entity that owns no stats', () => {
    const list = options({ entities: [bram, entity('Mute')], values: { bram: [stat('Trust')] } });
    expect(list.map((o) => o.label)).toEqual(['Bram']);
  });

  it('leaves out an absent entity whose stats are all hidden or switched off', () => {
    const list = options({
      values: { ...values, odette: [stat('Secret', { hidden: true })], wick: [stat('Dormant', { enabled: false })] },
    });
    expect(list.map((o) => o.label)).toEqual(['Bram']);
  });

  it('lists a present entity that owns no stats', () => {
    const list = options({ entities: [bram, entity('Mute')], scene: [seen('Mute')], values: { bram: [stat('Trust')] } });
    expect(list.map((o) => o.label)).toEqual(['Mute', 'Bram']);
  });

  it('puts the played persona first and marks it as the player’s, with its bare name', () => {
    const list = options({ persona: you, scene: [seen('Bram')] });
    expect(list.map((o) => o.label)).toEqual(['Sera', 'Bram', 'Odette', 'Wick']);
    expect(list.map((o) => o.you ?? false)).toEqual([true, false, false, false]);
    expect(list[0].present).toBe(true);
  });

  it('labels an unrevealed present entity by its alias, never its name', () => {
    const list = options({ scene: [{ name: 'Bram', alias: 'the ferryman', revealed: false }] });
    expect(list[0].label).toBe('the ferryman');
    expect(list.some((o) => o.label === 'Bram')).toBe(false);
  });

  it('labels an unrevealed present entity with no alias Unknown', () => {
    expect(options({ scene: [{ name: 'Bram', revealed: false }] })[0].label).toBe('Unknown');
  });

  it('lists an absent entity only once some turn revealed its name', () => {
    const list = options({ history: [[seen('Odette')], [{ name: 'Wick', alias: 'a thin runner', revealed: false }]] });
    expect(list.map((o) => o.label)).toEqual(['Odette']);
  });

  it('keeps a picked absent entity that never got a name, by its last alias', () => {
    const list = options({
      entities: [bram],
      keep: 'bram',
      history: [[{ name: 'Bram', alias: 'a hooded man', revealed: false }], [{ name: 'Bram', alias: 'the ferryman', revealed: false }]],
    });
    expect(list.map((o) => o.label)).toEqual(['the ferryman']);
  });

  it('keeps the name once revealed even when a later scene shows it unrevealed', () => {
    const list = options({ entities: [bram], history: [[seen('Bram')], [{ name: 'Bram', alias: 'the ferryman', revealed: false }]] });
    expect(list[0].label).toBe('Bram');
  });

  it('numbers labels only when two collide', () => {
    const list = options({ scene: [{ name: 'Bram', revealed: false }, { name: 'Wick', revealed: false }, seen('Odette')] });
    expect(list.map((o) => o.label)).toEqual(['Unknown', 'Unknown (2)', 'Odette']);
  });

  it('lists an entity once when the scene names it twice', () => {
    const list = options({ scene: [seen('Bram'), seen('Bram')] });
    expect(list.filter((o) => o.id === 'bram')).toHaveLength(1);
  });

  it('skips a scene name that matches no entity', () => {
    const list = options({ scene: [seen('A Stranger'), seen('Bram')] });
    expect(list.map((o) => o.label)).toEqual(['Bram', 'Odette', 'Wick']);
  });

  it('keeps the selected entity listed when it is absent and owns no stats', () => {
    const mute = entity('Mute');
    const list = options({ entities: [bram, mute], values: { bram: [stat('Trust')] }, keep: 'mute', history: [[seen('Mute'), seen('Bram')]] });
    expect(list.map((o) => o.label)).toEqual(['Bram', 'Mute']);
  });
});

describe('statPanelSelection', () => {
  const list = options({ scene: [seen('Bram')] });

  it('reads no pick as the fallback entity', () => {
    expect(statPanelSelection(undefined, list, 'bram')).toBe('bram');
  });

  it('reads no pick and no fallback as (None)', () => {
    expect(statPanelSelection(undefined, list, undefined)).toBeNull();
  });

  it('keeps a pick that is listed, over the fallback', () => {
    expect(statPanelSelection('odette', list, 'bram')).toBe('odette');
  });

  it('keeps (None) over the fallback', () => {
    expect(statPanelSelection(null, list, 'bram')).toBeNull();
  });

  it('reads a pick that matches nothing listed as the fallback', () => {
    expect(statPanelSelection('gone', list, 'bram')).toBe('bram');
  });
});

describe('firstShowableEntity', () => {
  it('returns the first scene entity the predicate accepts, resolved by name', () => {
    const found = firstShowableEntity([seen('Odette'), seen('Bram')], [bram, odette], (e) => e.id === 'bram');
    expect(found?.id).toBe('bram');
  });

  it('returns undefined when nobody shows', () => {
    expect(firstShowableEntity([seen('Bram')], [bram], () => false)).toBeUndefined();
  });
});

describe('shownEntityStats', () => {
  it('drops hidden and switched-off stats', () => {
    const rows = shownEntityStats([
      stat('Trust'), stat('Secret', { hidden: true }), stat('Dormant', { enabled: false }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Trust']);
  });

  it('reads no stats as an empty list', () => {
    expect(shownEntityStats(undefined)).toEqual([]);
  });
});
