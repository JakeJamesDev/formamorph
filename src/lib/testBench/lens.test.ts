import { describe, it, expect } from 'vitest';
import { encodePlaceholderToken, resolvePlaceholders } from '@/lib/placeholders';
import type { Entity, GameLocation, Placeholder, Trait, TraitGroup } from '@/types';
import { phValueId, phValues } from '@/test/placeholderValues';
import {
  buildLens, describeBrokenPin, lensActiveTraits, lensLocationOptions, lensPcOptions, lensStatOverrides, resolveLensText,
  seedLens, type LensWorld,
} from './lens';

const hairColor: Placeholder = { id: 'ph-hair', name: 'Hair Color', values: phValues(['ash', 'copper', 'jet']) };
const homeland: Placeholder = { id: 'ph-home', name: 'Homeland', values: phValues(['the Reach']) };

const groups: TraitGroup[] = [
  { id: 'g-origin', name: 'Origin', parentId: null, maxPicks: 1 },
  { id: 'g-gifts', name: 'Gifts', parentId: null },
];

const traits: Trait[] = [
  {
    id: 't-sedge', name: 'Sedge-Born', groupId: 'g-origin', statChanges: [], order: 0,
    placeholderPins: [{ placeholderId: 'ph-hair', value: 'copper' }],
    statToggles: [{ statId: 's-tide', enabled: true }],
  },
  { id: 't-reach', name: 'Reach-Born', groupId: 'g-origin', statChanges: [], order: 1 },
  { id: 't-keen', name: 'Keen Ear', groupId: 'g-gifts', statChanges: [] },
  { id: 't-loose', name: 'Loose Thread', statChanges: [] },
];

const locations: GameLocation[] = [
  { id: 'loc-market', name: 'The Long Market' },
  { id: 'loc-harbor', name: 'Harbor Steps', isStarting: true },
];

const world = (over: Partial<LensWorld> = {}): LensWorld => ({
  traits,
  traitGroups: groups,
  locations,
  placeholders: [hairColor, homeland],
  stats: [
    { id: 's-tide', name: 'Tide Sense', type: 'number', value: 0, enabled: false },
    { id: 's-nerve', name: 'Nerve', type: 'number', value: 5 },
  ] as LensWorld['stats'],
  ...over,
});

describe('lens options', () => {
  it('offers only the traits of an exclusive group as PCs', () => {
    expect(lensPcOptions(world()).map((o) => o.id)).toEqual(['t-sedge', 't-reach']);
  });

  it('files each PC under the group it belongs to', () => {
    expect(lensPcOptions(world())[0].groupName).toBe('Origin');
  });

  it('has no PCs at all in a world with no exclusive group', () => {
    const flat = world({ traitGroups: groups.map(({ maxPicks: _max, ...g }) => g) });
    expect(lensPcOptions(flat)).toEqual([]);
  });

  it('lists every location', () => {
    expect(lensLocationOptions(world()).map((o) => o.name)).toEqual(['The Long Market', 'Harbor Steps']);
  });
});

describe('seedLens', () => {
  it('opens on the location the editor has selected', () => {
    expect(seedLens(world(), null, 'loc-market').locationId).toBe('loc-market');
  });

  it('opens on the starting location when the editor has nothing selected', () => {
    expect(seedLens(world(), null, null).locationId).toBe('loc-harbor');
  });

  it('falls back to the first location when no location is flagged as starting', () => {
    const noStart = world({ locations: locations.map((l) => ({ ...l, isStarting: false })) });
    expect(seedLens(noStart, null, null).locationId).toBe('loc-market');
  });

  it('keeps a stored selection over both the editor and the starting location', () => {
    const stored = { pcTraitId: 't-reach', locationId: 'loc-market' };
    expect(seedLens(world(), stored, 'loc-harbor')).toEqual(stored);
  });

  it('re-seeds only the half the world no longer has', () => {
    const stored = { pcTraitId: 't-reach', locationId: 'loc-gone' };
    expect(seedLens(world(), stored, null)).toEqual({ pcTraitId: 't-reach', locationId: 'loc-harbor' });
  });

  it('drops a stored PC that is no longer an exclusive-group trait', () => {
    expect(seedLens(world(), { pcTraitId: 't-keen', locationId: null }, null).pcTraitId).toBeNull();
  });

  it('has nowhere to stand in a world with no locations', () => {
    expect(seedLens(world({ locations: [] }), null, 'loc-market').locationId).toBeNull();
  });
});

describe('buildLens', () => {
  it('carries the selected PC and location', () => {
    const lens = buildLens(world(), { pcTraitId: 't-sedge', locationId: 'loc-market' });
    expect(lens.pc?.name).toBe('Sedge-Born');
    expect(lens.location?.name).toBe('The Long Market');
  });

  it('resolves a PC the world has since lost to none rather than a stale trait', () => {
    expect(buildLens(world(), { pcTraitId: 't-gone', locationId: null }).pc).toBeNull();
  });

  it('pins what the PC pins, and nothing when there is no PC', () => {
    expect(buildLens(world(), { pcTraitId: 't-sedge', locationId: null }).pins).toEqual({ 'ph-hair': 'copper' });
    expect(buildLens(world(), { pcTraitId: 't-reach', locationId: null }).pins).toEqual({});
    expect(buildLens(world(), { pcTraitId: null, locationId: null }).pins).toEqual({});
  });

  it('applies the PC’s stat toggles over the world’s defaults', () => {
    const off = buildLens(world(), { pcTraitId: 't-reach', locationId: null });
    expect(off.statEnabled).toEqual({ 's-tide': false, 's-nerve': true });
    const on = buildLens(world(), { pcTraitId: 't-sedge', locationId: null });
    expect(on.statEnabled['s-tide']).toBe(true);
    expect(lensStatOverrides(world(), on)).toEqual([{ stat: 'Tide Sense', enabled: true }]);
    expect(lensStatOverrides(world(), off)).toEqual([]);
  });
});

describe('pins from every source', () => {
  // The market pins hair to jet; Nerve at its start of 5 sits in the ≤ 10 band, which pins hair to ash.
  const layered = (over: Partial<LensWorld> = {}): LensWorld => world({
    locations: [{ ...locations[0], placeholderPins: [{ placeholderId: 'ph-hair', value: 'jet' }] }, locations[1]],
    stats: [
      { id: 's-tide', name: 'Tide Sense', type: 'number', value: 0, enabled: false },
      {
        id: 's-nerve', name: 'Nerve', type: 'number', value: 5, min: 0, max: 100,
        descriptors: [{ id: 'd-low', threshold: 10, description: 'Rattled', placeholderPins: [{ placeholderId: 'ph-hair', value: 'ash' }] }],
      },
    ] as LensWorld['stats'],
    ...over,
  });

  it('layers the PC, the location and the starting band, and marks the band’s pin as the one in force', () => {
    const lens = buildLens(layered(), { pcTraitId: 't-sedge', locationId: 'loc-market' });
    expect(lens.pins).toEqual({ 'ph-hair': 'ash' });
    expect(lens.pinLayers.map((l) => [l.label, l.value, l.wins])).toEqual([
      ['Trait: Sedge-Born', 'copper', false],
      ['Location: The Long Market', 'jet', false],
      ['Nerve ≤ 10', 'ash', true],
    ]);
  });

  it('lets the location win once the lens stands where the band no longer applies', () => {
    const calm = layered({
      stats: [{ id: 's-nerve', name: 'Nerve', type: 'number', value: 50, min: 0, max: 100, descriptors: [
        { id: 'd-low', threshold: 10, description: 'Rattled', placeholderPins: [{ placeholderId: 'ph-hair', value: 'ash' }] },
      ] }] as LensWorld['stats'],
    });
    const lens = buildLens(calm, { pcTraitId: 't-sedge', locationId: 'loc-market' });
    expect(lens.pins).toEqual({ 'ph-hair': 'jet' });
    expect(lens.pinLayers.find((l) => l.wins)?.label).toBe('Location: The Long Market');
  });

  it('reads the band the PC’s own stat changes land the start in, as a fresh game would', () => {
    const shaken = layered({
      traits: [{ ...traits[0], statChanges: [{ statId: 's-nerve', value: 40, type: 'starting' }] }, ...traits.slice(1)],
      stats: [{ id: 's-nerve', name: 'Nerve', type: 'number', value: 5, min: 0, max: 100, descriptors: [
        { id: 'd-low', threshold: 10, description: 'Rattled', placeholderPins: [{ placeholderId: 'ph-hair', value: 'ash' }] },
      ] }] as LensWorld['stats'],
    });
    // 5 + 40 = 45 leaves the ≤ 10 band, so the band pins nothing and the PC's own pin stands.
    expect(buildLens(shaken, { pcTraitId: 't-sedge', locationId: null }).pins).toEqual({ 'ph-hair': 'copper' });
  });

  it('applies a default trait’s pin with no PC picked, since every playthrough carries it', () => {
    const w = world({ traits: [...traits, { id: 't-fen', name: 'Fen Blood', isDefault: true, statChanges: [],
      placeholderPins: [{ placeholderId: 'ph-home', value: 'the Fen' }] }] });
    expect(buildLens(w, { pcTraitId: null, locationId: null }).pins).toEqual({ 'ph-home': 'the Fen' });
  });
});

describe('pins from owned traits', () => {
  // Ash's default Tamed pins hair to jet; Wild, its exclusive sibling, is not a default.
  const ash = (over: Partial<Trait> = {}): LensWorld['entities'] => [{
    id: 'ash', name: 'Ash',
    traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, maxPicks: 1 }],
    traits: [
      { id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [], isDefault: true,
        placeholderPins: [{ placeholderId: 'ph-hair', value: 'jet' }], ...over },
      { id: 't-wild', name: 'Wild', groupId: 'g-bond', statChanges: [], placeholderPins: [{ placeholderId: 'ph-hair', value: 'ash' }] },
    ],
  }];

  it('keeps a cast entity’s owned default out of the world-level pins', () => {
    const lens = buildLens(world({ entities: ash() }), { pcTraitId: null, locationId: null });
    expect(lens.pins).toEqual({});
    expect(buildLens(world({ entities: ash() }), { pcTraitId: 't-sedge', locationId: null }).pinLayers.map((l) => [l.label, l.wins]))
      .toEqual([['Trait: Sedge-Born', true]]);
  });

  describe('a blueprint pin', () => {
    // Sedge-Born pins Hair Color, the blueprint, to its "copper" value by id.
    const byId = { placeholderId: 'ph-hair', valueId: phValueId('copper'), value: 'copper' };
    const copy: Placeholder = {
      id: 'cp-hair', name: 'Hair Color', values: [], blueprintId: 'ph-hair',
      valueOverrides: { [phValueId('copper')]: { text: { value: 'rust', blueprint: 'copper' } } },
    };
    const holder = (over: Partial<Entity>): Entity => ({ id: 'cp', name: 'Newcomer', placeholders: [copy], ...over });
    const w = (entities: Entity[]) => world({ traits: [{ ...traits[0], placeholderPins: [byId] }, ...traits.slice(1)], entities });
    const lens = (entities: Entity[]) => buildLens(w(entities), { pcTraitId: 't-sedge', locationId: null });

    it('traces to the Custom Persona entity’s copy under None, valued as the copy rewords it, labeled with the trait', () => {
      const traced = lens([holder({ customPersona: true })]);
      expect(traced.pins).toEqual({ 'cp-hair': 'rust' });
      expect(traced.pinLayers.map((l) => [l.label, l.wins])).toEqual([['Trait: Sedge-Born', true]]);
      expect(traced.brokenPins).toEqual([]);
    });

    it('reads the blueprint itself with no marked entity, whoever else holds a copy', () => {
      expect(lens([]).pins).toEqual({ 'ph-hair': 'copper' });
      expect(lens([holder({ persona: true })]).pins).toEqual({ 'ph-hair': 'copper' });
    });

    it('lays nothing for a value the Custom Persona entity’s copy removed', () => {
      const removed = { ...copy, valueOverrides: { [phValueId('copper')]: { removed: true as const } } };
      expect(lens([holder({ customPersona: true, placeholders: [removed] })]).pins).toEqual({});
    });
  });
});

describe('the player bearer', () => {
  // Blueprints: Classes (Paladin pins Hair Color by value id, Wizard) and a default Warded pinning Homeland.
  const blueprints: TraitGroup[] = [
    { id: 'g-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
    { id: 'g-classes', name: 'Classes', parentId: 'g-blueprints', maxPicks: 1 },
  ];
  const blueprinted: Trait[] = [
    {
      id: 't-paladin', name: 'Paladin', groupId: 'g-classes', statChanges: [], order: 0, isDefault: true,
      placeholderPins: [{ placeholderId: 'ph-hair', valueId: phValueId('ash'), value: 'ash' }],
    },
    { id: 't-wizard', name: 'Wizard', groupId: 'g-classes', statChanges: [], order: 1 },
    {
      id: 't-warded', name: 'Warded', groupId: 'g-blueprints', statChanges: [], isDefault: true,
      placeholderPins: [{ placeholderId: 'ph-home', value: 'the Reach' }],
    },
  ];
  const link = (id: string, originalId: string, kind: 'trait' | 'group', extra = {}) =>
    ({ id, originalId, kind, originalName: originalId, groupId: null, ...extra });
  const withBlueprints = (over: Partial<LensWorld> = {}) =>
    world({ traits: [...traits, ...blueprinted], traitGroups: [...groups, ...blueprints], ...over });
  const active = (w: LensWorld, pcTraitId: string | null = null) =>
    lensActiveTraits(w, buildLens(w, { pcTraitId, locationId: null })).map((t) => t.id);

  it('caps the defaults at each group’s max, first in authored order, as a new game does', () => {
    const twoGifts = groups.map((g) => (g.id === 'g-gifts' ? { ...g, maxPicks: 2 } : g));
    const gifts = ['t-keen', 't-sharp', 't-quick'].map((id, order): Trait => ({ id, name: id, groupId: 'g-gifts', statChanges: [], order, isDefault: true }));
    expect(active(world({ traits: gifts, traitGroups: twoGifts }))).toEqual(['t-keen', 't-sharp']);
  });

  it('leaves Blueprints out: no PC from its groups, no default, no pin', () => {
    const w = withBlueprints();
    expect(lensPcOptions(w).map((o) => o.id)).toEqual(['t-sedge', 't-reach']);
    expect(active(w)).toEqual([]);
    expect(buildLens(w, { pcTraitId: null, locationId: null }).pins).toEqual({});
  });

  it('adds the Custom Persona entity’s links as the None player: their PCs, defaults and pins', () => {
    const newcomer: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [
      link('cp-classes', 'g-classes', 'group', { overrides: { 't-paladin': { placeholderPins: {
        value: [{ placeholderId: 'ph-hair', value: 'jet' }], blueprint: [],
      } } } }),
      link('cp-warded', 't-warded', 'trait'),
    ] };
    const w = withBlueprints({ entities: [newcomer] });
    expect(lensPcOptions(w).map((o) => o.id)).toEqual(['t-sedge', 't-reach', 't-paladin', 't-wizard']);
    expect(active(w)).toEqual(['t-paladin', 't-warded']);
    expect(buildLens(w, { pcTraitId: null, locationId: null }).pins).toEqual({ 'ph-hair': 'jet', 'ph-home': 'the Reach' });
    // Picking Wizard retires Paladin, its exclusive sibling in the linked group.
    expect(active(w, 't-wizard')).toEqual(['t-wizard', 't-warded']);
  });

  it('reads a Custom Persona entity link’s own default-on over the original’s', () => {
    const newcomer: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [
      link('cp-warded', 't-warded', 'trait', { overrides: { 't-warded': { isDefault: { value: false, blueprint: true } } } }),
    ] };
    expect(active(withBlueprints({ entities: [newcomer] }))).toEqual([]);
  });
});

describe('broken pins', () => {
  const pinning = (value: string, placeholderId = 'ph-hair'): LensWorld => world({
    traits: [{ ...traits[0], placeholderPins: [{ placeholderId, value }] }, ...traits.slice(1)],
  });

  it('surfaces a broken pin on the lens location, naming the source', () => {
    const w = world({ locations: [{ ...locations[0], placeholderPins: [{ placeholderId: 'ph-gone', value: 'jet' }] }, locations[1]] });
    const [broken] = buildLens(w, { pcTraitId: null, locationId: 'loc-market' }).brokenPins;
    expect(broken).toMatchObject({ placeholderId: 'ph-gone', value: 'jet', source: 'Location: The Long Market' });
    expect(describeBrokenPin(broken)).toBe('“Location: The Long Market” pins a placeholder that doesn’t exist, so “jet” is never applied.');
    expect(buildLens(w, { pcTraitId: null, locationId: 'loc-harbor' }).brokenPins).toEqual([]);
  });

  it('says nothing about a pin the placeholder offers', () => {
    expect(buildLens(pinning('ash'), { pcTraitId: 't-sedge', locationId: null }).brokenPins).toEqual([]);
  });

  // An off-list pin is the feature — a trait forcing a shade nobody else rolls — so the lens applies it
  // exactly as play does and stays quiet.
  it('says nothing about a pin naming a value the placeholder does not offer', () => {
    const lens = buildLens(pinning('teal'), { pcTraitId: 't-sedge', locationId: null });
    expect(lens.brokenPins).toEqual([]);
    expect(lens.pins).toEqual({ 'ph-hair': 'teal' });
  });

  it('surfaces a pin naming a placeholder that is gone', () => {
    const [broken] = buildLens(pinning('copper', 'ph-deleted'), { pcTraitId: 't-sedge', locationId: null })
      .brokenPins;
    expect(broken).toMatchObject({ placeholderId: 'ph-deleted', value: 'copper' });
    expect(describeBrokenPin(broken)).toContain('doesn’t exist');
  });
});

describe('resolveLensText', () => {
  const chip = (id: string, mode = 'world') => `{{ph:${id}:${mode}:p1}}`;
  const placeholders = [hairColor, homeland];

  it('uses the pinned value', () => {
    const pins = buildLens(world(), { pcTraitId: 't-sedge', locationId: null }).pins;
    expect(resolveLensText(`Her ${chip('ph-hair')} hair.`, placeholders, pins)).toBe('Her copper hair.');
  });

  it('leaves an unpinned Wildcard as its options, since the value is a roll at play time', () => {
    expect(resolveLensText(`Her ${chip('ph-hair')} hair.`, placeholders, {})).toBe('Her {ash|copper|jet} hair.');
  });

  it('still reads a Variable as its one value', () => {
    expect(resolveLensText(`From ${chip('ph-home')}.`, placeholders, {})).toBe('From the Reach.');
  });

  it('resolves a Unique chip through the pin too — a pin is a fact about the character', () => {
    const pins = buildLens(world(), { pcTraitId: 't-sedge', locationId: null }).pins;
    expect(resolveLensText(chip('ph-hair', 'unique'), placeholders, pins)).toBe('copper');
  });

  it('shows nothing for a chip whose placeholder the world does not have, pinned or not', () => {
    expect(resolveLensText(`[${chip('ph-gone')}]`, placeholders, { 'ph-gone': 'copper' })).toBe('[]');
  });

  // The bar the whole lens is measured against: what an author is shown must be what that character's turn
  // would render. Both sides run the game's own resolver, so a divergence here is a real divergence.
  it('matches what a playthrough as that PC renders', () => {
    const pins = buildLens(world(), { pcTraitId: 't-sedge', locationId: null }).pins;
    const text = `Her ${chip('ph-hair')} hair, from ${chip('ph-home')}.`;
    const played = resolvePlaceholders(text, {
      placeholders,
      rolls: { world: {}, unique: {} },
      pins,
      pick: () => 'jet', // the roll an unpinned Wildcard would take
    });
    expect(played).toBe('Her copper hair, from the Reach.');
    expect(resolveLensText(text, placeholders, pins)).toBe(played);
  });

  it('leaves the roll to the playthrough — an unpinned chip is not fixed by the lens', () => {
    const rolled = resolvePlaceholders(`Her ${chip('ph-hair')} hair.`, {
      placeholders,
      rolls: { world: {}, unique: {} },
      pins: buildLens(world(), { pcTraitId: 't-reach', locationId: null }).pins,
      pick: () => 'jet',
    });
    expect(rolled).toBe('Her jet hair.');
  });
});

describe('lens option names', () => {
  const chipHair = encodePlaceholderToken({ id: 'ph-hair', mode: 'world', placementId: 'pl-1' });
  const chipHome = encodePlaceholderToken({ id: 'ph-home', mode: 'world', placementId: 'pl-2' });

  const uniqueHome = (placementId: string) => encodePlaceholderToken({ id: 'ph-home', mode: 'unique', placementId });

  it('names a location by its chip, never by its token or by a value', () => {
    const w = world({ locations: [{ id: 'l1', name: `The ${chipHome} Market` }] });
    expect(lensLocationOptions(w)[0].name).toBe('The {Homeland} Market');
  });

  it('letters two Unique placements the way the editor list does, entities first', () => {
    const w = world({
      entities: [{ id: 'e1', name: uniqueHome('pl-e') }],
      locations: [{ id: 'l1', name: uniqueHome('pl-l') }],
    });
    expect(lensLocationOptions(w)[0].name).toBe('Homeland (B)');
  });

  it('names a PC by its chip rather than under its own pins, and labels its group heading', () => {
    const w = world({
      traits: [{ ...traits[0], name: `${chipHair} Sedge-Born` }, ...traits.slice(1)],
      traitGroups: [{ ...groups[0], name: `${chipHome} Origins` }, groups[1]],
    });
    const [sedge] = lensPcOptions(w);
    expect(sedge.name).toBe('{Hair Color} Sedge-Born');
    expect(sedge.groupName).toBe('{Homeland} Origins');
  });

  it('marks a chip whose placeholder is gone, as the editor list does, rather than reading as untitled', () => {
    const gone = encodePlaceholderToken({ id: 'ph-gone', mode: 'world', placementId: 'pl-3' });
    expect(lensLocationOptions(world({ locations: [{ id: 'l1', name: gone }] }))[0].name).toBe('?');
    expect(lensLocationOptions(world({ locations: [{ id: 'l1', name: '' }] }))[0].name).toBe('Untitled location');
  });
});

describe('broken pin text', () => {
  it('describes the chips in the pin’s value rather than printing their tokens', () => {
    const chipHome = encodePlaceholderToken({ id: 'ph-home', mode: 'world', placementId: 'pl-2' });
    const w = world({
      traits: [
        { ...traits[0], placeholderPins: [{ placeholderId: 'ph-gone', value: `${chipHome} born` }] },
        ...traits.slice(1),
      ],
    });
    const [pin] = buildLens(w, { pcTraitId: 't-sedge', locationId: null }).brokenPins;
    expect(pin.value).toBe(`${chipHome} born`);
    expect(describeBrokenPin(pin)).toContain('“the Reach born”');
  });
});
