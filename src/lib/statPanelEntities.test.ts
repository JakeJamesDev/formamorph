import { describe, expect, it } from 'vitest';
import type { Entity, PlayerStat, SceneEntity } from '@/types';
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

const inScene = (...rows: [Entity, string | null][]) => rows.map(([e, label]) => ({ entity: e, label }));

describe('statPanelOptions', () => {
  it('lists the In Scene entities in order, under their labels', () => {
    const list = statPanelOptions({ persona: null, scene: inScene([wick, 'Wick'], [bram, 'Bram']) });
    expect(list.map((o) => o.label)).toEqual(['Wick', 'Bram']);
  });

  it('never lists an entity that is not in scene, whatever stats it owns', () => {
    const list = statPanelOptions({ persona: null, scene: inScene([bram, 'Bram']) });
    expect(list.map((o) => o.id)).toEqual(['bram']);
  });

  it('lists an In Scene entity that owns no stats', () => {
    expect(statPanelOptions({ persona: null, scene: inScene([entity('Mute'), 'Mute']) }).map((o) => o.label)).toEqual(['Mute']);
  });

  it('puts the played persona first and marks it as the player’s, with its bare name', () => {
    const list = statPanelOptions({ persona: you, scene: inScene([bram, 'Bram']) });
    expect(list.map((o) => o.label)).toEqual(['Sera', 'Bram']);
    expect(list.map((o) => o.you ?? false)).toEqual([true, false]);
  });

  it('shows a stranger by its label, never its name', () => {
    const list = statPanelOptions({ persona: null, scene: inScene([bram, 'the ferryman']) });
    expect(list.map((o) => o.label)).toEqual(['the ferryman']);
  });

  it('leaves out an entity with no label', () => {
    expect(statPanelOptions({ persona: null, scene: inScene([bram, null], [odette, 'Odette']) }).map((o) => o.id)).toEqual(['odette']);
  });

  it('numbers labels only when two collide', () => {
    const list = statPanelOptions({ persona: null, scene: inScene([bram, 'a gate guard'], [wick, 'a gate guard'], [odette, 'Odette']) });
    expect(list.map((o) => o.label)).toEqual(['a gate guard', 'a gate guard (2)', 'Odette']);
  });

  it('lists an entity once when the scene holds it twice', () => {
    expect(statPanelOptions({ persona: null, scene: inScene([bram, 'Bram'], [bram, 'Bram']) })).toHaveLength(1);
  });
});

describe('statPanelSelection', () => {
  const list = statPanelOptions({ persona: null, scene: inScene([bram, 'Bram'], [odette, 'Odette']) });

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
