import { describe, it, expect } from 'vitest';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import { estimateTokens } from '@/lib/memoryUtils';
import { activeDescriptor } from '@/lib/statContext';
import type { Entity, GameLocation, Stat, Trait, TraitGroup, WorldOverview } from '@/types';
import { buildLens, type LensState } from './lens';
import {
  buildOpening, EMPTY_OPENING, primeOpeningRolls, rerollOpeningRolls, type OpeningWorld,
} from './opening';

// Chip tokens, spelled as the editor inserts them.
const chip = (id: string, mode: 'world' | 'unique', placement: string) => `{{ph:${id}:${mode}:${placement}}}`;

const groups: TraitGroup[] = [{ id: 'g-origin', name: 'Origin', parentId: null, exclusive: true }];

const traits: Trait[] = [
  // The default PC of the exclusive group — replaced when the lens picks a sibling.
  { id: 't-sedge', name: 'Sedge-Born', groupId: 'g-origin', isDefault: true, order: 0, statChanges: [] },
  {
    id: 't-reach', name: 'Reach-Born', groupId: 'g-origin', order: 1,
    statChanges: [
      { statId: 's-luck', value: -10, type: 'starting' },
      { statId: 's-nerve', value: 60, type: 'max' },
    ],
    statToggles: [{ statId: 's-tide', enabled: true }],
    placeholderPins: [{ placeholderId: 'ph-hair', value: 'copper' }],
  },
  // An ungrouped default: its pin applies to every fresh game, PC or no PC.
  {
    id: 't-base', name: 'Fen Blood', isDefault: true, statChanges: [],
    placeholderPins: [{ placeholderId: 'ph-coin', value: 'wren' }],
  },
];

const stats: Stat[] = [
  {
    id: 's-nerve', name: 'Nerve', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0,
    descriptors: [
      { id: 'd1', threshold: 25, description: 'Shaky' },
      { id: 'd2', threshold: 50, description: 'Steady' },
      { id: 'd3', threshold: 100, description: 'Iron' },
    ],
  },
  { id: 's-tide', name: 'Tide Sense', type: 'number', description: '', min: 0, max: 10, regen: 0, descriptors: [], enabled: false },
  {
    id: 's-doom', name: 'Doom', type: 'number', description: '', min: 0, max: 100, value: 80, regen: 0,
    descriptors: [{ id: 'd4', threshold: 20, description: 'Faint' }],
  },
  { id: 's-luck', name: 'Luck', type: 'number', description: '', min: 0, max: 20, value: 5, regen: 0, descriptors: [] },
];

const locations: GameLocation[] = [
  {
    id: 'harbor', name: 'Harbor Steps', isStarting: true,
    aiDescription: 'Stone steps climbing out of the fen.',
  },
  { id: 'market', name: 'The Long Market' },
];

const entities: Entity[] = [
  { id: 'e1', name: 'Maren', locations: ['harbor'], aiDescription: `Carries ${chip('ph-gift', 'unique', 'pl-g1')}.` },
  { id: 'e2', name: 'Tobin', locations: ['harbor'], aiDescription: `Hides ${chip('ph-gift', 'unique', 'pl-g2')}.` },
];

const world = (over: Partial<OpeningWorld> = {}): OpeningWorld => ({
  worldOverview: {
    name: 'Sedge Landing', description: '',
    systemPrompt: `The fens. Hair: ${chip('ph-hair', 'world', 'pl-h1')}. Coin: ${chip('ph-coin', 'world', 'pl-c1')}.`,
  } as WorldOverview,
  stats,
  locations,
  entities,
  traits,
  traitGroups: groups,
  statUpdates: [],
  dictionaries: [{
    id: 'b1', name: 'Book', entries: [
      { id: 'd-fen', name: 'The Fen', key: ['fen'], value: 'The fen remembers every debt.' },
      { id: 'd-dragon', name: 'Dragons', key: ['dragon'], value: 'Dragons are long gone.' },
    ],
  }],
  placeholders: [
    { id: 'ph-hair', name: 'Hair Color', values: ['ash', 'copper', 'jet'] },
    { id: 'ph-coin', name: 'Coin Bird', values: ['gull', 'wren'], weights: { gull: 3, wren: 1 } },
    { id: 'ph-gift', name: 'Gift', values: ['knife', 'ribbon', 'shell'] },
  ],
  ...over,
});

const lensAt = (w: OpeningWorld, state: Partial<LensState> = {}) =>
  buildLens(w, { pcTraitId: null, locationId: null, ...state });

// A deterministic chooser: always the first value, so a re-mint is observable against a `pick` that
// chose the last.
const pickFirst = (values: string[]) => values[0];
const pickLast = (values: string[]) => values[values.length - 1];

const openingFor = (w: OpeningWorld, pcTraitId: string | null = null) => {
  const rolls = primeOpeningRolls(w, {}, pickFirst);
  return buildOpening(w, lensAt(w, { pcTraitId }), rolls);
};

describe('activeDescriptor band edges', () => {
  const stat = stats[0]; // Nerve: 25 Shaky / 50 Steady / 100 Iron over 0..100
  it('picks the band whose threshold the value sits exactly on', () => {
    expect(activeDescriptor(stat, 25)?.description).toBe('Shaky');
  });
  it('moves to the next band just past the edge', () => {
    expect(activeDescriptor(stat, 26)?.description).toBe('Steady');
  });
  it('is undefined above every band', () => {
    expect(activeDescriptor({ ...stat, descriptors: [{ id: 'd4', threshold: 20, description: 'Faint' }] }, 80)).toBeUndefined();
  });
  it('treats a zero-width range as 0%', () => {
    expect(activeDescriptor({ ...stat, min: 5, max: 5 }, 5)?.description).toBe('Shaky');
  });
});

describe('buildOpening stats', () => {
  it('shows each enabled stat at its fresh-game starting value with its active descriptor', () => {
    const nerve = openingFor(world()).stats.find((s) => s.id === 's-nerve');
    expect(nerve?.value).toBe(40);
    expect(nerve?.descriptor).toBe('Steady');
  });

  it('flags a stat whose start sits above every band — the contradiction class', () => {
    const opening = openingFor(world());
    expect(opening.stats.find((s) => s.id === 's-doom')?.uncovered).toBe(true);
    expect(opening.stats.find((s) => s.id === 's-nerve')?.uncovered).toBe(false);
  });

  it('never flags a stat with no bands at all', () => {
    expect(openingFor(world()).stats.find((s) => s.id === 's-luck')?.uncovered).toBe(false);
  });

  it('leaves out a disabled stat and names it, until the PC toggles it on', () => {
    const without = openingFor(world());
    expect(without.stats.map((s) => s.id)).not.toContain('s-tide');
    expect(without.disabledStats).toEqual(['Tide Sense']);
    const withPc = openingFor(world(), 't-reach');
    expect(withPc.stats.map((s) => s.id)).toContain('s-tide');
    expect(withPc.disabledStats).toEqual([]);
  });

  it('applies the PC trait starting deltas, clamp included, and reports the shift', () => {
    const luck = openingFor(world(), 't-reach').stats.find((s) => s.id === 's-luck');
    // Authored start 5, delta −10, floor 0: the clamp swallows half — the real fresh-game number.
    expect(luck?.value).toBe(0);
    expect(luck?.traitShift).toBe(-5);
  });

  it('derives bounds from the active traits, and bands against them', () => {
    const nerve = openingFor(world(), 't-reach').stats.find((s) => s.id === 's-nerve');
    expect(nerve?.max).toBe(160);
    // 40 of 0..160 is exactly 25% — the Shaky band's edge, a different band than the authored range gives.
    expect(nerve?.descriptor).toBe('Shaky');
  });
});

describe('buildOpening traits', () => {
  it('lists the defaults when no PC is chosen', () => {
    expect(openingFor(world()).traits.map((t) => t.id)).toEqual(['t-sedge', 't-base']);
  });

  it('substitutes the PC for its exclusive-group default, in authored order', () => {
    const opening = openingFor(world(), 't-reach');
    expect(opening.traits.map((t) => t.id)).toEqual(['t-reach', 't-base']);
    expect(opening.traits.find((t) => t.id === 't-reach')?.isPc).toBe(true);
  });

  it('names each trait’s pins and stat toggles', () => {
    const reach = openingFor(world(), 't-reach').traits.find((t) => t.id === 't-reach');
    expect(reach?.pins).toEqual([{ placeholder: 'Hair Color', value: 'copper' }]);
    expect(reach?.toggles).toEqual([{ stat: 'Tide Sense', enabled: true }]);
  });
});

describe('opening rolls', () => {
  it('primes every wildcard placement a fresh game would roll', () => {
    const rolls = primeOpeningRolls(world(), {}, pickFirst);
    expect(rolls.world).toEqual({ 'ph-hair': 'ash', 'ph-coin': 'gull' });
    expect(rolls.unique).toEqual({ 'pl-g1': 'knife', 'pl-g2': 'knife' });
  });

  it('reports each value’s chance from the weights math', () => {
    const coin = openingFor(world()).rolls.find((r) => r.placeholderId === 'ph-coin');
    expect(coin?.chances).toEqual([
      { value: 'gull', chance: 75 },
      { value: 'wren', chance: 25 },
    ]);
  });

  it('shows the collision odds where several unique chips share a pool', () => {
    const gift = openingFor(world()).rolls.find((r) => r.placeholderId === 'ph-gift');
    expect(gift?.uniqueValues).toEqual(['knife', 'knife']);
    // Two independent draws from three uniform values: P(match) = 1/3.
    expect(gift?.collisionChance).toBeCloseTo(100 / 3, 5);
  });

  it('marks pinned placeholders instead of offering their roll', () => {
    const opening = openingFor(world(), 't-reach');
    expect(opening.rolls.find((r) => r.placeholderId === 'ph-hair')?.pinnedValue).toBe('copper');
    // The ungrouped default's pin applies to every fresh game, with or without a PC.
    expect(openingFor(world()).rolls.find((r) => r.placeholderId === 'ph-coin')?.pinnedValue).toBe('wren');
  });

  it('rerolls only the unpinned placeholders', () => {
    const w = world();
    const before = primeOpeningRolls(w, {}, pickFirst);
    const after = rerollOpeningRolls(w, lensAt(w, { pcTraitId: 't-reach' }), before, pickLast);
    // Pinned (ph-hair by the PC, ph-coin by the default) keep their frozen roll underneath the pin…
    expect(after.world?.['ph-hair']).toBe('ash');
    expect(after.world?.['ph-coin']).toBe('gull');
    // …while the unpinned unique placements draw fresh.
    expect(after.unique).toEqual({ 'pl-g1': 'shell', 'pl-g2': 'shell' });
  });
});

describe('the assembled first prompt', () => {
  it('sends the opening cue as the user turn, framed as play frames it', () => {
    const opening = openingFor(world());
    expect(opening.user).toContain(OPENING_SCENE_CUE);
  });

  it('resolves chips through the active traits’ pins', () => {
    const opening = openingFor(world(), 't-reach');
    expect(opening.system).toContain('Hair: copper.');
    expect(opening.system).toContain('Coin: wren.');
  });

  it('tells the model the descriptor the starting value lands on', () => {
    expect(openingFor(world()).system).toContain('Steady');
  });

  it('runs the real turn-one lore scan: fired entries in, silent ones out', () => {
    const opening = openingFor(world());
    expect(opening.system).toContain('The fen remembers every debt.');
    expect(opening.system).not.toContain('Dragons are long gone.');
  });

  it('totals the whole first prompt', () => {
    const opening = openingFor(world());
    expect(opening.totalTokens).toBe(estimateTokens(opening.system.length + opening.user.length));
    expect(opening.totalTokens).toBeGreaterThan(0);
  });
});

describe('the fresh game’s stage', () => {
  it('opens at the flagged starting location', () => {
    const opening = openingFor(world());
    expect(opening.location?.id).toBe('harbor');
    expect(opening.startPool).toBe(1);
  });

  it('counts the random pool when several locations are flagged', () => {
    const twoStarts = world({ locations: locations.map((l) => ({ ...l, isStarting: true })) });
    expect(openingFor(twoStarts).startPool).toBe(2);
  });

  it('falls back to any location when none is flagged, and says how wide the pool is', () => {
    const noStart = world({ locations: locations.map((l) => ({ ...l, isStarting: false })) });
    const opening = openingFor(noStart);
    expect(opening.location?.id).toBe('harbor');
    expect(opening.startPool).toBe(2);
  });
});

describe('safety', () => {
  it('never edits the world', () => {
    const w = world();
    const snapshot = JSON.stringify(w);
    const rolls = primeOpeningRolls(w, {}, pickFirst);
    buildOpening(w, lensAt(w, { pcTraitId: 't-reach' }), rolls);
    rerollOpeningRolls(w, lensAt(w, { pcTraitId: 't-reach' }), rolls, pickLast);
    expect(JSON.stringify(w)).toBe(snapshot);
  });

  it('survives a malformed world', () => {
    const bare = {} as OpeningWorld;
    expect(() => buildOpening(bare, buildLens(bare, { pcTraitId: null, locationId: null }), {})).not.toThrow();
  });

  it('has an empty shape for the closed tab', () => {
    expect(EMPTY_OPENING.stats).toEqual([]);
    expect(EMPTY_OPENING.totalTokens).toBe(0);
  });
});
