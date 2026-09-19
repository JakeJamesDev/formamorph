import { describe, expect, it } from 'vitest';
import { drawNewGameOpening } from './newGameOpening';
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
