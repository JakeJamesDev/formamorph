/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { encodePlaceholderToken, resolveEntityText, resolvePlaceholders } from '@/lib/placeholders';
import { openingStateOf } from '@/lib/openingState';
import type { Placeholder, PlaceholderRolls, Tool, ToolHandler, WorldOverview } from '@/types';
import { buildToolSnapshot, type ToolSnapshot } from './toolSnapshot';
import { sampleToolSnapshot } from './sampleToolSnapshot';
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
];

function world(): AuthoredWorld {
  return {
    worldOverview: overview, stats: [], locations: [], traits: [],
    entities: [{
      id: 'ada', name: 'Ada', aliases: [],
      placeholders: [ph('eyes', 'Eyes', ['green'])],
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

/** The world as play reads it: frozen rolls and pins in force, in the scene a Template reads and the state a script reads. */
function snapshotOf(w: AuthoredWorld = world()): ToolSnapshot {
  const placeholders = allPlaceholders(w);
  const opts = { placeholders, rolls: ROLLS, pins: PINS };
  const scene = authoredChipScene(w, {
    resolve: (text) => resolvePlaceholders(text, opts),
    resolveEntity: (entity, text) => resolveEntityText(entity, text, opts),
  });
  const opening = openingStateOf(w);
  const state = { ...opening, placeholders: { ...opening.placeholders!, rolls: ROLLS, pins: PINS } };
  return buildToolSnapshot(scene, w.dictionaries ?? [], null, { state, authored: null });
}

const tool = (handler: ToolHandler): Tool => ({
  id: 't', name: 't', description: '', params: [], handler, emptyResult: 'NOTHING', offeredTo: ['narration'],
});
const script = (code: string) => tool({ kind: 'script', code });
const run = async (code: string, s = snapshotOf()) => (await runToolCall(script(code), '{}', s)).text;

describe('a Tool script reads placeholder entries', () => {
  // The executor logs a script's console output to the host console; keep test output clean.
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads a shared placeholder by name, as this playthrough rolled it', async () => {
    expect(await run('return placeholders.Weather.text;')).toBe('fog');
  });

  it('reads a pinned value, not the roll underneath', async () => {
    expect(await run('return placeholders.Mood.text;')).toBe('grim');
  });

  it('reads a placeholder that holds another chip fully resolved', async () => {
    expect(await run('return placeholders.Sky.text;')).toBe('a sky of fog');
  });

  // An entry's text reads as a Script reads it; the old surface's per-owner resolved text is gone (spec: Migrations).
  it('reads an entity’s placeholder from its entry', async () => {
    expect(await run('return entities.Ada.placeholders.Eyes.text;')).toBe('green');
    expect(await run('return "Eyes" in placeholders;')).toBe('false');
  });

  it('reads a book’s placeholder from its dictionary entry', async () => {
    expect(await run('return dictionaries.Lore.placeholders.Ink.text;')).toBe('blue');
    expect(await run('return "Ink" in placeholders;')).toBe('false');
  });

  it('gives no keys in a world with none', async () => {
    const bare: AuthoredWorld = { ...world(), placeholders: [], entities: [], dictionaries: [] };
    expect(await run('return Object.keys(placeholders);', snapshotOf(bare))).toBe('[]');
  });

  it('keeps the value when a script writes to it, and has no pin', async () => {
    const result = await runToolCall(script('placeholders.Weather.value = "sun"; return [placeholders.Weather.text, typeof placeholders.Weather.pin];'), '{}', snapshotOf());
    expect(result.text).toBe('["fog","undefined"]');
    expect(result.warnings).toEqual(['Read-only fields. Writes ignored: placeholders.Weather.value.']);
  });

  it('reads the same text a Template chip renders for the same placeholder', async () => {
    const s = snapshotOf();
    for (const [id, name] of [['weather', 'Weather'], ['sky', 'Sky'], ['mood', 'Mood']]) {
      const template = await runToolCall(tool({ kind: 'template', body: chip(id, 'template-placement') }), '{}', s);
      expect(await run(`return placeholders[${JSON.stringify(name)}].text;`, s)).toBe(template.text);
    }
  });
});

describe('the sample snapshot', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('carries sample placeholders, shared and on an entity and a book', async () => {
    const code = `return [Object.keys(placeholders).length, Object.values(entities).some((e) => Object.keys(e.placeholders).length),
      Object.values(dictionaries).some((d) => Object.keys(d.placeholders).length)];`;
    const [shared, onEntity, onBook] = JSON.parse(await run(code, sampleToolSnapshot())) as [number, boolean, boolean];
    expect(shared).toBeGreaterThan(0);
    expect(onEntity).toBe(true);
    expect(onBook).toBe(true);
  });
});
