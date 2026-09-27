import { describe, expect, it } from 'vitest';
import {
  castOwnedTraits, emptyEntryDraft, entryDefaults, entryGateInput, withLocationPick, withPersonaPick, withSettledTraits,
  type EntryDraft, type EntryTraitWorld,
} from './entryDraft';
import { settle } from './traitGates';
import type { PersonaPickContext } from './personaPick';
import type { Entity, GameLocation, PersonaRef, Trait } from '@/types';

const entity = (id: string, locations: string[], startingLocationId?: string): Entity => ({
  id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', persona: true, locations, startingLocationId,
});
const place = (id: string, isStarting = false): GameLocation => ({ id, name: id, isStarting });

const context: PersonaPickContext = {
  worldEntities: [entity('keeper', ['inn', 'dock']), entity('drifter', ['road']), entity('hermit', ['dock'], 'cellar')],
  locations: [place('inn'), place('dock', true), place('road'), place('cellar'), place('gate', true)],
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

  it('preselects the unflagged location a world persona names', () => {
    expect(withPersonaPick(emptyEntryDraft(), world('hermit'), context).locationId).toBe('cellar');
  });

  it('drops a hand-picked unflagged location on a switch away, and a later persona pick moves it again', () => {
    const hermit = withLocationPick(withPersonaPick(emptyEntryDraft(), world('hermit'), context), 'cellar');
    const drifter = withPersonaPick(hermit, world('drifter'), context);
    expect(drifter).toMatchObject({ locationId: null, locationChosen: false });
    expect(withPersonaPick(drifter, world('keeper'), context).locationId).toBe('dock');
  });

  it('drops a library persona from the added characters', () => {
    const draft = { ...emptyEntryDraft(), entityIds: new Set(['lib', 'other']) };
    expect([...withPersonaPick(draft, library('lib'), context).entityIds]).toEqual(['other']);
  });
});

describe('owned trait picks in the draft', () => {
  const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
  const ash: Entity = {
    id: 'ash', name: 'Ash', persona: true,
    traits: [
      trait('tamed', { isDefault: true }), trait('scarred'), trait('guard', { requires: [{ kind: 'playingAs', id: 'ash' }] }),
      trait('crest', { isDefault: true, requires: [{ kind: 'playingAs', id: 'ash' }] }),
    ],
  };
  const bob: Entity = { id: 'bob', name: 'Bob', persona: true };
  const wren: Entity = { id: 'wren', name: 'Wren', traits: [trait('brave', { isDefault: true })] };
  const castWorld = (library: Entity[] = []): EntryTraitWorld => ({
    traits: [trait('paladin', { isDefault: true })], traitGroups: [], entities: [ash, bob], library,
  });
  const repick = (draft: EntryDraft, ref: PersonaRef, w = castWorld()) =>
    withSettledTraits(draft, settle(entryGateInput(w, { ...draft, persona: ref })).active);

  it("preselects every owner's defaults, the world's and each entity's, settled under the persona", () => {
    const asAsh = entryDefaults(castWorld([wren]), world('ash'));
    expect(asAsh.traitIds).toEqual(['paladin']);
    expect(asAsh.ownedTraitIds).toEqual({ ash: ['tamed', 'crest'], wren: ['brave'] });
    expect(entryDefaults(castWorld([wren]), world('bob')).ownedTraitIds.ash).toEqual(['tamed']);
  });

  it("keeps an entity's picks when the player switches persona and back", () => {
    let draft: EntryDraft = { ...emptyEntryDraft(), persona: world('ash'), ownedTraitIds: { ash: ['tamed', 'scarred'] } };
    draft = repick(draft, world('bob'));
    draft = repick(draft, world('ash'));
    expect(draft.ownedTraitIds.ash).toEqual(['tamed', 'scarred']);
  });

  it('turns a "playing as" owned trait off when the persona changes', () => {
    const draft: EntryDraft = { ...emptyEntryDraft(), persona: world('ash'), ownedTraitIds: { ash: ['tamed', 'guard'] } };
    const result = settle(entryGateInput(castWorld(), { ...draft, persona: world('bob') }));
    expect(result.turnedOff).toEqual([{ ownerId: 'ash', traitId: 'guard' }]);
    expect(withSettledTraits(draft, result.active).ownedTraitIds.ash).toEqual(['tamed']);
  });

  it('keeps the picks of a library persona that left the cast, and starts the game without them', () => {
    const draft: EntryDraft = { ...emptyEntryDraft(), persona: library('wren'), ownedTraitIds: { wren: ['brave'], ash: ['tamed'] } };
    const none = repick(draft, { source: 'none' }, castWorld());
    expect(none.ownedTraitIds.wren).toEqual(['brave']);
    expect(castOwnedTraits(none, castWorld())).toEqual({ ash: ['tamed'] });
    expect(castOwnedTraits(none, castWorld([wren]))).toEqual({ ash: ['tamed'], wren: ['brave'] });
  });

  it('starts the game with no entry for an owner with nothing picked', () => {
    const draft: EntryDraft = { ...emptyEntryDraft(), ownedTraitIds: { ash: [] } };
    expect(castOwnedTraits(draft, castWorld())).toEqual({});
  });
});
