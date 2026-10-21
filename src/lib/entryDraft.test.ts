import { describe, expect, it } from 'vitest';
import {
  castOwnedTraits, emptyEntryDraft, entryDefaults, entryGateInput, libraryCastIds, rekeyOwnedPicks, withLibraryDefaults,
  withLocationPick, withPersonaPick, withSettledTraits, type EntryDraft, type EntryTraitWorld,
} from './entryDraft';
import { gateOf, gateStates, settle, switchTrait } from './traitGates';
import { cascadeOffInput } from './traitRuntime';
import type { PersonaPickContext } from './personaPick';
import type { Entity, GameLocation, PersonaRef, Trait } from '@/types';

const entity = (id: string, locations: string[]): Entity => ({
  id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', persona: true, locations,
});
const place = (id: string, isStarting = false): GameLocation => ({ id, name: id, isStarting });

const context: PersonaPickContext = {
  worldEntities: [entity('keeper', ['inn', 'dock']), entity('drifter', ['road']), entity('hermit', ['cellar']), entity('homeless', [])],
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

  it('keeps the location for a world persona with no locations', () => {
    expect(withPersonaPick(emptyEntryDraft(), world('homeless'), context).locationId).toBeNull();
    const fromKeeper = withPersonaPick(emptyEntryDraft(), world('keeper'), context);
    expect(withPersonaPick(fromKeeper, world('homeless'), context).locationId).toBe('dock');
  });

  it('keeps the location for a library persona and for None', () => {
    const fromKeeper = withPersonaPick(emptyEntryDraft(), world('keeper'), context);
    expect(withPersonaPick(fromKeeper, library('lib'), context).locationId).toBe('dock');
    expect(withPersonaPick(fromKeeper, { source: 'none' }, context).locationId).toBe('dock');
  });

  it("preselects a world persona's first location when none of them is flagged", () => {
    expect(withPersonaPick(emptyEntryDraft(), world('hermit'), context).locationId).toBe('cellar');
    const fromKeeper = withPersonaPick(emptyEntryDraft(), world('keeper'), context);
    expect(withPersonaPick(fromKeeper, world('drifter'), context).locationId).toBe('road');
  });

  it('drops a hand-picked unflagged location on a switch away, and a later persona pick moves it again', () => {
    const hermit = withLocationPick(withPersonaPick(emptyEntryDraft(), world('hermit'), context), 'cellar');
    const homeless = withPersonaPick(hermit, world('homeless'), context);
    expect(homeless).toMatchObject({ locationId: null, locationChosen: false });
    expect(withPersonaPick(homeless, world('drifter'), context)).toMatchObject({ locationId: 'road', locationChosen: false });
    expect(withPersonaPick(hermit, world('keeper'), context).locationId).toBe('dock');
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
      trait('tamed', { isDefault: true }), trait('scarred'), trait('guard', { requires: [{ all: [{ kind: 'playingAs', id: 'ash' }] }] }),
      trait('crest', { isDefault: true, requires: [{ all: [{ kind: 'playingAs', id: 'ash' }] }] }),
    ],
  };
  const bob: Entity = { id: 'bob', name: 'Bob', persona: true };
  const wren: Entity = { id: 'wren', name: 'Wren', traits: [trait('brave', { isDefault: true })] };
  const castWorld = (library: Entity[] = []): EntryTraitWorld => ({
    traits: [trait('paladin', { isDefault: true })], traitGroups: [], entities: [ash, bob], library,
  });
  const repick = (draft: EntryDraft, ref: PersonaRef, w = castWorld()) =>
    withSettledTraits({ ...draft, persona: ref }, settle(entryGateInput(w, { ...draft, persona: ref }), cascadeOffInput(draft.cascadeOffTraitIds)));
  const toggle = (draft: EntryDraft, ownerId: string, traitId: string) =>
    withSettledTraits(draft, switchTrait(entryGateInput(castWorld(), draft), ownerId, traitId, cascadeOffInput(draft.cascadeOffTraitIds))!);

  // Q7: the setup screen reads a Condition on the persona by the played persona's name, for the You pill.
  it("reads a Condition on the persona by the played persona's name, or Persona with no one played", () => {
    const knight: Entity = { id: 'knight', name: 'Knight', traits: [trait('squire', { requires: [{ all: [{ kind: 'trait', id: 'tamed', owner: { kind: 'you' } }] }] })] };
    const condition = (persona: PersonaRef) =>
      gateOf(gateStates(entryGateInput(castWorld([knight]), { ...emptyEntryDraft(), persona })), 'knight', 'squire')!.rows[0].conditions[0];
    expect(condition(world('ash'))).toMatchObject({ text: 'Ash: tamed', persona: 'Ash' });
    expect(condition({ source: 'none' })).toMatchObject({ text: 'Persona: tamed', persona: undefined });
  });

  it("preselects every owner's defaults, the world's and each entity's, settled under the persona", () => {
    const asAsh = entryDefaults(castWorld([wren]), world('ash'));
    expect(asAsh.traitIds).toEqual(['paladin']);
    expect(asAsh.ownedTraitIds).toEqual({ ash: ['tamed', 'crest'], wren: ['brave'] });
    expect(entryDefaults(castWorld([wren]), world('bob')).ownedTraitIds.ash).toEqual(['tamed']);
  });

  it("keeps an entity's picks when the player switches persona and back, a gated pick included", () => {
    let draft: EntryDraft = { ...emptyEntryDraft(), persona: world('ash'), ownedTraitIds: { ash: ['tamed', 'scarred', 'guard'] } };
    draft = repick(draft, world('bob'));
    expect(draft.ownedTraitIds.ash).toEqual(['tamed', 'scarred']);
    draft = repick(draft, world('ash'));
    expect(draft.ownedTraitIds.ash).toEqual(['tamed', 'scarred', 'guard']);
    expect(draft.cascadeOffTraitIds.owners?.ash).toEqual([]);
  });

  it('turns a "playing as" owned trait off when the persona changes, and keeps it to return', () => {
    const draft: EntryDraft = { ...emptyEntryDraft(), persona: world('ash'), ownedTraitIds: { ash: ['tamed', 'guard'] } };
    const result = settle(entryGateInput(castWorld(), { ...draft, persona: world('bob') }));
    expect(result.turnedOff).toEqual([{ ownerId: 'ash', traitId: 'guard' }]);
    const next = withSettledTraits(draft, result);
    expect(next.ownedTraitIds.ash).toEqual(['tamed']);
    expect(next.cascadeOffTraitIds.owners?.ash).toEqual(['guard']);
  });

  it('never brings back a trait the player switched off by hand', () => {
    let draft: EntryDraft = { ...emptyEntryDraft(), persona: world('ash'), ownedTraitIds: { ash: ['tamed', 'guard'] } };
    draft = toggle(draft, 'ash', 'guard');
    draft = repick(repick(draft, world('bob')), world('ash'));
    expect(draft.ownedTraitIds.ash).toEqual(['tamed']);
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

describe('library entities in the cast', () => {
  const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
  const wren: Entity = { id: 'wren', name: 'Wren', traits: [trait('brave', { isDefault: true }), trait('shy')] };
  const moss: Entity = { id: 'moss', name: 'Moss', traits: [trait('calm', { isDefault: true })] };
  const castWorld = (library: Entity[]): EntryTraitWorld => ({ traits: [], traitGroups: [], entities: [], library });

  it('lists the library persona first, then the added characters in the order picked', () => {
    const draft = { ...emptyEntryDraft(), persona: library('wren'), entityIds: new Set(['moss', 'wren', 'fern']) };
    expect(libraryCastIds(draft)).toEqual(['wren', 'moss', 'fern']);
    expect(libraryCastIds({ ...draft, persona: world('ash') })).toEqual(['moss', 'wren', 'fern']);
  });

  it('preselects the defaults of a library entity once it joins the cast', () => {
    const draft = withLibraryDefaults({ ...emptyEntryDraft(), ownedTraitIds: { wren: ['shy'] } }, castWorld([wren, moss]));
    expect(draft.ownedTraitIds).toEqual({ wren: ['shy'], moss: ['calm'] });
  });

  it("leaves a library default off when the player's trait it requires is not picked", () => {
    const knight: Entity = {
      id: 'knight', name: 'Knight',
      traits: [trait('crest', { isDefault: true, requires: [{ all: [{ kind: 'trait', id: 'paladin', owner: { kind: 'you' } }] }] })],
    };
    const w: EntryTraitWorld = { traits: [trait('paladin', { isDefault: true })], traitGroups: [], entities: [], library: [knight] };
    expect(withLibraryDefaults({ ...emptyEntryDraft(), traitIds: ['paladin'] }, w).ownedTraitIds.knight).toEqual(['crest']);
    const unpicked = withLibraryDefaults(emptyEntryDraft(), w);
    expect(unpicked.ownedTraitIds.knight).toEqual([]);
    expect(unpicked.cascadeOffTraitIds.owners?.knight).toEqual(['crest']);
  });

  it('changes nothing when every library entity already has picks', () => {
    const draft = { ...emptyEntryDraft(), ownedTraitIds: { wren: [] } };
    expect(withLibraryDefaults(draft, castWorld([wren]))).toBe(draft);
  });

  it("re-keys an added character's picks to its copy's id", () => {
    expect(rekeyOwnedPicks({ wren: ['brave'], ash: ['tamed'] }, new Map([['wren', 'copy-1']])))
      .toEqual({ 'copy-1': ['brave'], ash: ['tamed'] });
  });
});

describe('Blueprints at Enter World', () => {
  it('never starts a trait under Blueprints, while a default root trait starts on', () => {
    const traits: Trait[] = [
      { id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'classes', isDefault: true },
      { id: 'brave', name: 'Brave', statChanges: [], groupId: null, isDefault: true },
    ];
    const lists: EntryTraitWorld = {
      traits,
      traitGroups: [
        { id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
        { id: 'classes', name: 'Classes', parentId: 'blueprints' },
      ],
      entities: [], library: [],
    };
    expect(entryDefaults(lists, { source: 'none' }).traitIds).toEqual(['brave']);
  });
});
