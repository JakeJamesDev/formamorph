import { describe, expect, it } from 'vitest';
import { drawNewGameOpening } from './newGameOpening';
import { drawUnseenOpening, openingPool } from './openings';
import { resolvePersona } from './persona';
import type { Entity, Opening, WorldOverview } from '@/types';

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
