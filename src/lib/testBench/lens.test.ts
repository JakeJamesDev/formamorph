import { describe, it, expect } from 'vitest';
import { resolvePlaceholders } from '@/lib/placeholders';
import type { GameLocation, Placeholder, Trait, TraitGroup } from '@/types';
import {
  buildLens, describeBrokenPin, lensLocationOptions, lensPcOptions, lensStatOverrides, resolveLensText,
  seedLens, type LensWorld,
} from './lens';

const hairColor: Placeholder = { id: 'ph-hair', name: 'Hair Color', values: ['ash', 'copper', 'jet'] };
const homeland: Placeholder = { id: 'ph-home', name: 'Homeland', values: ['the Reach'] };

const groups: TraitGroup[] = [
  { id: 'g-origin', name: 'Origin', parentId: null, exclusive: true },
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
    const flat = world({ traitGroups: groups.map((g) => ({ ...g, exclusive: false })) });
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

describe('broken pins', () => {
  const pinning = (value: string, placeholderId = 'ph-hair'): LensWorld => world({
    traits: [{ ...traits[0], placeholderPins: [{ placeholderId, value }] }, ...traits.slice(1)],
  });

  it('says nothing about a pin the placeholder offers', () => {
    expect(buildLens(pinning('ash'), { pcTraitId: 't-sedge', locationId: null }).brokenPins).toEqual([]);
  });

  it('surfaces a pin naming a value the placeholder does not have', () => {
    const [broken] = buildLens(pinning('teal'), { pcTraitId: 't-sedge', locationId: null }).brokenPins;
    expect(broken).toMatchObject({ reason: 'missing-value', placeholderName: 'Hair Color', value: 'teal' });
    expect(describeBrokenPin(broken)).toContain('isn’t one of its values');
  });

  it('surfaces a pin naming a placeholder that is gone', () => {
    const [broken] = buildLens(pinning('copper', 'ph-deleted'), { pcTraitId: 't-sedge', locationId: null })
      .brokenPins;
    expect(broken).toMatchObject({ reason: 'missing-placeholder', value: 'copper' });
    expect(describeBrokenPin(broken)).toContain('doesn’t exist');
  });

  it('still applies a broken value, because a playthrough would', () => {
    const lens = buildLens(pinning('teal'), { pcTraitId: 't-sedge', locationId: null });
    expect(lens.pins).toEqual({ 'ph-hair': 'teal' });
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
