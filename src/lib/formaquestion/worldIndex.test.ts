import { describe, expect, it } from 'vitest';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { migrateWorld } from '@/lib/version';
import { withDerivedLocations } from '@/lib/entityKind';
import { PLAYER_START, type Currency, type Dictionary, type Entity, type GameState, type Item, type Stat, type Tool, type World } from '@/types';
import { buildPlayerView } from './playerView';
import { playerViewWorld } from './playerViewWorld';
import { buildWorldIndex, chipsFromText, worldIndexOf, worldTextOf, type WorldIndexInput } from './worldIndex';

const stat = (patch: Partial<Stat> = {}): Stat => ({ id: 'grit', name: 'Grit', type: 'number', description: 'How long you hold on.', min: 0, max: 100, value: 40, regen: 0, descriptors: [], ...patch });

const mara: Entity = { id: 'mara', name: 'Mara', playerDescription: 'A widow who keeps the gate.', aiDescription: 'She hides the key under the shrine.' };

const lore: Dictionary = {
  id: 'book', name: 'Lore', entries: [
    { id: 'pact', name: 'Ashen Pact', key: ['ashen pact'], value: 'An oath sworn in smoke by the founders.' },
    { id: 'tide', name: 'Black Tide', key: ['black tide'], value: 'A flood that rose once a century.', enabled: false },
  ],
};

const tool: Tool = {
  id: 'roll', name: 'Roll Fate', description: 'Rolls a fate die.', params: [], emptyResult: '', offeredTo: ['narration'],
  handler: { kind: 'script', code: 'return fateDie();' },
};

const world = (patch: Partial<WorldIndexInput> = {}): WorldIndexInput => ({
  worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: 'Narrate in second person.', tags: [], promptOverrides: { choicesPrompt: 'Offer three choices.' } },
  stats: [stat({ scripts: [{ id: 's1', timing: 'before', code: 'return grit.value + 1;' }] })],
  locations: [{ id: 'gate', name: 'North Gate', playerDescription: 'Iron bars and moss.' }],
  entities: [mara],
  traits: [{ id: 'brave', name: 'Brave', statChanges: [{ statId: 'grit', value: 5 }] }],
  dictionaries: [lore],
  scripts: [{ id: 'w1', name: 'Dawn Bell', timing: 'start', code: 'ringBell();' }],
  tools: [tool],
  items: [],
  ...patch,
});

const hits = (input: WorldIndexInput, query: string) => {
  const index = buildWorldIndex(input);
  return index.docs.search(query, 5).map((section) => index.sourceOf(section));
};

describe('the World Index', () => {
  it('finds an entity by its text, with both descriptions in its section', () => {
    const index = buildWorldIndex(world());
    const [top] = index.docs.search('widow gate keeper', 5);
    expect(index.sourceOf(top)).toEqual({ kind: 'world', worldKind: 'entity', id: 'mara', name: 'Mara' });
    expect(top.markdown).toContain('A widow who keeps the gate.');
    expect(top.markdown).toContain('She hides the key under the shrine.');
  });

  it('indexes a stat the editor holds with no descriptors yet', () => {
    const bare = { ...stat({ id: 'calm', name: 'Calm' }), descriptors: undefined } as unknown as Stat;
    expect(hits(world({ stats: [bare] }), 'calm')).toContainEqual({ kind: 'world', worldKind: 'stat', id: 'calm', name: 'Calm' });
  });

  it('indexes scripts, stat code, World Tools and the world prompts', () => {
    expect(hits(world(), 'ringBell')[0]).toMatchObject({ worldKind: 'script', id: 'w1' });
    expect(hits(world(), 'grit value')[0]).toMatchObject({ worldKind: 'stat', id: 'grit' });
    expect(hits(world(), 'fateDie')[0]).toMatchObject({ worldKind: 'tool', id: 'roll' });
    expect(hits(world(), 'second person')[0]).toMatchObject({ worldKind: 'prompt', id: 'systemPrompt' });
    expect(hits(world(), 'three choices')[0]).toMatchObject({ worldKind: 'prompt', id: 'choices' });
  });

  it('reaches every dictionary entry by its text, switched off or not', () => {
    expect(hits(world(), 'oath smoke')[0]).toMatchObject({ worldKind: 'dictionary', id: 'pact' });
    expect(hits(world(), 'flood century')[0]).toMatchObject({ worldKind: 'dictionary', id: 'tide' });
  });

  it('lists every item once in the pick list, under its owner', () => {
    const owned = world({ entities: [{ ...mara, stats: [stat({ id: 'trust', name: 'Trust' })] }] });
    const { lines, sections } = buildWorldIndex(owned).pickList();
    expect(lines).toContain('Entity › Mara');
    expect(lines).toContain('Stat › Mara › Trust');
    expect(lines).toContain('Dictionary Entry › Lore › Ashen Pact');
    expect(sections).toHaveLength(lines.length);
  });

  it('shows a chip as its placeholder name, never a roll', () => {
    const token = encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p1' });
    const input = world({
      entities: [{ ...mara, playerDescription: `A widow from ${token}.` }],
      placeholders: [{ id: 'ph-town', name: 'Town', values: [{ id: 'v1', text: 'Ashford' }, { id: 'v2', text: 'Bryn' }] }],
    });
    const index = buildWorldIndex(input);
    const [top] = index.docs.search('widow', 1);
    expect(top.markdown).toContain('A widow from {Town}.');
    expect(top.markdown).not.toContain('Ashford');
  });

  it('states an item’s Value with its Currency, and a bare Value with none', () => {
    const item = (patch: Partial<Item>): Item => ({ id: 'draught', name: 'Healing Draught', value: 10, statEffects: [], traitEffects: [], equipRequires: [], ...patch });
    const section = (draught: Item) => buildWorldIndex(world({ items: [draught], currencies: [{ id: 'goats', name: 'Goats', backing: { kind: 'name' } }] })).docs.search('draught', 1)[0].markdown;
    expect(section(item({ currencyId: 'goats' }))).toContain('Value: 10 Goats');
    expect(section(item({}))).toMatch(/Value: 10(?! Goats)/);
    expect(section(item({ currencyId: 'gone' }))).toMatch(/Value: 10(?! Goats)/);
  });

  it('states an Items Currency’s Value as its Breakdown', () => {
    const moneyItem = (id: string, name: string): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [] });
    const draught: Item = { id: 'draught', name: 'Healing Draught', value: 105, currencyId: 'crowns', statEffects: [], traitEffects: [], equipRequires: [] };
    const currencies: Currency[] = [{ id: 'crowns', name: 'Crowns', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } }];
    const index = buildWorldIndex(world({ items: [draught, moneyItem('copper', 'Copper'), moneyItem('gold', 'Gold')], currencies }));
    expect(index.docs.search('draught', 1)[0].markdown).toContain('Value: 1 Gold, 5 Copper');
  });

  it('states an item’s Uses and When Empty, and names a Becomes target only when the world holds it', () => {
    const item = (id: string, name: string, patch: Partial<Item> = {}): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...patch });
    const section = (items: Item[]) => buildWorldIndex(world({ items })).docs.search('draught', 1)[0].markdown;
    const draught = item('draught', 'Healing Draught', { uses: 1, whenEmpty: { kind: 'becomes', itemId: 'bottle' } });
    expect(section([draught, item('bottle', 'Empty Bottle')])).toContain('Uses: 1 · When Empty: Becomes Empty Bottle');
    expect(section([draught])).toContain('When Empty: Becomes another item');
    expect(section([item('draught', 'Healing Draught')])).not.toContain('Uses');
  });

  it('states an item’s starting State and a Changes State word', () => {
    const item = (patch: Partial<Item>): Item => ({ id: 'draught', name: 'Healing Draught', statEffects: [], traitEffects: [], equipRequires: [], ...patch });
    const section = (one: Item) => buildWorldIndex(world({ items: [one] })).docs.search('draught', 1)[0].markdown;
    expect(section(item({ uses: 1, whenEmpty: { kind: 'changesState', state: 'drained' }, state: ' sealed ' })))
      .toContain('Uses: 1 · When Empty: Changes State to drained · State: sealed');
    expect(section(item({ state: '  ' }))).not.toContain('State');
  });

  it('lists an item’s Unidentified Name and Unidentified Description for the author', () => {
    const ring: Item = { id: 'ring', name: 'Ring of Curses', unidentifiedName: 'Plain Ring', unidentifiedDescription: 'A dull band.', statEffects: [], traitEffects: [], equipRequires: [] };
    const [top] = buildWorldIndex(world({ items: [ring] })).docs.search('curses', 1);
    expect(top.markdown).toContain('**Unidentified Name:** Plain Ring');
    expect(top.markdown).toContain('**Unidentified Description:** A dull band.');
  });

  it('maps every part of a long item back to it', () => {
    const long = world({ entities: [{ ...mara, playerDescription: Array.from({ length: 400 }, (_, at) => `Sentence ${at} about the gate.`).join('\n\n') }] });
    const index = buildWorldIndex(long);
    const parts = index.docs.get([index.docs.contents().find((page) => page.page.startsWith('world-entity-'))!.sections[0].id]);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => index.sourceOf(part)?.id === 'mara')).toBe(true);
  });

  it('reuses the index while no slice changed, and rebuilds when one did', () => {
    const input = world();
    const first = worldIndexOf(input);
    expect(worldIndexOf({ ...input })).toBe(first);
    const edited = { ...input, entities: [{ ...mara, playerDescription: 'A smith by the river.' }] };
    expect(worldIndexOf(edited)).not.toBe(first);
    expect(hits(edited, 'smith river')[0]).toMatchObject({ id: 'mara' });
  });
});

/** The bar a rebuild stays under on the largest bundled world. */
const REBUILD_BAR_MS = 50;

describe('a rebuild on the bundled worlds', () => {
  const worlds = Object.entries(import.meta.glob<{ default: unknown }>('@/defaultworlds/*.json', { eager: true }))
    .map(([path, file]) => ({ path, world: migrateWorld(file.default) as World }));

  it(`stays under ${REBUILD_BAR_MS} ms on the largest`, () => {
    const size = (input: World) => JSON.stringify(input).length;
    const largest = worlds.reduce((best, next) => (size(next.world) > size(best.world) ? next : best));
    buildWorldIndex(largest.world);
    const runs = Array.from({ length: 5 }, () => {
      const start = performance.now();
      buildWorldIndex(largest.world).docs.search('who guards the gate', 5);
      return performance.now() - start;
    });
    const median = runs.sort((a, b) => a - b)[2];
    console.info(`World Index rebuild on ${largest.path} (${size(largest.world)} chars): median ${median.toFixed(1)} ms`);
    expect(median).toBeLessThan(REBUILD_BAR_MS);
  });
});

describe('chipsFromText', () => {
  const town = { id: 'ph-town', name: 'Town', values: [{ id: 'v1', text: 'Ashford' }, { id: 'v2', text: 'Bryn' }] };
  const read = (text: string, patch: Partial<WorldIndexInput> = {}) => chipsFromText(world({ placeholders: [town], ...patch }))(text);

  it('turns a chip the World Index showed back into that placeholder, with a placement of its own', () => {
    const authored = `Born in ${encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p1' })}.`;
    const shown = worldTextOf(world({ placeholders: [town] }))(authored);

    const drafted = read(shown);

    const [, token] = drafted.match(/^Born in (\{\{ph:[^}]+\}\})\.$/)!;
    expect(decodePlaceholderToken(token)).toMatchObject({ id: 'ph-town', mode: 'world' });
    expect(decodePlaceholderToken(token)!.placementId).not.toBe('p1');
    expect(worldTextOf(world({ placeholders: [town] }))(drafted)).toBe(shown);
  });

  it('matches the name in any case, and turns Built-in labels into their tokens', () => {
    expect(read('{town} greets {Persona Name}.')).toMatch(/^\{\{ph:ph-town:world:[^}]+\}\} greets \{\{user\}\}\.$/);
  });

  it('leaves braces that name nothing, or more than one placeholder, as written', () => {
    const twin = { ...town, id: 'ph-town-2' };
    expect(read('{Harbor} and {Town}', { placeholders: [town, twin] })).toBe('{Harbor} and {Town}');
  });

  it('leaves a stored token alone', () => {
    expect(read('{{user}} and {{Town}}', { placeholders: [{ ...town, name: 'user' }] })).toBe('{{user}} and {{Town}}');
  });
});

describe('routines and Connections in the World Index', () => {
  const place = (id: string, name: string) => ({ id, name, playerDescription: `${name} text.` });
  const warden: Entity = {
    id: 'warden', name: 'Warden', kind: 'unique', traversable: ['loc-mill'],
    starts: [
      { id: 's1', place: 'loc-gate', weight: 3, schedule: [
        { id: 'r1', time: { start: 1200, end: 240 }, strict: true, action: { kind: 'patrol', stops: [{ place: 'loc-gate', idle: 60 }, { place: 'loc-mill', idle: 60 }] } },
        { id: 'r2', time: 'allDay', action: { kind: 'stay', place: 'loc-gate' } },
      ] },
      { id: 's2', place: PLAYER_START, weight: 1, beginsFollowing: true, schedule: [] },
    ],
  };
  const crowd: Entity = { id: 'crowd', name: 'Crowd', kind: 'generic', starts: [{ id: 'g1', place: 'loc-mill', weight: 1, schedule: [] }] };
  const input = world({
    locations: [place('loc-gate', 'North Gate'), place('loc-mill', 'Old Mill'), place('loc-quay', 'Quay'), place('loc-vault', 'Vault')],
    entities: [warden, crowd],
    connections: [
      { id: 'c1', a: 'loc-gate', b: 'loc-mill', aToB: {}, bToA: {} },
      { id: 'c2', a: 'loc-gate', b: 'loc-quay', aToB: { hint: 'by ferry' } },
      { id: 'c3', a: 'loc-vault', b: 'loc-gate', distance: 'far', aToB: {}, bToA: {} },
    ],
  });
  const page = (kind: 'entity' | 'location', id: string) =>
    buildWorldIndex(input).sectionsOf({ kind: 'world', worldKind: kind, id, name: id }).map((s) => s.markdown).join('\n');

  it('states a Unique entity’s kind, Starts with chance, rows and Can Also Go', () => {
    const md = page('entity', 'warden');
    expect(md).toContain('Unique');
    expect(md).toContain('- North Gate, 75% chance');
    expect(md).toContain("- Player's Starting Location, 25% chance, Follows the Player");
    expect(md).toContain('patrols North Gate, Old Mill (Locked)');
    expect(md).toContain('The rest of the day: stays at North Gate');
    expect(md).toContain('**Can Also Go:** Only Old Mill');
  });

  it('leaves out the derived Locations field for an entity with a kind, and keeps it for one without', () => {
    const pageOf = (entities: Entity[], id: string) => buildWorldIndex({ ...input, entities })
      .sectionsOf({ kind: 'world', worldKind: 'entity', id, name: id }).map((s) => s.markdown).join('\n');
    const kindless: Entity = { id: 'old', name: 'Old', locations: ['loc-quay'] };
    const cast = [withDerivedLocations(warden), withDerivedLocations(crowd), kindless];
    expect(cast[0].locations).toEqual(['loc-gate', 'loc-mill']);
    expect(pageOf(cast, 'warden')).not.toContain('**Locations:**');
    expect(pageOf(cast, 'crowd')).not.toContain('**Locations:**');
    expect(pageOf(cast, 'old')).toContain('**Locations:** Quay');
  });

  it('states Can Also Go for a Unique entity with no field as the Routine tab shows it: an empty list', () => {
    const { traversable: _, ...unset } = warden;
    expect(page('entity', 'warden')).toContain('**Can Also Go:** Only Old Mill');
    const md = buildWorldIndex({ ...input, entities: [unset, crowd] })
      .sectionsOf({ kind: 'world', worldKind: 'entity', id: 'warden', name: 'Warden' }).map((s) => s.markdown).join('\n');
    expect(md).toContain('**Can Also Go:** Only Listed Locations, none added');
  });

  it('states each Start of a Generic entity without chance or Can Also Go', () => {
    const md = page('entity', 'crowd');
    expect(md).toContain('Generic');
    expect(md).toContain('- Old Mill');
    expect(md).not.toMatch(/chance|Can Also Go/);
  });

  it('states Travel, Distance and hints for each Connection of a location', () => {
    const md = page('location', 'loc-gate');
    expect(md).toContain('- Old Mill: Travel Both Ways, Distance Nearby');
    expect(md).toContain('- Quay: Travel To There, Distance Nearby');
    expect(md).toContain('Travel Hint to Quay: by ferry');
    expect(md).toContain('- Vault: Travel Both Ways, Distance Far');
    expect(page('location', 'loc-quay')).toContain('- North Gate: Travel To Here');
  });

  it('lists who can be at a location with the Presence tab’s reasons', () => {
    // Warden's Player's Starting Location Start stands for every location, as none is flagged.
    expect(page('location', 'loc-mill')).toContain('- Warden: begins here; patrols here (20:00 – 04:00); can be led here');
    expect(page('location', 'loc-gate')).toContain('- Warden: begins here (75%)');
  });

  it('shows no location id, token or field name', () => {
    const all = [page('entity', 'warden'), page('entity', 'crowd'), page('location', 'loc-gate'), page('location', 'loc-mill')].join('\n');
    expect(all).not.toMatch(/loc-|@playerStart|\{\{|beginsFollowing|traversable|aToB|bToA/);
  });

  it('keeps the in-game view free of routines', () => {
    const cut = playerViewWorld(
      { stats: [], statGroups: [], traits: [], traitGroups: [], entities: [warden], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [], locations: input.locations ?? [] },
      { view: buildPlayerView({ world: { entities: [warden], locations: input.locations ?? [], traits: [] }, chain: [{ metEntities: ['warden'], locationId: 'loc-gate', visibleEntities: [], globalStats: [], globalTraits: [], disabledTraitIds: [], itemCopies: [] } as unknown as GameState], history: [], persona: null, resolve: (t) => t }), current: { metEntities: ['warden'], locationId: 'loc-gate', visibleEntities: [], globalStats: [], globalTraits: [], disabledTraitIds: [], itemCopies: [] } as unknown as GameState },
    );
    const md = buildWorldIndex({ ...input, entities: cut.entities, locations: cut.locations ?? [] }).sectionsOf({ kind: 'world', worldKind: 'entity', id: 'warden', name: 'Warden' }).map((s) => s.markdown).join('\n');
    expect(md).not.toMatch(/Starts|Unique|Can Also Go|patrols|chance/);
    expect(cut.entities[0]).not.toHaveProperty('starts');
    expect(cut.entities[0]).not.toHaveProperty('kind');
    expect(cut.entities[0]).not.toHaveProperty('traversable');
  });
});
