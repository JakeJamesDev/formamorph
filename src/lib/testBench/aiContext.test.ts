import { describe, it, expect } from 'vitest';
import { buildDestinationsContext, buildEntityContext, buildLocationContext } from '@/lib/locationContext';
import { estimateTokens } from '@/lib/memoryUtils';
import type { Connection, Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, TraitGroup } from '@/types';
import { buildAiContext, type AiContextWorld, type ContextBlockId } from './aiContext';
import { buildLens, type LensState } from './lens';

import { phValues } from '@/test/placeholderValues';
// A chip in an entity's name and in a connection's travel hint, so both paths through the lens are covered.
const HAIR_CHIP = '{{ph:ph-hair:world:p1}}';
const hairColor: Placeholder = { id: 'ph-hair', name: 'Hair Color', values: phValues(['ash', 'copper', 'jet']) };

const traitGroups: TraitGroup[] = [{ id: 'g-origin', name: 'Origin', parentId: null, exclusive: true }];
const traits: Trait[] = [
  {
    id: 't-sedge', name: 'Sedge-Born', groupId: 'g-origin', statChanges: [], order: 0,
    placeholderPins: [{ placeholderId: 'ph-hair', value: 'copper' }],
    statToggles: [{ statId: 's-tide', enabled: true }],
  },
  { id: 't-reach', name: 'Reach-Born', groupId: 'g-origin', statChanges: [], order: 1, isDefault: true },
];

// Sedge Landing contains Harbor Steps and The Long Market; Net Loft hangs under Harbor Steps.
const locations: GameLocation[] = [
  { id: 'loc-landing', name: 'Sedge Landing', aiDescription: 'A silted river mouth.' },
  {
    id: 'loc-harbor', name: 'Harbor Steps', parentId: 'loc-landing', isStarting: true,
    aiDescription: 'Wet stone stairs down to the water.', aiSummary: 'Wet stairs.',
  },
  {
    id: 'loc-market', name: 'The Long Market', parentId: 'loc-landing',
    aiDescription: 'Stalls under a sailcloth roof.', aiSummary: 'Roofed stalls.',
  },
  { id: 'loc-loft', name: 'Net Loft', parentId: 'loc-harbor', aiDescription: 'Nets on hooks.' },
];

// One-way, hinted, and over a pair that would otherwise be implicitly two-way: Harbor reaches the Market,
// the Market cannot come back.
const connections: Connection[] = [
  { id: 'c-bridge', from: 'loc-harbor', to: 'loc-market', twoWay: false, aiHint: `the ${HAIR_CHIP} plank bridge` },
];

const entities: Entity[] = [
  {
    id: 'e-mara', name: `Mara the ${HAIR_CHIP}`, locations: ['loc-harbor'],
    aiDescription: 'A netmender with cracked hands.', aiSummary: 'A netmender.',
  },
  { id: 'e-both', name: 'Ship Cat', locations: ['loc-harbor', 'loc-loft'], aiDescription: 'Grey, one ear.' },
  { id: 'e-crate', name: 'Salt Crate', locations: ['loc-loft'], aiDescription: 'Nailed shut.' },
  {
    id: 'e-gull', name: 'One-Eyed Gull', locations: ['loc-market'],
    aiDescription: 'A gull that watches the fish tables.', aiSummary: 'A watching gull.',
  },
  { id: 'e-tarp', name: 'Torn Tarp', locations: ['loc-market'], aiDescription: 'Flaps in the wind.' },
  { id: 'e-mote', name: 'Dust Mote', locations: ['loc-market'] },
];

const stats: Stat[] = [
  { id: 's-nerve', name: 'Nerve', type: 'number', value: 5, min: 0, max: 10 } as Stat,
  { id: 's-tide', name: 'Tide Sense', type: 'number', value: 2, min: 0, max: 10, enabled: false } as Stat,
];

const dictionaries: Dictionary[] = [{
  id: 'd-main', name: 'Sedge Lore', enabled: true,
  entries: [
    { id: 'de-1', name: 'The Silt', key: ['silt'], value: 'The river carries silt every spring.' },
    { id: 'de-2', name: 'Muted', key: ['tide'], value: 'Never read.', enabled: false },
  ],
} as unknown as Dictionary];

const world = (over: Partial<AiContextWorld> = {}): AiContextWorld => ({
  worldOverview: { name: 'Sedge', systemPrompt: 'A damp river town.' } as AiContextWorld['worldOverview'],
  stats,
  locations,
  connections,
  entities,
  traits,
  traitGroups,
  dictionaries,
  placeholders: [hairColor],
  ...over,
});

const at = (locationId: string | null, pcTraitId: string | null = null): LensState => ({ pcTraitId, locationId });
const context = (state: LensState, over: Partial<AiContextWorld> = {}) => {
  const w = world(over);
  return buildAiContext(w, buildLens({ ...w, traitGroups: w.traitGroups ?? [] }, state));
};
const block = (data: ReturnType<typeof context>, id: ContextBlockId) => data.blocks.find((b) => b.id === id)!;
const roster = (data: ReturnType<typeof context>, scope: 'here' | 'sublocations' | 'reachable') =>
  data.rosters.find((r) => r.scope === scope)!;

describe('context blocks', () => {
  it('renders each block exactly as the game builder does for the same inputs', () => {
    // Chip-free, so the comparison is against the builders' raw output with nothing resolved over it.
    const plain = {
      connections: [{ ...connections[0], aiHint: 'the plank bridge' }],
      entities: entities.map((e) => (e.id === 'e-mara' ? { ...e, name: 'Mara' } : e)),
      placeholders: [],
    };
    const data = context(at('loc-harbor'), plain);
    const harbor = locations[1];
    expect(block(data, 'location').text).toBe(buildLocationContext(harbor, { format: 'markdown' }));
    expect(block(data, 'entities').text).toBe(buildEntityContext(harbor, plain.entities, { format: 'markdown' }));
    expect(block(data, 'destinations').text).toBe(
      buildDestinationsContext(harbor, locations, plain.connections, { preferSummary: true, format: 'markdown' }),
    );
  });

  it('serves the world description and the enabled lore, and never the disabled entry', () => {
    const data = context(at('loc-harbor'));
    expect(block(data, 'world').text).toContain('A damp river town.');
    expect(block(data, 'dictionary').text).toContain('The river carries silt every spring.');
    expect(block(data, 'dictionary').text).not.toContain('Never read.');
    expect(block(data, 'dictionary').note).toContain('(1)');
  });

  it('marks a block the location has nothing for as empty, costing nothing', () => {
    const data = context(at('loc-landing'));
    // Sedge Landing is top-level, so there is no containing location to serve.
    expect(block(data, 'parent').empty).toBe(true);
    expect(block(data, 'parent').tokens).toBe(0);
    expect(block(data, 'location').empty).toBe(false);
  });

  it('serves nothing anywhere when the lens stands nowhere', () => {
    const data = context(at(null));
    const located: ContextBlockId[] = ['location', 'sublocations', 'parent', 'reachable', 'destinations', 'entities'];
    expect(located.filter((id) => !block(data, id).empty)).toEqual([]);
    // The world's own blocks do not depend on standing anywhere.
    expect(block(data, 'world').empty).toBe(false);
  });

  it('estimates each block from its rendered text and totals exactly the blocks it shows', () => {
    const data = context(at('loc-harbor'));
    const location = block(data, 'location');
    expect(location.tokens).toBe(estimateTokens(location.text.length));
    expect(data.totalTokens).toBe(data.blocks.reduce((sum, b) => sum + b.tokens, 0));
    // A block with real text has to move the total, or the figure is decoration.
    expect(data.totalTokens).toBeGreaterThan(location.tokens);
  });
});

describe('the lens PC', () => {
  it('resolves chips through the PC’s pins, in blocks and in destination hints alike', () => {
    const data = context(at('loc-harbor', 't-sedge'));
    expect(block(data, 'entities').text).toContain('Mara the copper');
    expect(roster(data, 'here').entities.find((e) => e.id === 'e-mara')!.name).toBe('Mara the copper');
    expect(data.destinations.find((d) => d.id === 'loc-market')!.hint).toBe('the copper plank bridge');
  });

  it('resolves the location’s own name, which the panel heads its cost with', () => {
    const named = locations.map((l) => (l.id === 'loc-harbor' ? { ...l, name: `${HAIR_CHIP} Steps` } : l));
    expect(context(at('loc-harbor', 't-sedge'), { locations: named }).locationName).toBe('copper Steps');
    expect(context(at(null)).locationName).toBe('');
  });

  it('leaves an unpinned chip as its editor description rather than inventing a roll', () => {
    const data = context(at('loc-harbor'));
    expect(block(data, 'entities').text).toContain('{ash|copper|jet}');
  });

  it('serves the stats the PC switches on and drops the ones it switches off', () => {
    expect(block(context(at('loc-harbor')), 'stats').text).not.toContain('Tide Sense');
    expect(block(context(at('loc-harbor', 't-sedge')), 'stats').text).toContain('Tide Sense');
  });

  it('replaces the default trait its own exclusive group contributed', () => {
    const asDefault = block(context(at('loc-harbor')), 'traits').text;
    const asSedge = block(context(at('loc-harbor', 't-sedge')), 'traits').text;
    expect(asDefault).toContain('Reach-Born');
    expect(asSedge).toContain('Sedge-Born');
    expect(asSedge).not.toContain('Reach-Born');
  });
});

describe('destinations', () => {
  it('lists the sub-location, the containing location and the connection, each with how it is reached', () => {
    const data = context(at('loc-harbor', 't-sedge'));
    expect(data.destinations.map((d) => [d.name, d.via])).toEqual(
      expect.arrayContaining([['Net Loft', 'implicit'], ['Sedge Landing', 'implicit'], ['The Long Market', 'connection']]),
    );
    expect(data.destinations.find((d) => d.id === 'loc-loft')!.hint).toBeUndefined();
  });

  it('honors a one-way connection: the return trip is never offered', () => {
    const back = context(at('loc-market')).destinations.map((d) => d.id);
    expect(back).not.toContain('loc-harbor');
    expect(back).toContain('loc-landing');
  });

  it('drops the implicit sibling link the connection replaced, so a pair is listed once', () => {
    const toMarket = context(at('loc-harbor')).destinations.filter((d) => d.id === 'loc-market');
    expect(toMarket).toHaveLength(1);
    expect(toMarket[0].via).toBe('connection');
  });

  it('lists nothing at a location a connection points away from and nothing points into', () => {
    const island: GameLocation[] = [{ id: 'loc-rock', name: 'Bare Rock' }];
    expect(context(at('loc-rock'), { locations: island, connections: [], entities: [] }).destinations).toEqual([]);
  });
});

describe('entity rosters', () => {
  it('lists each entity in exactly one scope, the nearest one', () => {
    const data = context(at('loc-harbor'));
    expect(roster(data, 'here').entities.map((e) => e.id)).toEqual(['e-mara', 'e-both']);
    // The Ship Cat is in the Net Loft too, but it is already here.
    expect(roster(data, 'sublocations').entities.map((e) => e.id)).toEqual(['e-crate']);
    expect(roster(data, 'reachable').entities.map((e) => e.id)).toEqual(['e-gull', 'e-tarp', 'e-mote']);
  });

  it('flags summary delivery only where the scope asks for it and a summary exists', () => {
    const data = context(at('loc-harbor'));
    expect(roster(data, 'here').prefersSummary).toBe(false);
    // Mara has a summary, but the roster here is served in full.
    expect(roster(data, 'here').entities.find((e) => e.id === 'e-mara')!.delivery).toBe('full');
    const reachable = roster(data, 'reachable');
    expect(reachable.prefersSummary).toBe(true);
    const delivery = Object.fromEntries(reachable.entities.map((e) => [e.id, e.delivery]));
    expect(delivery).toEqual({ 'e-gull': 'summary', 'e-tarp': 'full', 'e-mote': 'none' });
  });

  it('agrees with the block beside it: a summarized entity’s full description is not sent', () => {
    const text = block(context(at('loc-harbor')), 'reachableEntities').text;
    expect(text).toContain('A watching gull.');
    expect(text).not.toContain('A gull that watches the fish tables.');
    // The one with no summary falls through to its full description rather than dropping out.
    expect(text).toContain('Flaps in the wind.');
  });

  it('holds no roster anywhere when the lens stands nowhere', () => {
    expect(context(at(null)).rosters.every((r) => r.entities.length === 0)).toBe(true);
  });
});

describe('a malformed world', () => {
  it('assembles from a world missing every optional collection', () => {
    // World JSON is hand-editable, so a collection the type calls required can simply be absent.
    const bare = { worldOverview: {}, stats: [], locations, entities: [], traits: [] } as unknown as AiContextWorld;
    const data = buildAiContext(bare, buildLens({ ...bare, traitGroups: [] }, at('loc-harbor')));
    expect(data.blocks).toHaveLength(12);
    expect(data.destinations.map((d) => d.id).sort()).toEqual(['loc-landing', 'loc-loft', 'loc-market']);
  });

  it('skips a roster id whose entity is gone rather than listing a blank row', () => {
    const ghosts = entities.filter((e) => e.id !== 'e-mara');
    const data = context(at('loc-harbor'), { entities: ghosts });
    expect(roster(data, 'here').entities.map((e) => e.id)).toEqual(['e-both']);
  });
});
