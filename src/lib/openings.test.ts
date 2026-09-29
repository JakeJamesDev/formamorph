import { describe, it, expect } from 'vitest';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { Entity, GameLocation, Opening, WorldOverview } from '@/types';
import {
  addOpening, DEFAULT_OPENING, drawOpening, drawPoolEntry, openingOwner, isOpeningFieldKey, moveOpening, openingChances, openingFieldKey, openingsEditorView,
  drawUnseenOpening, hasAuthoredOpenings, openingPool, openingsEnabled, poolKey, remintOpenings, openingTexts, removeOpening, resolveOpening, setOpeningKind,
  setOpeningText, setOpeningWeight,
} from './openings';

/** Mulberry32: a small seeded source, so a draw test is repeatable without mocking a global. */
const seeded = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const action = (id: string, text = `Opening ${id}.`): Opening => ({ id, text, kind: 'action' });

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], ...over,
});

/** How often each opening comes up over many seeded draws. */
const tally = (ov: WorldOverview, draws = 20000, seed = 7) => {
  const random = seeded(seed);
  const pool = openingPool({ overview: ov });
  const counts: Record<string, number> = {};
  for (let i = 0; i < draws; i++) {
    const id = drawOpening(pool, random).id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

describe('the draw', () => {
  it('returns the shipped default Opening Action for an empty pool', () => {
    for (const ov of [overview(), overview({ openings: [] }), null, undefined]) {
      expect(resolveOpening(ov, seeded(1))).toEqual(DEFAULT_OPENING);
    }
    expect(DEFAULT_OPENING).toMatchObject({ kind: 'action', text: OPENING_SCENE_CUE });
  });

  it('returns the default when the list is switched off, and keeps the rows', () => {
    const ov = overview({ openings: [action('a')], openingsEnabled: false });
    expect(openingsEnabled(ov)).toBe(false);
    expect(resolveOpening(ov, seeded(1))).toEqual(DEFAULT_OPENING);
    expect(ov.openings).toHaveLength(1);
  });

  it('reads whether an owner has written an opening, counting a benched row', () => {
    expect(hasAuthoredOpenings({ openings: [action('a')] })).toBe(true);
    // Weight 0 benches one row, not the list, so it still counts as written.
    expect(hasAuthoredOpenings({ openings: [action('a')], openingWeights: { a: 0 } })).toBe(true);
    expect(hasAuthoredOpenings(undefined)).toBe(false);
    expect(hasAuthoredOpenings({ openings: [] })).toBe(false);
    expect(hasAuthoredOpenings({ openings: [action('a', '   ')] })).toBe(false);
  });

  it('derives off for a world that has no opening anywhere, and on once one exists', () => {
    expect(openingsEnabled(overview())).toBe(false);
    expect(openingsEnabled(overview({ openings: [action('a', '   ')] }))).toBe(false);
    expect(openingsEnabled(overview({ openings: [action('a')] }))).toBe(true);
    // An entity's opening switches the world's list on by itself.
    expect(openingsEnabled(overview(), [{ openings: [action('e1')] }])).toBe(true);
    // The author's off still wins over both.
    expect(openingsEnabled(overview({ openings: [action('a')], openingsEnabled: false }))).toBe(false);
  });

  it('draws an authored opening under an absent switch, which the rows themselves turn on', () => {
    expect(openingsEnabled(overview({ openings: [action('a')] }))).toBe(true);
    expect(resolveOpening(overview({ openings: [action('a')] }), seeded(1)).id).toBe('a');
  });

  it('returns the default when every row weighs 0', () => {
    const ov = overview({ openings: [action('a'), action('b')], openingWeights: { a: 0, b: 0 } });
    expect(resolveOpening(ov, seeded(1))).toEqual(DEFAULT_OPENING);
  });

  it('never draws a weight 0 row', () => {
    const counts = tally(overview({ openings: [action('a'), action('b')], openingWeights: { b: 0 } }));
    expect(counts).toEqual({ a: 20000 });
  });

  it('never draws a blank row', () => {
    const ov = overview({ openings: [action('a', '  \n '), action('b')] });
    expect(tally(ov)).toEqual({ b: 20000 });
    expect(resolveOpening(overview({ openings: [action('a', '')] }), seeded(1))).toEqual(DEFAULT_OPENING);
  });

  it('draws by weight, with a missing weight counting as 1', () => {
    const counts = tally(overview({ openings: [action('a'), action('b'), action('c')], openingWeights: { b: 3 } }));
    // Expected shares 1:3:1 of 20000 draws.
    expect(counts.a / 20000).toBeCloseTo(0.2, 1);
    expect(counts.b / 20000).toBeCloseTo(0.6, 1);
    expect(counts.c / 20000).toBeCloseTo(0.2, 1);
  });

  it('maps the random source onto the rows in authored order', () => {
    const pool = openingPool({ overview: overview({ openings: [action('a'), action('b')], openingWeights: { a: 3 } }) });
    expect(drawOpening(pool, () => 0).id).toBe('a');
    expect(drawOpening(pool, () => 0.74).id).toBe('a');
    expect(drawOpening(pool, () => 0.76).id).toBe('b');
    expect(drawOpening(pool, () => 0.999).id).toBe('b');
  });
});

describe('the no-repeat draw', () => {
  const pool = (ids: string[], weights?: Record<string, number>) =>
    openingPool({ overview: overview({ openings: ids.map((id) => action(id)), openingWeights: weights }) });
  /** The shown-list key of the world's own row `id`. */
  const k = (id: string) => poolKey({ ownerId: null, opening: action(id), weight: 1 });
  const ks = (...ids: string[]) => ids.map(k);

  it('shows every opening once before any repeats, whatever the weights', () => {
    const rows = pool(['a', 'b', 'c', 'd'], { a: 50 });
    for (let seed = 1; seed <= 25; seed++) {
      const random = seeded(seed);
      let shown: string[] = [];
      for (let i = 0; i < 4; i++) shown = drawUnseenOpening(rows, shown, random).shown;
      expect([...shown].sort()).toEqual(ks('a', 'b', 'c', 'd').sort());
    }
  });

  it('draws the unseen rows by weight', () => {
    const rows = pool(['a', 'b', 'c'], { c: 3 });
    const random = seeded(3);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 8000; i++) {
      const id = drawUnseenOpening(rows, ks('a'), random).opening.id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.a).toBeUndefined();
    expect(counts.c / 8000).toBeCloseTo(0.75, 1);
  });

  it('starts the set over when all are shown, and never repeats the one on screen', () => {
    const rows = pool(['a', 'b', 'c']);
    for (let seed = 1; seed <= 25; seed++) {
      const next = drawUnseenOpening(rows, ks('a', 'c', 'b'), seeded(seed));
      expect(next.opening.id).not.toBe('b');
      expect(next.shown).toEqual(ks('b', next.opening.id));
    }
  });

  it('returns the same opening from a pool of one', () => {
    const rows = pool(['a']);
    const first = drawUnseenOpening(rows, [], seeded(1));
    expect(first).toEqual({ ownerId: null, opening: action('a'), shown: ks('a') });
    expect(drawUnseenOpening(rows, first.shown, seeded(2))).toEqual(first);
  });

  it('ignores a shown id that left the pool', () => {
    const next = drawUnseenOpening(pool(['a', 'b']), ks('gone', 'a'), seeded(1));
    expect(next.opening.id).toBe('b');
  });

  it('returns the default for an empty pool and leaves the shown set alone', () => {
    expect(drawUnseenOpening([], ks('a'), seeded(1))).toEqual({ ownerId: null, opening: DEFAULT_OPENING, shown: ks('a') });
  });
});

describe('the pool with entities', () => {
  const guide = (over: Partial<Entity> = {}): Entity => ({
    id: 'guide', name: 'Guide', locations: ['dock'], openings: [action('g1', 'The guide waves.')], ...over,
  });
  const texts = (pool: { opening: Opening }[]) => pool.map((e) => e.opening.text);

  it('adds the rows of an entity at the starting location after the world’s own', () => {
    const pool = openingPool({
      overview: overview({ openings: [action('w1', 'The world opens.')] }),
      entities: [guide()],
      startingLocationId: 'dock',
    });
    expect(texts(pool)).toEqual(['The world opens.', 'The guide waves.']);
    expect(pool.map((e) => e.ownerId)).toEqual([null, 'guide']);
  });

  it('says which entity owns the row a draw lands on', () => {
    const pool = openingPool({ overview: overview(), entities: [guide()], startingLocationId: 'dock' });
    const drawn = drawUnseenOpening(pool, [], seeded(1));
    expect(drawn.ownerId).toBe('guide');
    expect(drawPoolEntry(pool, seeded(1)).ownerId).toBe('guide');
    expect(openingOwner(drawn.ownerId, [guide()])?.name).toBe('Guide');
    expect(openingOwner(null, [guide()])).toBeNull();
    expect(drawPoolEntry([], seeded(1))).toEqual({ ownerId: null, opening: DEFAULT_OPENING });
  });

  it('adds nothing for an entity somewhere else', () => {
    const pool = openingPool({ overview: overview(), entities: [guide({ locations: ['market'] })], startingLocationId: 'dock' });
    expect(pool).toEqual([]);
    expect(drawOpening(pool, seeded(1))).toEqual(DEFAULT_OPENING);
  });

  it('adds nothing, with no error, for an entity written before openings', () => {
    const older: Entity = { id: 'old', name: 'Old', locations: ['dock'] };
    expect(openingPool({ overview: overview(), entities: [older], startingLocationId: 'dock' })).toEqual([]);
  });

  it('adds nothing for an entity at no location, or with no starting location chosen', () => {
    expect(openingPool({ overview: overview(), entities: [guide({ locations: undefined })], startingLocationId: 'dock' })).toEqual([]);
    expect(openingPool({ overview: overview(), entities: [guide()], startingLocationId: null })).toEqual([]);
  });

  it('follows whichever of several starting locations was chosen', () => {
    const entities = [
      guide(),
      { id: 'clerk', name: 'Clerk', locations: ['market'], openings: [action('c1', 'The clerk looks up.')] },
      { id: 'both', name: 'Both', locations: ['dock', 'market'], openings: [action('b1', 'A voice calls.')] },
    ];
    const ov = overview({ openings: [action('w1', 'The world opens.')] });
    expect(texts(openingPool({ overview: ov, entities, startingLocationId: 'dock' })))
      .toEqual(['The world opens.', 'The guide waves.', 'A voice calls.']);
    expect(texts(openingPool({ overview: ov, entities, startingLocationId: 'market' })))
      .toEqual(['The world opens.', 'The clerk looks up.', 'A voice calls.']);
  });

  it('draws an entity’s rows by their own weights, benched and blank rows left out', () => {
    const entity = guide({
      openings: [action('g1', 'Often.'), action('g2', 'Rarely.'), action('g3', 'Benched.'), action('g4', '  ')],
      openingWeights: { g1: 3, g3: 0 },
    });
    const pool = openingPool({ overview: overview(), entities: [entity], startingLocationId: 'dock' });
    expect(pool.map((e) => [e.opening.text, e.weight])).toEqual([['Often.', 3], ['Rarely.', 1]]);
  });

  it('removes the entities’ rows along with the world’s when the world switch is off', () => {
    const pool = openingPool({
      overview: overview({ openings: [action('w1')], openingsEnabled: false }),
      entities: [guide()],
      startingLocationId: 'dock',
    });
    expect(pool).toEqual([]);
  });

  it('reads the entities it is handed, so a deleted entity’s rows are gone', () => {
    const ov = overview();
    expect(openingPool({ overview: ov, entities: [guide()], startingLocationId: 'dock' })).toHaveLength(1);
    expect(openingPool({ overview: ov, entities: [], startingLocationId: 'dock' })).toEqual([]);
  });

  it('keeps two entities that share opening ids apart, in the draw and in the shown list', () => {
    // One library entity added twice: two entity ids, the same opening ids.
    const copies = [guide({ id: 'copy-1' }), guide({ id: 'copy-2' })];
    const pool = openingPool({ overview: overview(), entities: copies, startingLocationId: 'dock' });
    expect(pool).toHaveLength(2);
    expect(new Set(pool.map(poolKey)).size).toBe(2);
    for (let seed = 1; seed <= 25; seed++) {
      const first = drawUnseenOpening(pool, [], seeded(seed));
      const second = drawUnseenOpening(pool, first.shown, seeded(seed + 100));
      // The second draw still has an unseen row, so the list has not started over.
      expect(second.shown).toHaveLength(2);
      expect(new Set(second.shown).size).toBe(2);
    }
  });
});

describe('the pool with picked entities', () => {
  const world = overview({ openings: [action('w1', 'The world opens.')] });
  const guide: Entity = { id: 'guide', name: 'Guide', locations: ['dock'], openings: [action('g1', 'The guide waves.')] };
  const pick = (id: string, openings: Opening[], openingWeights?: Record<string, number>): Entity =>
    ({ id, name: id, openings, openingWeights });
  const texts = (pool: { opening: Opening }[]) => pool.map((e) => e.opening.text);

  it('draws only the picked entities’ rows when one of them has a drawable opening', () => {
    const pool = openingPool({
      overview: world, entities: [guide], startingLocationId: 'dock',
      picked: [pick('bard', [action('b1', 'The bard tunes up.')])],
    });
    expect(texts(pool)).toEqual(['The bard tunes up.']);
    expect(pool.map((e) => e.ownerId)).toEqual(['bard']);
  });

  it('pools several picked entities’ rows together by weight', () => {
    const picked = [
      pick('bard', [action('b1', 'Bard.')], { b1: 3 }),
      pick('smith', [action('s1', 'Smith.')]),
    ];
    const pool = openingPool({ overview: world, picked });
    expect(pool.map((e) => [e.ownerId, e.weight])).toEqual([['bard', 3], ['smith', 1]]);
    const random = seeded(11);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const text = drawOpening(pool, random).text;
      counts[text] = (counts[text] ?? 0) + 1;
    }
    expect(counts['Bard.'] / 20000).toBeCloseTo(0.75, 1);
    expect(counts['The world opens.']).toBeUndefined();
  });

  it('leaves the world’s pool in effect when no picked entity has a drawable opening', () => {
    const picked = [
      pick('plain', []),
      { id: 'older', name: 'Older' },
      pick('benched', [action('x1', 'Benched.')], { x1: 0 }),
      pick('blank', [action('y1', '   ')]),
    ];
    const pool = openingPool({ overview: world, entities: [guide], startingLocationId: 'dock', picked });
    expect(texts(pool)).toEqual(['The world opens.', 'The guide waves.']);
  });

  it('benches the picked entities’ rows too when the world switch is off', () => {
    const off = overview({ openings: [action('w1')], openingsEnabled: false });
    const picked = [pick('bard', [action('b1', 'Bard.')])];
    expect(openingPool({ overview: off, entities: [guide], startingLocationId: 'dock', picked })).toEqual([]);
    // The same pick draws once the switch is on, so the empty pool is the switch and not the pick.
    const on = overview({ openings: [action('w1')] });
    expect(texts(openingPool({ overview: on, entities: [guide], startingLocationId: 'dock', picked }))).toEqual(['Bard.']);
  });
});

describe('fresh opening ids', () => {
  it('re-mints every row and re-keys the weights to follow', () => {
    const next = remintOpenings({ openings: [action('a'), action('b')], openingWeights: { b: 5, gone: 2 } });
    const ids = (next.openings ?? []).map((o) => o.id);
    expect(next.openings?.map((o) => o.text)).toEqual(['Opening a.', 'Opening b.']);
    expect(ids).not.toContain('a');
    expect(new Set(ids).size).toBe(2);
    expect(next.openingWeights).toEqual({ [ids[1]]: 5 });
  });

  it('writes nothing for an owner with no rows', () => {
    expect(remintOpenings({})).toEqual({});
    expect(remintOpenings({ openings: [] })).toEqual({});
  });
});

describe('the chance each row shows', () => {
  it('agrees with the draw, blank and benched rows at 0', () => {
    const ov = overview({
      openings: [action('a'), action('b'), action('c'), action('d', ' ')],
      openingWeights: { b: 3, c: 0 },
    });
    expect(openingChances(ov)).toEqual({ a: 25, b: 75, c: 0, d: 0 });
  });

  it('reads 0 on every row when the list draws nothing', () => {
    expect(openingChances(overview({ openings: [action('a')], openingWeights: { a: 0 } }))).toEqual({ a: 0 });
  });
});

describe('what the editor writes', () => {
  it('adds an empty Opening Action at the end under a fresh id', () => {
    const ov = overview({ openings: [action('a')] });
    const next = addOpening(ov).openings!;
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(ov.openings![0]);
    expect(next[1]).toMatchObject({ text: '', kind: 'action' });
    expect(next[1].id).not.toBe('a');
  });

  it('drops a removed row together with its weight', () => {
    const ov = overview({ openings: [action('a'), action('b')], openingWeights: { a: 2, b: 5 } });
    expect(removeOpening(ov, 'b')).toEqual({ openings: [action('a')], openingWeights: { a: 2 } });
    expect(removeOpening(ov, 'b').openingWeights).toEqual({ a: 2 });
    expect(removeOpening({ ...ov, openingWeights: { b: 5 } }, 'b')).toEqual({ openings: [action('a')], openingWeights: undefined });
  });

  it('stores only a weight that differs from 1', () => {
    const ov = overview({ openings: [action('a')] });
    expect(setOpeningWeight(ov, 'a', 4)).toEqual({ openingWeights: { a: 4 } });
    expect(setOpeningWeight({ ...ov, openingWeights: { a: 4 } }, 'a', 1)).toEqual({ openingWeights: undefined });
    expect(setOpeningWeight(ov, 'a', 0)).toEqual({ openingWeights: { a: 0 } });
  });

  it('sets the kind of one row and leaves the others', () => {
    const ov = overview({ openings: [action('a'), action('b')] });
    expect(setOpeningKind(ov, 'b', 'narration').openings).toEqual([action('a'), { ...action('b'), kind: 'narration' }]);
  });

  it('edits text in place and moves rows without touching weights', () => {
    const ov = overview({ openings: [action('a'), action('b'), action('c')], openingWeights: { c: 2 } });
    expect(setOpeningText(ov, 'b', 'New.').openings!.map((o) => o.text)).toEqual(['Opening a.', 'New.', 'Opening c.']);
    expect(moveOpening(ov, 2, 0)).toEqual({ openings: [action('c'), action('a'), action('b')] });
  });
});

describe('where openings are found', () => {
  it('lists every row text for chip priming and search, switched off or not', () => {
    const ov = overview({ openings: [action('a'), action('b')], openingsEnabled: false });
    expect(openingTexts(ov)).toEqual(['Opening a.', 'Opening b.']);
    expect(openingTexts(null)).toEqual([]);
  });

  it('names each row with a find-bar key the panel recognizes', () => {
    expect(isOpeningFieldKey(openingFieldKey('a'))).toBe(true);
    expect(isOpeningFieldKey('readme')).toBe(false);
    expect(isOpeningFieldKey(undefined)).toBe(false);
  });
});

describe('the editor view', () => {
  const loc = (id: string, isStarting = false) => ({ id, name: `Place ${id}`, isStarting }) as unknown as GameLocation;
  const ent = (id: string, locations: string[] | undefined, openings: Opening[], over: Partial<Entity> = {}): Entity =>
    ({ id, name: `Entity ${id}`, locations, openings, ...over });
  const view = (over: Partial<Parameters<typeof openingsEditorView>[0]> = {}, startId?: string | null) =>
    openingsEditorView({ overview: overview(), entities: [], locations: [], ...over }, startId);
  const chances = (v: ReturnType<typeof view>) => v.groups.map((g) => [g.entity?.id ?? null, g.rows.map((r) => r.chance)]);

  it('lists location groups in the location tree’s order, a child under its parent', () => {
    const withRow = (l: GameLocation) => ({ ...l, openings: [action(`${l.id}-row`)] });
    const child = { ...loc('child'), parentId: 'parent' } as GameLocation;
    const v = view({ locations: [loc('parent', true), loc('other'), child].map(withRow) });
    expect(v.groups.flatMap((g) => (g.location ? [g.location.id] : []))).toEqual(['parent', 'child', 'other']);
  });

  it('gives a location and an entity sharing an id and an opening id their own chances', () => {
    const dock = { ...loc('dock', true), openings: [action('x')] };
    const v = view({ locations: [dock], entities: [ent('dock', ['dock'], [action('x')], { openingWeights: { x: 3 } })] });
    expect(v.groups.map((g) => [g.location ? 'location' : g.entity ? 'entity' : 'world', g.rows.map((r) => r.chance)]))
      .toEqual([['world', []], ['location', [25]], ['entity', [75]]]);
  });

  it('lists the world’s rows first, then one group per entity with openings, in cast order', () => {
    const v = view({
      overview: overview({ openings: [action('w1')] }),
      entities: [ent('b', ['dock'], [action('b1')]), ent('none', ['dock'], []), // An entity written before openings carries no list at all.
        ent('old', ['dock'], undefined as unknown as Opening[]), ent('a', ['dock'], [action('a1')])],
      locations: [loc('dock', true)],
    });
    expect(v.groups.map((g) => [g.entity?.id ?? null, g.name])).toEqual([[null, 'W'], ['b', 'Entity b'], ['a', 'Entity a']]);
  });

  it('keeps the world group when the world has no rows of its own', () => {
    expect(view().groups).toEqual([{ entity: null, name: 'W', rows: [], showSelf: false, atNoStart: false }]);
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

  it('reads 0 for a blank or benched row', () => {
    const v = view({
      overview: overview({ openings: [action('w1'), action('blank', ''), action('bench')], openingWeights: { bench: 0 } }),
      entities: [ent('near', ['dock'], [action('n1', '')])],
      locations: [loc('dock', true), loc('cave', true)],
    }, 'dock');
    expect(chances(v)).toEqual([[null, [100, 0, 0]], ['near', [0]]]);
  });

  it('counts the rows of the switched-off list, so a draft reads the odds it will have', () => {
    const v = view({ overview: overview({ openings: [action('w1'), action('w2')], openingsEnabled: false }) });
    expect(chances(v)).toEqual([[null, [50, 50]]]);
  });

  describe('with several starts', () => {
    const self = (id: string): Opening => ({ ...action(id), self: true });
    const sources = {
      overview: overview({ openings: [action('w1')] }),
      entities: [
        ent('d', ['dock'], [action('d1')]),
        ent('m', ['market'], [action('m1')]),
        ent('p', ['market'], [action('p1'), self('ps1'), self('ps2')], { persona: true, openingWeights: { ps2: 3 } }),
      ],
      locations: [
        { ...loc('dock', true), openings: [action('dock1')] },
        { ...loc('market', true), openings: [action('market1')] },
        { ...loc('cave'), openings: [action('cave1')] },
      ],
    };
    const owners = (v: ReturnType<typeof view>) => v.groups.map((g) => g.location?.id ?? g.entity?.id ?? null);

    it('open on All Locations, listing every group with chances on Self rows only', () => {
      const v = view(sources);
      expect(v.allLocations).toBe(true);
      expect(v.startId).toBeNull();
      expect(v.starts.map((s) => s.id)).toEqual(['dock', 'market']);
      expect(owners(v)).toEqual([null, 'dock', 'market', 'cave', 'd', 'm', 'p']);
      expect(v.groups.map((g) => g.atNoStart)).toEqual([false, false, false, true, false, false, false]);
      expect(chances(v)).toEqual([[null, [null]], [null, [null]], [null, [null]], [null, [null]],
        ['d', [null]], ['m', [null]], ['p', [null, 25, 75]]]);
      expect(view(sources, 'gone').allLocations).toBe(true);
      expect(view(sources, 'cave').allLocations).toBe(true);
    });

    it('keep, at a picked start, only what draws there and every Self row', () => {
      const dock = view(sources, 'dock');
      expect(dock.allLocations).toBe(false);
      expect(dock.startId).toBe('dock');
      expect(owners(dock)).toEqual([null, 'dock', 'd', 'p']);
      expect(chances(dock)).toEqual([[null, [33.33333333333333]], [null, [33.33333333333333]], ['d', [33.33333333333333]], ['p', [25, 75]]]);
      expect(dock.groups.every((g) => !g.atNoStart)).toBe(true);

      const market = view(sources, 'market');
      expect(owners(market)).toEqual([null, 'market', 'm', 'p']);
      expect(chances(market)).toEqual([[null, [25]], [null, [25]], ['m', [25]], ['p', [25, 25, 75]]]);
    });

    it('treat every location as a start when none is flagged, as the start of play does', () => {
      const v = view({ entities: [ent('m', ['market'], [action('m1')])], locations: [loc('dock'), loc('market')] });
      expect(v.starts.map((s) => s.id)).toEqual(['dock', 'market']);
      expect(v.allLocations).toBe(true);
      expect(v.groups[1].atNoStart).toBe(false);
    });
  });

  it('describes a lone start whatever the filter says, filtering nothing and marking what it never reaches', () => {
    const sources = {
      overview: overview({ openings: [action('w1')] }),
      entities: [ent('d', ['dock'], [action('d1')]), ent('far', ['cave'], [action('f1')])],
      locations: [loc('dock', true), { ...loc('cave'), openings: [action('cave1')] }],
    };
    for (const v of [view(sources), view(sources, 'cave')]) {
      expect(v.allLocations).toBe(false);
      expect(v.startId).toBe('dock');
      expect(chances(v)).toEqual([[null, [50]], [null, [null]], ['d', [50]], ['far', [null]]]);
      expect(v.groups.map((g) => g.atNoStart)).toEqual([false, true, false, true]);
    }
  });

  it('filters nothing in a world with no locations, marking the entities no start reaches', () => {
    const v = view({
      overview: overview({ openings: [action('w1')] }),
      entities: [ent('g', ['x'], [action('g1')]), ent('nowhere', undefined, [action('n1')])],
    });
    expect(v.starts).toEqual([]);
    expect(v.allLocations).toBe(false);
    expect(v.startId).toBeNull();
    expect(chances(v)).toEqual([[null, [100]], ['g', [null]], ['nowhere', [null]]]);
    expect(v.groups.map((g) => g.atNoStart)).toEqual([false, true, true]);
  });

  describe('the default opening', () => {
    const locations = [loc('dock', true), loc('market', true), loc('cave', true)];
    const entities = [ent('d', ['dock'], [action('d1')]), ent('m', ['market'], [action('m1', '')])];
    const defaults = (v: ReturnType<typeof view>) => [v.defaultOpening, v.defaultStarts.map((l) => l.id)];

    it('names, under All Locations, every start whose pool is empty', () => {
      expect(defaults(view({ entities, locations }))).toEqual([true, ['market', 'cave']]);
    });

    it('shows at a picked start only when its pool is empty', () => {
      expect(defaults(view({ entities, locations }, 'dock'))).toEqual([false, []]);
      expect(defaults(view({ entities, locations }, 'market'))).toEqual([true, ['market']]);
    });

    it('shows nowhere when every start draws something, benched rows aside', () => {
      const v = view({ overview: overview({ openings: [action('w1'), action('w2')], openingWeights: { w2: 0 } }), entities, locations });
      expect(defaults(v)).toEqual([false, []]);
      const benched = view({ overview: overview({ openings: [action('w1')], openingWeights: { w1: 0 } }), locations });
      expect(defaults(benched)).toEqual([true, ['dock', 'market', 'cave']]);
    });

    it('ignores the switch and every Self row, which no start pool holds', () => {
      const persona = ent('p', ['cave'], [{ ...action('ps1'), self: true }], { persona: true });
      const v = view({ overview: overview({ openingsEnabled: false }), entities: [...entities, persona], locations });
      expect(defaults(v)).toEqual([true, ['market', 'cave']]);
    });

    it('shows, unnamed, in a world with no locations whose own rows are empty', () => {
      expect(defaults(view({ entities }))).toEqual([true, []]);
      expect(defaults(view({ overview: overview({ openings: [action('w1')] }) }))).toEqual([false, []]);
    });
  });
});
