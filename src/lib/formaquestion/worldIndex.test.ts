import { describe, expect, it } from 'vitest';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { migrateWorld } from '@/lib/version';
import type { Dictionary, Entity, Stat, Tool, World } from '@/types';
import { buildWorldIndex, worldIndexOf, type WorldIndexInput } from './worldIndex';

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
