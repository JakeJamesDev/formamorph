import { describe, it, expect } from 'vitest';
import type { Entity, GameLocation, Opening, WorldOverview } from '@/types';
import { openingsEditorView } from './openingsEditor';

const action = (id: string, text = `Opening ${id}.`): Opening => ({ id, text, kind: 'action' });

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], ...over,
});

describe('the editor view', () => {
  const loc = (id: string, isStarting = false) => ({ id, name: `Place ${id}`, isStarting }) as unknown as GameLocation;
  const ent = (id: string, locations: string[] | undefined, openings: Opening[], over: Partial<Entity> = {}): Entity =>
    ({ id, name: `Entity ${id}`, locations, openings, ...over });
  const view = (over: Partial<Parameters<typeof openingsEditorView>[0]> = {}, startId?: string | null) =>
    openingsEditorView({ overview: overview(), entities: [], locations: [], ...over }, startId);
  const chances = (v: ReturnType<typeof view>) => v.groups.map((g) => [g.ownerId, g.rows.map((r) => r.chance)]);

  it('lists the world’s rows first, then one group per entity with openings, in cast order', () => {
    const v = view({
      overview: overview({ openings: [action('w1')] }),
      entities: [ent('b', ['dock'], [action('b1')]), ent('none', ['dock'], []), ent('old', ['dock'], undefined as unknown as Opening[]), ent('a', ['dock'], [action('a1')])],
      locations: [loc('dock', true)],
    });
    expect(v.groups.map((g) => [g.ownerId, g.name])).toEqual([[null, 'W'], ['b', 'Entity b'], ['a', 'Entity a']]);
  });

  it('keeps the world group when the world has no rows of its own', () => {
    expect(view().groups).toEqual([{ ownerId: null, name: 'W', rows: [], atNoStart: false }]);
  });

  it('gives each row its chance across every owner drawn at the starting location', () => {
    const v = view({
      overview: overview({ openings: [action('w1'), action('w2')], openingWeights: { w2: 0 } }),
      entities: [ent('g', ['dock'], [action('g1'), action('g2')], { openingWeights: { g2: 2 } })],
      locations: [loc('dock', true)],
    });
    expect(chances(v)).toEqual([[null, [25, 0]], ['g', [25, 50]]]);
    expect(v.groups[1].rows.map((r) => r.weight)).toEqual([1, 2]);
  });

  it('counts the rows of the switched-off list, so a draft reads the odds it will have', () => {
    const v = view({ overview: overview({ openings: [action('w1'), action('w2')], openingsEnabled: false }) });
    expect(chances(v)).toEqual([[null, [50, 50]]]);
  });

  it('describes one starting location, the first unless the author picks another', () => {
    const entities = [ent('d', ['dock'], [action('d1')]), ent('m', ['market'], [action('m1')])];
    const sources = { overview: overview({ openings: [action('w1')] }), entities, locations: [loc('dock', true), loc('market', true)] };
    const first = view(sources);
    expect(first.starts.map((s) => s.id)).toEqual(['dock', 'market']);
    expect(first.describedStartId).toBe('dock');
    expect(chances(first)).toEqual([[null, [50]], ['d', [50]], ['m', [null]]]);

    const market = view(sources, 'market');
    expect(market.describedStartId).toBe('market');
    expect(chances(market)).toEqual([[null, [50]], ['d', [null]], ['m', [50]]]);

    expect(view(sources, 'gone').describedStartId).toBe('dock');
  });

  it('treats every location as a start when none is flagged, as the start of play does', () => {
    const v = view({ entities: [ent('m', ['market'], [action('m1')])], locations: [loc('dock'), loc('market')] });
    expect(v.starts.map((s) => s.id)).toEqual(['dock', 'market']);
    expect(v.groups[1].atNoStart).toBe(false);
  });

  it('marks an entity at no starting location, and gives its rows no chance', () => {
    const v = view({
      entities: [ent('far', ['cave'], [action('f1')]), ent('nowhere', undefined, [action('n1')])],
      locations: [loc('dock', true), loc('cave')],
    });
    expect(v.groups.map((g) => [g.ownerId, g.atNoStart])).toEqual([[null, false], ['far', true], ['nowhere', true]]);
    expect(chances(v)).toEqual([[null, []], ['far', [null]], ['nowhere', [null]]]);
  });

  it('describes no location in a world with none', () => {
    const v = view({ overview: overview({ openings: [action('w1')] }), entities: [ent('g', ['x'], [action('g1')])] });
    expect(v.starts).toEqual([]);
    expect(v.describedStartId).toBeNull();
    expect(chances(v)).toEqual([[null, [100]], ['g', [null]]]);
  });
});
