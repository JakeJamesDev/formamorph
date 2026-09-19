import { describe, expect, it } from 'vitest';
import { emptyEntryDraft, withLocationPick, withPersonaPick } from './entryDraft';
import type { PersonaPickContext } from './personaPick';
import type { Entity, PersonaRef } from '@/types';

const entity = (id: string, locations: string[]): Entity => ({
  id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', persona: true, locations,
});

const context: PersonaPickContext = {
  worldEntities: [entity('keeper', ['inn', 'dock']), entity('drifter', ['road'])],
  startingLocationIds: ['dock', 'gate'],
};
const world = (entityId: string): PersonaRef => ({ source: 'world', entityId });
const library = (entityId: string): PersonaRef => ({ source: 'library', entityId });

describe('withPersonaPick', () => {
  it("preselects a world persona's starting location, and the player can still change it", () => {
    const picked = withPersonaPick(emptyEntryDraft(), world('keeper'), context);
    expect(picked).toMatchObject({ persona: world('keeper'), locationId: 'dock' });
    expect(withLocationPick(picked, 'gate').locationId).toBe('gate');
  });

  it('keeps a location the player chose by hand in this step', () => {
    const chosen = withLocationPick(emptyEntryDraft(), 'gate');
    expect(withPersonaPick(chosen, world('keeper'), context).locationId).toBe('gate');
    // Random is a hand choice too.
    expect(withPersonaPick(withLocationPick(emptyEntryDraft(), null), world('keeper'), context).locationId).toBeNull();
  });

  it('keeps the location for a world persona with no starting location among its locations', () => {
    expect(withPersonaPick(emptyEntryDraft(), world('drifter'), context).locationId).toBeNull();
    const fromKeeper = withPersonaPick(emptyEntryDraft(), world('keeper'), context);
    expect(withPersonaPick(fromKeeper, world('drifter'), context).locationId).toBe('dock');
  });

  it('keeps the location for a library persona and for None', () => {
    const fromKeeper = withPersonaPick(emptyEntryDraft(), world('keeper'), context);
    expect(withPersonaPick(fromKeeper, library('lib'), context).locationId).toBe('dock');
    expect(withPersonaPick(fromKeeper, { source: 'none' }, context).locationId).toBe('dock');
  });

  it('drops a library persona from the added characters', () => {
    const draft = { ...emptyEntryDraft(), entityIds: new Set(['lib', 'other']) };
    expect([...withPersonaPick(draft, library('lib'), context).entityIds]).toEqual(['other']);
  });
});
