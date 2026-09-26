/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import rawWorld from '../../../testing/baseline/sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { TOOL_CATALOG } from './toolCatalog';
import { buildToolSnapshot, type ToolSnapshot } from './toolSnapshot';
import { runToolCall } from './toolRunner';
import { argChipToken } from './argChips';
import type { Tool, ToolHandler, ToolParam } from '@/types';

// Nicknames the Sedge fixture doesn't author; "ferry-folk" is shared so a lookup can be ambiguous.
const ALIASES: Record<string, string[]> = {
  'ent-bram': ['Ferryman', 'ferry-folk'],
  'ent-wick': ["Ferryman's sister", 'Ferry-Folk'],
  'ent-tomas': ['Watchman'],
};

function sedge(): AuthoredWorld {
  const world: AuthoredWorld = migrateWorld(structuredClone(rawWorld));
  world.entities = world.entities.map((e) => (ALIASES[e.id] ? { ...e, aliases: ALIASES[e.id] } : e));
  return world;
}

function snapshot(world = sedge()): ToolSnapshot {
  return buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? []);
}

const param = (name: string, over: Partial<ToolParam> = {}): ToolParam =>
  ({ name, type: 'string', description: '', required: true, options: [], ...over });

const tool = (handler: ToolHandler, params: ToolParam[] = [param('name')], emptyResult = 'NOTHING'): Tool => ({
  id: 't', name: 't', description: '', params, handler, emptyResult, offeredTo: ['narration'],
});

const GET_ENTITY = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;
const entity = (id: string) => sedge().entities.find((e) => e.id === id)!;
const matches = (text: string) => (JSON.parse(text) as { matches: { id: string; name: string; description?: string }[] }).matches;
const errorOf = (text: string) => (JSON.parse(text) as { error: string }).error;

describe('runToolCall: arguments', () => {
  const s = snapshot();
  const typed = tool({ kind: 'template', body: 'ran' }, [
    param('count', { type: 'number' }),
    param('loud', { type: 'boolean' }),
    param('mood', { type: 'enum', options: ['calm', 'wary'] }),
    param('note', { required: false }),
  ]);
  const good = { count: 2, loud: true, mood: 'calm' };

  it('runs the handler when every argument matches its parameter', async () => {
    expect(await runToolCall(typed, JSON.stringify(good), s)).toEqual({ text: 'ran' });
  });

  it('refuses a missing required parameter by name, before the handler runs', async () => {
    const result = await runToolCall(GET_ENTITY, '{}', s);
    expect(result.failure).toBe('arguments');
    expect(errorOf(result.text)).toContain('"name"');
  });

  it('treats null as missing', async () => {
    expect(await runToolCall(typed, JSON.stringify({ ...good, note: null }), s)).toEqual({ text: 'ran' });
    const result = await runToolCall(GET_ENTITY, '{"name": null}', s);
    expect(result.failure).toBe('arguments');
    expect(errorOf(result.text)).toContain('Missing required parameter "name"');
  });

  it.each([
    ['a number given as text', { ...good, count: '2' }, '"count"'],
    ['a yes/no given as text', { ...good, loud: 'true' }, '"loud"'],
    ['text given as a number', { ...good, note: 5 }, '"note"'],
    ['a value outside the options', { ...good, mood: 'Calm' }, '"mood"'],
    ['an argument no parameter declares', { ...good, extra: 1 }, '"extra"'],
  ])('refuses %s, naming the parameter', async (_, args, name) => {
    const result = await runToolCall(typed, JSON.stringify(args), s);
    expect(result.failure).toBe('arguments');
    expect(errorOf(result.text)).toContain(name);
  });

  it('refuses a number JSON reads as infinite', async () => {
    const result = await runToolCall(typed, '{"count": 1e999, "loud": true, "mood": "calm"}', s);
    expect(result.failure).toBe('arguments');
    expect(errorOf(result.text)).toContain('"count"');
  });

  it('lists the allowed options when an option is wrong', async () => {
    const result = await runToolCall(typed, JSON.stringify({ ...good, mood: 'angry' }), s);
    expect(errorOf(result.text)).toContain('calm, wary');
  });

  it.each([
    ['text that is not JSON', '{name: Bram}'],
    ['a JSON list', '["Bram"]'],
    ['a JSON string', '"Bram"'],
  ])('refuses %s as the argument string', async (_, raw) => {
    const result = await runToolCall(GET_ENTITY, raw, s);
    expect(result.failure).toBe('arguments');
    expect(errorOf(result.text)).toMatch(/JSON object/);
  });

  it('keeps a parameter named __proto__ as a plain argument', async () => {
    const t = tool({ kind: 'script', code: 'return Object.keys(args).join(",") + ":" + args.__proto__;' }, [param('__proto__')]);
    expect(await runToolCall(t, '{"__proto__": "kept"}', s)).toEqual({ text: '__proto__:kept' });
  });

  it('reads an empty argument string as no arguments', async () => {
    const noParams = tool({ kind: 'template', body: 'ran' }, []);
    expect(await runToolCall(noParams, '', s)).toEqual({ text: 'ran' });
    expect(await runToolCall(noParams, '  ', s)).toEqual({ text: 'ran' });
  });
});

describe('runToolCall: Lookup', () => {
  const s = snapshot();

  it('finds an entity by name without regard to case, with its full description', async () => {
    const result = await runToolCall(GET_ENTITY, '{"name": "bRAM"}', s);
    expect(result.failure).toBeUndefined();
    expect(matches(result.text)).toEqual([
      { id: 'ent-bram', name: 'Bram', description: entity('ent-bram').aiDescription },
    ]);
  });

  it('finds an entity by an alias without regard to case', async () => {
    const result = await runToolCall(GET_ENTITY, '{"name": "WATCHMAN"}', s);
    expect(matches(result.text).map((m) => m.id)).toEqual(['ent-tomas']);
  });

  it('ignores the whitespace around the name', async () => {
    const result = await runToolCall(GET_ENTITY, '{"name": "  Odette "}', s);
    expect(matches(result.text).map((m) => m.id)).toEqual(['ent-odette']);
  });

  it('returns every match for an ambiguous name', async () => {
    const result = await runToolCall(GET_ENTITY, '{"name": "ferry-folk"}', s);
    expect(matches(result.text).map((m) => m.id)).toEqual(['ent-bram', 'ent-wick']);
  });

  it("returns the Tool's empty result when nothing matches", async () => {
    expect(await runToolCall(GET_ENTITY, '{"name": "Sixpence"}', s)).toEqual({ text: GET_ENTITY.emptyResult });
  });

  it('matches whole names, not parts of one', async () => {
    expect(await runToolCall(GET_ENTITY, '{"name": "Ferry"}', s)).toEqual({ text: GET_ENTITY.emptyResult });
  });

  it('returns the summary when the handler asks for it', async () => {
    const summary = tool({ kind: 'lookup', source: 'entities', param: 'name', returns: 'summary' });
    const result = await runToolCall(summary, '{"name": "Wick"}', s);
    expect(matches(result.text)).toEqual([{ id: 'ent-wick', name: 'Wick', description: entity('ent-wick').aiSummary }]);
  });

  it('leaves the description out when the author wrote none', async () => {
    const world = sedge();
    world.entities = world.entities.map((e) => (e.id === 'ent-bram' ? { ...e, aiDescription: '' } : e));
    const result = await runToolCall(GET_ENTITY, '{"name": "Bram"}', snapshot(world));
    expect(matches(result.text)).toEqual([{ id: 'ent-bram', name: 'Bram' }]);
  });

  it('finds a location by name without regard to case', async () => {
    const places = tool({ kind: 'lookup', source: 'locations', param: 'name', returns: 'summary' });
    const result = await runToolCall(places, '{"name": "far bank"}', s);
    expect(matches(result.text)).toEqual([{
      id: 'loc-farbank', name: 'Far Bank',
      description: 'The south bank: a half-sunk mill wheel and a watchman\'s canvas shelter.',
    }]);
  });

  it('finds a dictionary entry by any of its keys without regard to case', async () => {
    const lore = tool({ kind: 'lookup', source: 'dictionary', param: 'term', returns: 'full' }, [param('term')]);
    const result = await runToolCall(lore, '{"term": "GLOAM"}', s);
    const [match] = matches(result.text);
    expect(match.id).toBe('dict-gloamwater');
    expect(match.description).toMatch(/^Gloamwater: a stretch of river/);
  });

  it('skips a disabled dictionary entry', async () => {
    const world = sedge();
    world.dictionaries = world.dictionaries!.map((book) => ({
      ...book, entries: book.entries.map((e) => (e.id === 'dict-gloamwater' ? { ...e, enabled: false } : e)),
    }));
    const lore = tool({ kind: 'lookup', source: 'dictionary', param: 'term', returns: 'full' }, [param('term')]);
    expect(await runToolCall(lore, '{"term": "gloam"}', snapshot(world))).toEqual({ text: 'NOTHING' });
  });

  it('returns an error result when the handler reads a parameter the Tool lacks', async () => {
    const broken = tool({ kind: 'lookup', source: 'entities', param: 'who', returns: 'full' });
    const result = await runToolCall(broken, '{"name": "Bram"}', s);
    expect(result.failure).toBe('handler');
    expect(errorOf(result.text)).toContain('"who"');
  });
});

describe('runToolCall: Template', () => {
  const s = snapshot();
  const params = [param('name'), param('topic', { required: false })];

  it('binds each parameter as a chip value', async () => {
    const t = tool({ kind: 'template', body: `Ask ${argChipToken('name')} about ${argChipToken('topic')}.` }, params);
    expect(await runToolCall(t, '{"name": "Bram", "topic": "the dark"}', s)).toEqual({ text: 'Ask Bram about the dark.' });
  });

  it('renders an absent optional parameter as nothing', async () => {
    const t = tool({ kind: 'template', body: `[${argChipToken('topic')}]` }, params);
    expect(await runToolCall(t, '{"name": "Bram"}', s)).toEqual({ text: '[]' });
  });

  it('spells numbers and yes/no values as text', async () => {
    const t = tool({ kind: 'template', body: `${argChipToken('n')} ${argChipToken('b')}` },
      [param('n', { type: 'number' }), param('b', { type: 'boolean' })]);
    expect(await runToolCall(t, '{"n": 2.5, "b": false}', s)).toEqual({ text: '2.5 false' });
  });

  it('renders scene chips from the snapshot', async () => {
    const t = tool({ kind: 'template', body: 'World: <WORLD DESCRIPTION>' }, []);
    const { text } = await runToolCall(t, '{}', s);
    expect(text).toBe(`World: ${sedge().worldOverview.systemPrompt}`);
  });

  it('keeps a chip-shaped argument as the literal text the model sent', async () => {
    const t = tool({ kind: 'template', body: argChipToken('name') }, params);
    const sent = '{{user}} <WORLD DESCRIPTION> {{arg:topic}}';
    expect(await runToolCall(t, JSON.stringify({ name: sent, topic: 'x' }), s)).toEqual({ text: sent });
  });

  it('returns an error result instead of throwing when a handler fails', async () => {
    const failing: ToolSnapshot = { ...s, resolve: () => { throw new Error('the roll table is gone'); } };
    const t = tool({ kind: 'template', body: 'Hello, {{user}}.' }, []);
    const result = await runToolCall(t, '{}', failing);
    expect(result.failure).toBe('handler');
    expect(errorOf(result.text)).toContain('the roll table is gone');
  });

  it("returns the Tool's empty result when the body renders blank", async () => {
    const t = tool({ kind: 'template', body: ` ${argChipToken('topic')} ` }, params);
    expect(await runToolCall(t, '{"name": "Bram"}', s)).toEqual({ text: 'NOTHING' });
  });
});

describe('runToolCall: Script', () => {
  // The executor logs a script's console output to the host console; keep test output clean.
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());
  const s = snapshot();
  const script = (code: string, params: ToolParam[] = [param('name')]) => tool({ kind: 'script', code }, params);

  it('reads args and returns text as it is', async () => {
    expect(await runToolCall(script('return "Hello, " + args.name;'), '{"name": "Wick"}', s)).toEqual({ text: 'Hello, Wick' });
  });

  it('returns any other value as JSON', async () => {
    const result = await runToolCall(script('return { who: args.name, n: [1, 2] };'), '{"name": "Wick"}', s);
    expect(JSON.parse(result.text)).toEqual({ who: 'Wick', n: [1, 2] });
  });

  it("returns the Tool's empty result for nothing", async () => {
    expect(await runToolCall(script('const x = 1;', []), '{}', s)).toEqual({ text: 'NOTHING' });
    expect(await runToolCall(script('return null;', []), '{}', s)).toEqual({ text: 'NOTHING' });
    expect(await runToolCall(script('return "  ";', []), '{}', s)).toEqual({ text: 'NOTHING' });
  });

  it('returns JSON even when the script replaces JSON.stringify', async () => {
    const code = 'JSON.stringify = () => "forged"; return { a: 1 };';
    expect(await runToolCall(script(code, []), '{}', s)).toEqual({ text: '{"a":1}' });
  });

  it('shows the script only its own globals', async () => {
    const code = `return Object.getOwnPropertyNames(globalThis).filter((n) => n.startsWith('__')).join(',')
      + '|' + typeof __formamorphFinish;`;
    expect(await runToolCall(script(code, []), '{}', s)).toEqual({ text: '|undefined' });
  });

  it('reads the world and the current scene', async () => {
    const code = `
      const bram = world.entities.find((e) => e.name === 'Bram');
      const lore = world.dictionary.find((d) => d.keys.includes('gloam'));
      return {
        description: bram.description, aliases: bram.aliases, place: scene.location.name,
        present: scene.present, vigor: scene.stats.Vigor, traits: scene.traits, lore: lore.id,
      };`;
    const result = JSON.parse((await runToolCall(script(code, []), '{}', s)).text);
    expect(result).toEqual({
      description: entity('ent-bram').aiDescription, aliases: ['Ferryman', 'ferry-folk'], place: 'Sedge Landing',
      present: ['Bram', 'Odette', 'Rope Ferry'], vigor: 23, traits: ['Wren the Mapmaker', 'Footsore'],
      lore: 'dict-gloamwater',
    });
  });

  it('cannot change the snapshot it reads', async () => {
    const code = `
      const attempt = (write) => { try { write(); } catch { /* a frozen value refuses some writes loudly */ } };
      attempt(() => { world.entities[0].name = 'Changed'; });
      attempt(() => world.entities.push({ name: 'Intruder' }));
      attempt(() => { scene.stats.Vigor = 0; });
      attempt(() => { args.name = 'Changed'; });
      return [world.entities[0].name, world.entities.length, scene.stats.Vigor, args.name];`;
    const result = await runToolCall(script(code), '{"name": "Wick"}', s);
    expect(JSON.parse(result.text)).toEqual(['Bram', 5, 23, 'Wick']);
    expect(s.world.entities[0].name).toBe('Bram');
    expect(s.world.entities).toHaveLength(5);
    expect(s.scene.stats.Vigor).toBe(23);
  });

  it('reaches no stat-code globals', async () => {
    const code = 'return [typeof stats, typeof self, typeof placeholders, typeof traits].join(",");';
    expect(await runToolCall(script(code, []), '{}', s)).toEqual({ text: 'undefined,undefined,undefined,undefined' });
  });

  it('returns a thrown error as a readable result', async () => {
    const result = await runToolCall(script('throw new Error("no ferry after dark");', []), '{}', s);
    expect(result.failure).toBe('script');
    expect(errorOf(result.text)).toContain('no ferry after dark');
  });

  it('returns a value JSON cannot hold as a readable result', async () => {
    const result = await runToolCall(script('return () => 1;', []), '{}', s);
    expect(result.failure).toBe('script');
    expect(errorOf(result.text)).toMatch(/JSON/);
  });

  it('reports a thrown "interrupted" error as a script error, not a timeout', async () => {
    const result = await runToolCall(script('throw new Error("interrupted");', []), '{}', s);
    expect(result.failure).toBe('script');
  });

  it('stops a script that runs too long', async () => {
    const result = await runToolCall(script('while (true) {}', []), '{}', s);
    expect(result.failure).toBe('timeout');
    expect(errorOf(result.text)).toMatch(/too long/);
  });
});
