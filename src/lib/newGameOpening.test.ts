import { describe, expect, it } from 'vitest';
import { drawNewGameOpening } from './newGameOpening';
import { drawUnseenOpening, openingPool } from './openings';
import { resolvePersona } from './persona';
import { migrateWorld } from './version';
import type { Entity, Opening, PersonaRef, WorldOverview } from '@/types';

const action = (id: string): Opening => ({ id, text: `Opening ${id}.`, kind: 'action' });

const overview: WorldOverview = {
  name: 'W', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', use3DModel: false, tags: [],
};

const entity = (id: string, over: Partial<Entity> = {}): Entity => ({
  id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', ...over,
});

// Both stand at the start; a random of 0 draws the first row of the pool.
const guide = entity('guide', { locations: ['start'], openings: [action('guide-hello')] });
const keeper = entity('keeper', { locations: ['start'], openings: [action('keeper-hello')] });
const always = () => 0;

describe('drawNewGameOpening', () => {
  it('resolves the persona before the draw, so the draw reads the cast without the played entity', () => {
    const result = drawNewGameOpening({
      pick: { ref: { source: 'world', entityId: 'guide' } },
      worldEntities: [guide, keeper],
      overview,
      startingLocationId: 'start',
      picked: [],
      random: always,
    });
    expect(result.persona?.entity.id).toBe('guide');
    expect(result.draw.opening.id).toBe('keeper-hello');
    expect(result.owner).toBe(keeper);
  });

  it('names a picked library entity as the owner of its row', () => {
    const visitor = entity('visitor', { openings: [action('visitor-hello')] });
    const result = drawNewGameOpening({
      pick: { ref: { source: 'none' } },
      worldEntities: [guide],
      overview,
      startingLocationId: 'start',
      picked: [visitor],
      random: always,
    });
    expect(result.draw.opening.id).toBe('visitor-hello');
    expect(result.owner).toBe(visitor);
  });

  it('hands the library persona read at entry to the page-one render', () => {
    const self = entity('self', { persona: true });
    const result = drawNewGameOpening({
      pick: { ref: { source: 'library', entityId: 'self' }, libraryEntity: self },
      worldEntities: [guide],
      overview,
      startingLocationId: 'start',
      picked: [],
      random: always,
    });
    expect(result.persona).toEqual({ entity: self, source: 'library' });
    expect(result.draw.opening.id).toBe('guide-hello');
  });

  it('draws with no persona for None', () => {
    const result = drawNewGameOpening({
      pick: { ref: { source: 'none' } },
      worldEntities: [guide],
      overview,
      startingLocationId: 'start',
      picked: [],
      random: always,
    });
    expect(result.persona).toBeNull();
    expect(result.draw.opening.id).toBe('guide-hello');
  });
});

// A seeded source, so every run draws the same sequence.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('the pool after the first draw, with a world persona', () => {
  const worldEntities = [guide, keeper];
  const played = resolvePersona({ source: 'world', entityId: 'guide' }, worldEntities, []);
  const pool = (entities: Entity[]) => openingPool({ overview, entities, startingLocationId: 'start', picked: [] });
  const drawIds = (entities: Entity[], shown: string[]) => {
    const random = seeded(7);
    let seen = shown;
    return Array.from({ length: 20 }, () => {
      const next = drawUnseenOpening(pool(entities), seen, random);
      seen = next.shown;
      return next.opening.id;
    });
  };

  it('keeps the played entity out at page-one regenerate', () => {
    const first = drawNewGameOpening({
      pick: { ref: { source: 'world', entityId: 'guide' } }, worldEntities, overview, startingLocationId: 'start',
      picked: [], random: seeded(3),
    });
    const redraws = drawIds(played.cast, first.draw.shown);
    expect(new Set(redraws)).toEqual(new Set(['keeper-hello']));
  });

  it('keeps the played entity out of the pool a loaded save rebuilds', () => {
    expect(pool(played.cast).map((row) => row.opening.id)).toEqual(['keeper-hello']);
    expect(new Set(drawIds(played.cast, []))).toEqual(new Set(['keeper-hello']));
  });

  it('draws both openings with no persona, so the guard above can fail', () => {
    const { cast } = resolvePersona({ source: 'none' }, worldEntities, []);
    expect(new Set(drawIds(cast, []))).toEqual(new Set(['guide-hello', 'keeper-hello']));
  });
});

describe('the pool with a persona-only entity', () => {
  const custom = entity('custom', { persona: true, personaOnly: true, locations: ['start'], openings: [action('custom-hello')] });
  const worldEntities = [guide, keeper, custom];
  const drawAll = (ref: PersonaRef) => {
    const { cast } = resolvePersona(ref, worldEntities, []);
    const random = seeded(11);
    let seen: string[] = [];
    const ids = Array.from({ length: 20 }, () => {
      const next = drawUnseenOpening(openingPool({ overview, entities: cast, startingLocationId: 'start', picked: [] }), seen, random);
      seen = next.shown;
      return next.opening.id;
    });
    return { cast, ids: new Set(ids) };
  };

  it('keeps a picked persona-only entity out: it is the played entity', () => {
    const result = drawNewGameOpening({
      pick: { ref: { source: 'world', entityId: 'custom' } }, worldEntities, overview, startingLocationId: 'start',
      picked: [], random: always,
    });
    expect(result.persona?.entity.id).toBe('custom');
    expect(drawAll({ source: 'world', entityId: 'custom' }).ids).toEqual(new Set(['guide-hello', 'keeper-hello']));
  });

  it.each<{ label: string; ref: PersonaRef }>([
    { label: 'None', ref: { source: 'none' } },
    { label: 'another world persona', ref: { source: 'world', entityId: 'guide' } },
  ])('leaves an unpicked persona-only entity out of the pool cast under $label', ({ ref }) => {
    const { cast, ids } = drawAll(ref);
    expect(cast.map((e) => e.id)).not.toContain('custom');
    expect(ids).not.toContain('custom-hello');
  });
});

// ── Self openings ─────────────────────────────────────────────────────────────

const selfRow = (id: string): Opening => ({ ...action(id), self: true });

/** Every opening the first draw can land on: one draw at each of 40 evenly spaced points in [0, 1). */
const firstDraws = (pick: PersonaRef, worldEntities: Entity[], over: Partial<WorldOverview> = {}) => new Set(
  Array.from({ length: 40 }, (_, i) => drawNewGameOpening({
    pick: { ref: pick }, worldEntities, overview: { ...overview, ...over }, startingLocationId: 'start', picked: [],
    random: () => (i + 0.5) / 40,
  }).draw.opening.id),
);

describe('Self openings of a world persona', () => {
  const hero = entity('hero', {
    persona: true, locations: ['start'],
    openings: [action('hero-hello'), selfRow('hero-self-a'), selfRow('hero-self-b')],
  });
  const plain = entity('plain', { persona: true, locations: ['start'], openings: [action('plain-hello')] });
  const worldEntities = [hero, plain, keeper];
  const worldRows = { openings: [action('world-hello')] };

  it('replace the pool when the player plays their owner', () => {
    expect(firstDraws({ source: 'world', entityId: 'hero' }, worldEntities, worldRows))
      .toEqual(new Set(['hero-self-a', 'hero-self-b']));
  });

  it('name their owner as the drawn row’s owner', () => {
    const result = drawNewGameOpening({
      pick: { ref: { source: 'world', entityId: 'hero' } }, worldEntities, overview, startingLocationId: 'start',
      picked: [], random: always,
    });
    expect(result.owner).toBe(hero);
  });

  it('leave a persona without them on the location pool, its own Others rows still out', () => {
    expect(firstDraws({ source: 'world', entityId: 'plain' }, worldEntities, worldRows))
      .toEqual(new Set(['world-hello', 'hero-hello', 'keeper-hello']));
  });

  it.each<{ label: string; ref: PersonaRef }>([
    { label: 'None', ref: { source: 'none' } },
    { label: 'another world persona', ref: { source: 'world', entityId: 'plain' } },
  ])('never join the location pool when their owner stands at the start under $label', ({ ref }) => {
    expect(firstDraws(ref, worldEntities)).not.toContain('hero-self-a');
    expect(firstDraws(ref, worldEntities)).not.toContain('hero-self-b');
  });

  it('never draw with the world switch off', () => {
    const result = drawNewGameOpening({
      pick: { ref: { source: 'world', entityId: 'hero' } }, worldEntities, overview: { ...overview, openingsEnabled: false },
      startingLocationId: 'start', picked: [], random: always,
    });
    expect(result.draw.opening.id).toBe('default');
  });

  it('switch the list on by themselves when the persona is the only owner with openings', () => {
    const alone = entity('alone', { persona: true, openings: [selfRow('alone-self')] });
    expect(firstDraws({ source: 'world', entityId: 'alone' }, [alone])).toEqual(new Set(['alone-self']));
  });

  it('keep a picked library entity’s Self rows out of the Library Additions pool', () => {
    const visitor = entity('visitor', { openings: [action('visitor-hello'), selfRow('visitor-self')] });
    const result = drawNewGameOpening({
      pick: { ref: { source: 'none' } }, worldEntities: [keeper], overview, startingLocationId: 'start',
      picked: [visitor], random: seeded(5),
    });
    expect(result.draw.opening.id).toBe('visitor-hello');
    expect(openingPool({ overview, entities: [keeper], startingLocationId: 'start', picked: [visitor] })
      .map((row) => row.opening.id)).toEqual(['visitor-hello']);
  });

  it('are what the page-one redraw draws again from', () => {
    const played = resolvePersona({ source: 'world', entityId: 'hero' }, worldEntities, []);
    const first = drawNewGameOpening({
      pick: { ref: { source: 'world', entityId: 'hero' } }, worldEntities, overview, startingLocationId: 'start',
      picked: [], random: seeded(3),
    });
    const random = seeded(9);
    let seen = first.draw.shown;
    const redraws = Array.from({ length: 20 }, () => {
      const pool = openingPool({ overview, entities: played.cast, startingLocationId: 'start', picked: [], persona: played.persona });
      const next = drawUnseenOpening(pool, seen, random);
      seen = next.shown;
      return next.opening.id;
    });
    expect(new Set(redraws)).toEqual(new Set(['hero-self-a', 'hero-self-b']));
  });
});

describe('a world whose openings carry no Self flag, as every shipped world', () => {
  const world = migrateWorld(JSON.parse(JSON.stringify({
    id: 'w', version: '3.0.1', worldOverview: { ...overview, openings: [action('world-hello')], openingWeights: { 'world-hello': 3 } },
    stats: [], traits: [], statUpdates: [], locations: [{ id: 'start', name: 'Start', description: '', isStartingLocation: true }],
    entities: [
      { ...guide, persona: true },
      { ...keeper, openingWeights: { 'keeper-hello': 2 } },
    ],
  })));

  it('loads with the flag still absent', () => {
    const rows = [world.worldOverview, ...world.entities].flatMap((owner) => owner.openings ?? []);
    expect(rows.every((o) => !('self' in o))).toBe(true);
  });

  it.each<{ label: string; ref: PersonaRef; ids: string[]; weights: number[] }>([
    { label: 'None', ref: { source: 'none' }, ids: ['world-hello', 'guide-hello', 'keeper-hello'], weights: [3, 1, 2] },
    { label: 'the world persona', ref: { source: 'world', entityId: 'guide' }, ids: ['world-hello', 'keeper-hello'], weights: [3, 2] },
  ])('draws from the location pool under $label', ({ ref, ids, weights }) => {
    const { cast, persona } = resolvePersona(ref, world.entities, []);
    const pool = openingPool({ overview: world.worldOverview, entities: cast, startingLocationId: 'start', persona });
    expect(pool.map((row) => [row.opening.id, row.weight])).toEqual(ids.map((id, i) => [id, weights[i]]));
    expect(firstDraws(ref, world.entities, world.worldOverview)).toEqual(new Set(ids));
  });
});

describe('Self openings of a persona-only entity', () => {
  const ghost = entity('ghost', {
    persona: true, personaOnly: true, locations: ['start'], openings: [action('ghost-hello'), selfRow('ghost-self')],
  });
  const worldEntities = [ghost, keeper];

  it('draw when the player picks it, and its Others rows don’t', () => {
    expect(firstDraws({ source: 'world', entityId: 'ghost' }, worldEntities)).toEqual(new Set(['ghost-self']));
  });

  it('never draw while it is unpicked', () => {
    expect(firstDraws({ source: 'none' }, worldEntities)).toEqual(new Set(['keeper-hello']));
  });
});

describe('Self openings of an entity without the Persona mark', () => {
  // An id still resolves after the mark comes off, so a save can play an unmarked entity.
  const former = entity('former', { locations: ['start'], openings: [action('former-hello'), selfRow('former-self')] });
  const worldEntities = [former, keeper];

  it('never draw when that entity is played', () => {
    expect(firstDraws({ source: 'world', entityId: 'former' }, worldEntities)).toEqual(new Set(['keeper-hello']));
  });

  it('never draw when it stands at the start', () => {
    expect(firstDraws({ source: 'none' }, worldEntities)).toEqual(new Set(['former-hello', 'keeper-hello']));
  });
});
