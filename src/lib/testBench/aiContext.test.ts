import { describe, it, expect } from 'vitest';
import { buildDestinationsContext, buildEntityContext, buildLocationContext } from '@/lib/locationContext';
import { estimateTokens } from '@/lib/memoryUtils';
import { YOU_TARGET } from '@/lib/entityRelationships';
import type { Connection, Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, TraitGroup } from '@/types';
import { defaultStatUpdatesPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import {
  buildAiContext, buildStatBlock, statsChipIn, type AiContextWorld, type ContextBlockId, type RosterScope,
} from './aiContext';
import { buildLens, type LensState } from './lens';

import { phValues } from '@/test/placeholderValues';
// A chip in an entity's name and in a connection's travel hint, so both paths through the lens are covered.
const HAIR_CHIP = '{{ph:ph-hair:world:p1}}';
const hairColor: Placeholder = { id: 'ph-hair', name: 'Hair Color', values: phValues(['ash', 'copper', 'jet']) };

const traitGroups: TraitGroup[] = [{ id: 'g-origin', name: 'Origin', parentId: null, maxPicks: 1 }];
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
  { id: 'c-bridge', a: 'loc-harbor', b: 'loc-market', aToB: { hint: `the ${HAIR_CHIP} plank bridge` } },
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
const roster = (data: ReturnType<typeof context>, scope: RosterScope) =>
  data.rosters.find((r) => r.scope === scope)!;

describe('context blocks', () => {
  it('renders each block exactly as the game builder does for the same inputs', () => {
    // Chip-free, so the comparison is against the builders' raw output with nothing resolved over it.
    const plain = {
      connections: [{ ...connections[0], aToB: { hint: 'the plank bridge' } }],
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

  it('serves Background lore ahead of Foreground lore in the one Dictionary block', () => {
    const split = [{
      ...dictionaries[0],
      entries: [
        { id: 'de-fg', name: 'The Silt', key: ['silt'], value: 'The river carries silt every spring.' },
        { id: 'de-bg', name: 'The Founding', key: ['founding'], value: 'Eel-trappers built the first pier.', position: 'before' },
      ],
    } as unknown as Dictionary]; // Only the fields the lore builder reads, as in the shared fixture.
    const text =block(context(at('loc-harbor'), { dictionaries: split }), 'dictionary').text;
    expect(text).toBe('The Founding: Eel-trappers built the first pier.\nThe Silt: The river carries silt every spring.');
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

  it('renders the stats block in the shape the shipped narration prompt places it', () => {
    expect(block(context(at('loc-harbor')), 'stats').token).toBe(statsChipIn(defaultSystemPrompt));
  });

  it('renders a stats chip in any shape through the one stat builder, for the lens PC', () => {
    const w = world({ stats: [{ ...stats[0], description: `Steadiness near ${HAIR_CHIP} water.` }] });
    const lens = buildLens({ ...w, traitGroups: w.traitGroups ?? [] }, at('loc-harbor', 't-sedge'));
    const token = statsChipIn(defaultStatUpdatesPrompt);
    expect(token).toBe('<STATS DESCRIPTION|numbers.meaning.markdown>');
    expect(buildStatBlock(w, lens, token!)).toBe('- **Nerve:** 5/10 — Steadiness near copper water.');
    expect(buildStatBlock(w, lens, '<STATS DESCRIPTION|descriptions.markdown>'))
      .toBe(block(buildAiContext(w, lens), 'stats').text);
  });

  it("nests the stat block under the world's stat groups, as the play chip does", () => {
    const w = world({
      stats: [{ ...stats[0], groupId: 'mind' }],
      statGroups: [{ id: 'mind', name: 'Mind', aiDescription: `Near ${HAIR_CHIP} water.`, parentId: null }],
    });
    const lens = buildLens({ ...w, traitGroups: w.traitGroups ?? [] }, at('loc-harbor', 't-sedge'));
    expect(buildStatBlock(w, lens, '<STATS DESCRIPTION|numbers.markdown>')).toBe('- **Mind:** Near copper water.\n  - **Nerve:** 5/10');
    expect(buildStatBlock(w, lens, '<STATS DESCRIPTION|descriptions.markdown>'))
      .toBe(block(buildAiContext(w, lens), 'stats').text);
  });

  it("leaves the Custom Persona entity's stats out of the Stats block, as the play chip does", () => {
    // Those stats nest in the persona's block, which this panel does not show.
    const calm: Stat = { ...stats[0], id: 's-calm', name: 'Calm', value: 3, description: '' };
    const w = world({ entities: [...(world().entities ?? []), { id: 'e-you', name: 'You', customPersona: true, stats: [calm] }] });
    const lens = buildLens({ ...w, traitGroups: w.traitGroups ?? [] }, at('loc-harbor', 't-sedge'));
    expect(buildStatBlock(w, lens, '<STATS DESCRIPTION|numbers.markdown>')).toBe('- **Nerve:** 5/10\n- **Tide Sense:** 2/10');
    expect(block(buildAiContext(w, lens), 'stats').text).toBe('- **Nerve**\n- **Tide Sense**');
    expect(buildStatBlock(w, lens, '<PERSONA|markdown>')).toContain('**Calm:** 3/10');
  });

  it('replaces the default trait its own exclusive group contributed', () => {
    const asDefault = block(context(at('loc-harbor')), 'traits').text;
    const asSedge = block(context(at('loc-harbor', 't-sedge')), 'traits').text;
    expect(asDefault).toContain('Reach-Born');
    expect(asSedge).toContain('Sedge-Born');
    expect(asSedge).not.toContain('Reach-Born');
  });
});

describe('the Persona block', () => {
  const keen: Trait = { id: 't-keen', name: 'Keen-Eyed', isDefault: true, aiDescription: 'Sees the far shore.', statChanges: [], order: 0 };
  const calm: Stat = { id: 's-calm', name: 'Calm', type: 'number', value: 3, min: 0, max: 10 } as Stat;
  const you: Entity = { id: 'e-you', name: 'You', customPersona: true, traits: [keen], stats: [calm] };
  const withYou = world({ entities: [...entities, you] });
  const lensOf = (w: AiContextWorld) => buildLens({ ...w, traitGroups: w.traitGroups ?? [] }, at('loc-harbor', 't-sedge'));

  it("serves the Custom Persona entity's traits and stats nested in one block, as the Persona chip renders it", () => {
    const lens = lensOf(withYou);
    const text = block(buildAiContext(withYou, lens), 'persona').text;
    expect(text).toBe('- **You**\n  - **traits:**\n    - **Keen-Eyed:** Sees the far shore.\n  - **stats:**\n    - **Calm:** 3/10\n');
    expect(text).toBe(buildStatBlock(withYou, lens, '<PERSONA|markdown>'));
  });

  it('has nothing to send in a world with no Custom Persona entity', () => {
    expect(entities.some((e) => e.customPersona)).toBe(false);
    const persona = block(context(at('loc-harbor', 't-sedge')), 'persona');
    expect(persona.empty).toBe(true);
    expect(persona.tokens).toBe(0);
  });

  it('sits before Stats and Traits', () => {
    const order = buildAiContext(withYou, lensOf(withYou)).blocks.map((b) => b.id);
    expect(order.indexOf('persona')).toBeGreaterThan(-1);
    expect(order.indexOf('persona')).toBeLessThan(order.indexOf('stats'));
    expect(order.indexOf('persona')).toBeLessThan(order.indexOf('traits'));
  });

  it('adds one to the blocks that have something to send, and its cost to the total', () => {
    const served = (data: ReturnType<typeof context>) => data.blocks.filter((b) => !b.empty).length;
    const without = context(at('loc-harbor', 't-sedge'));
    const data = buildAiContext(withYou, lensOf(withYou));
    expect(served(data)).toBe(served(without) + 1);
    expect(data.totalTokens).toBe(without.totalTokens + block(data, 'persona').tokens);
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

  it('lists an entity known here in Known Here, matching the block beside it', () => {
    // The Gull's reputation covers all of Sedge Landing, so at the Net Loft it is known, not reachable.
    // The Salt Crate is in the Net Loft itself, so Here lists it, though its picks cover the loft too.
    const known = entities.map((e) => (e.id === 'e-gull' || e.id === 'e-crate' ? { ...e, knownIn: ['loc-landing'] } : e));
    const data = context(at('loc-loft'), { entities: known });
    expect(roster(data, 'here').entities.map((e) => e.id)).toContain('e-crate');
    expect(roster(data, 'known').entities.map((e) => e.id)).toEqual(['e-gull']);
    expect(roster(data, 'reachable').entities.map((e) => e.id)).not.toContain('e-gull');
    const text = block(data, 'knownEntities').text;
    expect(text).toContain('A watching gull.');
    expect(text).not.toContain('A gull that watches the fish tables.');
  });

  it('lists an entity a relationship pulls in under Known Here, matching the block beside it', () => {
    // The Salt Crate is in the Net Loft; its owner is nowhere and known nowhere.
    const owner: Entity = { id: 'e-owner', name: 'Crate Owner', knownIn: 'nowhere', aiSummary: 'A trader.' };
    const crate = (e: Entity) => (e.id === 'e-crate' ? { ...e, relationships: [{ targetId: 'e-owner', label: 'owner' }] } : e);
    const data = context(at('loc-loft'), { entities: [...entities.map(crate), owner] });
    expect(roster(data, 'known').entities.map((e) => e.id)).toEqual(['e-owner']);
    expect(block(data, 'knownEntities').text).toContain('A trader.');
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
    expect(data.blocks).toHaveLength(14);
    expect(data.destinations.map((d) => d.id).sort()).toEqual(['loc-landing', 'loc-loft', 'loc-market']);
  });

  it('skips a roster id whose entity is gone rather than listing a blank row', () => {
    const ghosts = entities.filter((e) => e.id !== 'e-mara');
    const data = context(at('loc-harbor'), { entities: ghosts });
    expect(roster(data, 'here').entities.map((e) => e.id)).toEqual(['e-both']);
  });
});

describe('a blueprint chip in the PC’s trait text', () => {
  const garb: Placeholder = { id: 'garb', name: 'Garb', values: [{ id: 'v-tabard', text: 'tabard' }, { id: 'v-robe', text: 'robe' }] };
  const worn = traits.map((t) => (t.id === 't-sedge' ? { ...t, aiDescription: 'Wears {{ph:garb:world:p9}}.' } : t));
  // The Custom Persona entity's copy rewords tabard and removes robe, so it reads one fixed value.
  const newcomer: Entity = {
    id: 'cp', name: 'Newcomer', customPersona: true,
    placeholders: [{
      id: 'cp-garb', name: 'Garb', values: [], blueprintId: 'garb',
      valueOverrides: { 'v-tabard': { text: { value: 'rags', blueprint: 'tabard' } }, 'v-robe': { removed: true } },
    }],
  };

  it('reads the Custom Persona entity’s copy for the PC', () => {
    const data = context(at('loc-harbor', 't-sedge'), { traits: worn, placeholders: [hairColor, garb], entities: [...entities, newcomer] });
    expect(block(data, 'traits').text).toContain('Wears rags.');
  });

  it('reads the blueprint itself with no Custom Persona entity', () => {
    const data = context(at('loc-harbor', 't-sedge'), { traits: worn, placeholders: [hairColor, garb] });
    expect(block(data, 'traits').text).toContain('Wears {tabard|robe}.');
  });
});

describe('an entity’s own scope', () => {
  // Wren owns her eyes and pronouns. Her later default trait wins in her own text; the earlier one's card
  // still reads its own pin.
  const EYES = '{{ph:w-eyes:world:p1}}';
  const PRONOUNS = '{{ph:w-pro:world:p2}}';
  const eyes: Placeholder = { id: 'w-eyes', name: 'Eyes', values: phValues(['amber', 'gray', 'green']) };
  const pronouns: Placeholder = { id: 'w-pro', name: 'Pronouns', values: phValues(['she/her', 'they/them']) };
  const dusk: Trait = {
    id: 't-dusk', name: 'Dusk-Eyed', isDefault: true, statChanges: [], order: 0, aiDescription: `Eyes go ${EYES} at dusk.`,
    placeholderPins: [{ placeholderId: 'w-eyes', value: 'amber' }],
  };
  const sea: Trait = {
    id: 't-sea', name: 'Sea-Eyed', isDefault: true, statChanges: [], order: 1,
    placeholderPins: [{ placeholderId: 'w-eyes', value: 'gray' }, { placeholderId: 'w-pro', value: 'they/them' }],
  };
  const wren: Entity = {
    id: 'e-wren', name: 'Wren', locations: ['loc-harbor'], placeholders: [eyes, pronouns], traits: [dusk, sea],
    aiDescription: `{{char}} has ${EYES} eyes.`, pronouns: PRONOUNS,
    relationships: [{ targetId: YOU_TARGET, label: `${EYES}-eyed ward` }],
  };
  const you: Entity = { id: 'e-you', name: 'You', customPersona: true };
  const scoped = (over: Partial<AiContextWorld> = {}) => context(at('loc-harbor', 't-sedge'), { entities: [...entities, wren, you], ...over });

  it('reads a description’s owned chip and Character Name as play does', () => {
    expect(block(scoped(), 'entities').text).toContain('Wren has gray eyes.');
  });

  it('reads pronouns with an owned chip in the owner’s scope', () => {
    expect(block(scoped(), 'entities').text).toContain('they/them');
  });

  it('reads a relationship label in the owner’s scope on the persona’s block', () => {
    const text = block(scoped(), 'persona').text;
    expect(text).toContain("Wren's gray-eyed ward");
  });

  it('keeps a trait’s own pin on its own text over the entity’s', () => {
    expect(block(scoped(), 'entities').text).toContain('Eyes go amber at dusk.');
  });

  it('names the entity in its Character Name with the chips in its name read in its scope', () => {
    const titled = { ...wren, name: `Wren the ${EYES}-Eyed` };
    expect(block(scoped({ entities: [...entities, titled, you] }), 'entities').text).toContain('Wren the gray-Eyed has gray eyes.');
  });

  it('reads the Custom Persona entity’s own text with the lens’s pins, its traits among them', () => {
    const hazel: Trait = {
      id: 't-hazel', name: 'Hazel-Eyed', isDefault: true, statChanges: [], order: 0,
      placeholderPins: [{ placeholderId: 'w-eyes', value: 'green' }],
    };
    const self = { ...you, traits: [hazel], aiDescription: `Eyes of ${EYES}.` };
    const data = scoped({ entities: [...entities, wren, self] });
    expect(block(data, 'persona').text).toContain('Eyes of green.');
    expect(block(data, 'entities').text).toContain('Wren has gray eyes.');
  });

  it('lets a starting stat’s band pin win over the entity’s trait, as play lays them', () => {
    const banded = stats.map((s) => (s.id === 's-nerve'
      ? { ...s, descriptors: [{ id: 'd-low', threshold: 10, description: 'Rattled', placeholderPins: [{ placeholderId: 'w-eyes', value: 'green' }] }] }
      : s));
    expect(block(scoped({ stats: banded }), 'entities').text).toContain('Wren has green eyes.');
  });

  it('reads a blueprint chip through the entity’s own copy', () => {
    const garb: Placeholder = { id: 'garb', name: 'Garb', values: [{ id: 'v-tabard', text: 'tabard' }, { id: 'v-robe', text: 'robe' }] };
    const copy: Placeholder = {
      id: 'w-garb', name: 'Garb', values: [], blueprintId: 'garb',
      valueOverrides: { 'v-tabard': { text: { value: 'oilskin', blueprint: 'tabard' } }, 'v-robe': { removed: true } },
    };
    const clad = { ...wren, placeholders: [eyes, pronouns, copy], aiDescription: 'Wears {{ph:garb:world:p9}}.' };
    const text = block(scoped({ entities: [...entities, clad, you], placeholders: [hairColor, garb] }), 'entities').text;
    expect(text).toContain('Wears oilskin.');
  });

  it('lets the lens location’s pin win over the entity’s trait, as play lays them', () => {
    const harbor = locations.map((l) => (l.id === 'loc-harbor' ? { ...l, placeholderPins: [{ placeholderId: 'w-eyes', value: 'green' }] } : l));
    expect(block(scoped({ locations: harbor }), 'entities').text).toContain('Wren has green eyes.');
  });
});
