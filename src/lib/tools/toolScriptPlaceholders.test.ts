/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { encodePlaceholderToken, resolveEntityText, resolvePlaceholders } from '@/lib/placeholders';
import type { Placeholder, PlaceholderRolls, Tool, ToolHandler, WorldOverview } from '@/types';
import { buildToolSnapshot, sampleToolSnapshot, type ToolSnapshot } from './toolSnapshot';
import { runToolCall } from './toolRunner';

const ph = (id: string, name: string, texts: string[], over: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: texts.map((text, i) => ({ id: `${id}-v${i}`, text })), ...over });
const chip = (id: string, placementId = `at-${id}`) => encodePlaceholderToken({ id, mode: 'world', placementId });

const overview = { name: 'Test', systemPrompt: '' } as WorldOverview;

// Weather is a Wildcard with a frozen roll; Sky holds a Weather chip; Mood is pinned; Eyes sits on Ada, Ink on the book.
const SHARED: Placeholder[] = [
  ph('weather', 'Weather', ['rain', 'fog', 'snow']),
  ph('sky', 'Sky', [`a sky of ${chip('weather')}`]),
  ph('mood', 'Mood', ['calm', 'grim']),
  ph('weather-2', 'Weather', ['hail']),
  ph('sky-part', 'Sky Part', ['clouds'], { ownerId: 'sky' }),
];

function world(): AuthoredWorld {
  return {
    worldOverview: overview, stats: [], locations: [], traits: [],
    entities: [{
      id: 'ada', name: 'Ada', aliases: [],
      placeholders: [ph('eyes', 'Eyes', ['green']), ph('eyes-owner', 'Owner', ['{{char}}'])],
    }],
    dictionaries: [{
      id: 'book', name: 'Lore', placeholders: [ph('ink', 'Ink', ['blue'])],
      entries: [{ id: 'e1', name: 'Pens', key: ['pen'], value: 'Pens.' }, { id: 'e2', name: 'Paper', key: [], value: 'Paper.' }],
    }],
    placeholders: SHARED,
  };
}

const ROLLS: PlaceholderRolls = { world: { weather: 'fog', mood: 'calm' } };
const PINS = { mood: 'grim' };

/** The world as play reads it: frozen rolls and pins in force, entity text under its owner. */
function snapshotOf(w: AuthoredWorld = world()): ToolSnapshot {
  const placeholders = allPlaceholders(w);
  const opts = { placeholders, rolls: ROLLS, pins: PINS };
  const scene = authoredChipScene(w, {
    resolve: (text) => resolvePlaceholders(text, opts),
    resolveEntity: (entity, text) => resolveEntityText(entity, text, opts),
  });
  return buildToolSnapshot(scene, w.dictionaries ?? []);
}

const tool = (handler: ToolHandler): Tool => ({
  id: 't', name: 't', description: '', params: [], handler, emptyResult: 'NOTHING', offeredTo: ['narration'],
});
const script = (code: string) => tool({ kind: 'script', code });
const run = async (code: string, s = snapshotOf()) => (await runToolCall(script(code), '{}', s)).text;

describe('a Tool script reads resolved placeholders', () => {
  // The executor logs a script's console output to the host console; keep test output clean.
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads a shared placeholder by name, as this playthrough rolled it', async () => {
    expect(await run('return placeholders.Weather;')).toBe('fog');
  });

  it('reads a pinned value, not the roll underneath', async () => {
    expect(await run('return placeholders.Mood;')).toBe('grim');
  });

  it('reads a placeholder that holds another chip fully resolved', async () => {
    expect(await run('return placeholders.Sky;')).toBe('a sky of fog');
  });

  it('reads an entity’s placeholder from its item, under that entity as owner', async () => {
    expect(await run('return world.entities[0].placeholders;')).toBe(JSON.stringify({ Eyes: 'green', Owner: 'Ada' }));
    expect(await run('return "Eyes" in placeholders;')).toBe('false');
  });

  it('reads a book’s placeholder from each of its entries', async () => {
    expect(await run('return world.dictionary.map((e) => e.placeholders.Ink);')).toBe('["blue","blue"]');
    expect(await run('return "Ink" in placeholders;')).toBe('false');
  });

  it('gives a repeated name the first placeholder’s value', async () => {
    expect(await run('return placeholders.Weather;')).toBe('fog');
  });

  it('leaves out a placeholder another placeholder owns', async () => {
    expect(await run('return Object.keys(placeholders);')).toBe('["Weather","Sky","Mood"]');
  });

  it('gives an empty map in a world with none', async () => {
    const bare: AuthoredWorld = { ...world(), placeholders: [], entities: [], dictionaries: [] };
    expect(await run('return placeholders;', snapshotOf(bare))).toBe('{}');
  });

  it('keeps the values when a script writes to them', async () => {
    const code = 'try { placeholders.Weather = "sun"; placeholders.Extra = "x"; } catch (e) {} return placeholders;';
    expect(JSON.parse((await run(code))!)).toEqual({ Weather: 'fog', Sky: 'a sky of fog', Mood: 'grim' });
  });

  it('reads the same value a Template chip renders for the same placeholder', async () => {
    const s = snapshotOf();
    for (const [id, name] of [['weather', 'Weather'], ['sky', 'Sky'], ['mood', 'Mood']]) {
      const template = await runToolCall(tool({ kind: 'template', body: chip(id, 'template-placement') }), '{}', s);
      expect(await run(`return placeholders[${JSON.stringify(name)}];`, s)).toBe(template.text);
    }
  });
});

describe('the sample snapshot', () => {
  it('carries sample placeholders, shared and on an item', () => {
    const sample = sampleToolSnapshot();
    expect(Object.keys(sample.placeholders).length).toBeGreaterThan(0);
    expect(sample.world.entities.some((e) => Object.keys(e.placeholders).length)).toBe(true);
    expect(sample.world.dictionary.some((e) => Object.keys(e.placeholders).length)).toBe(true);
  });
});
