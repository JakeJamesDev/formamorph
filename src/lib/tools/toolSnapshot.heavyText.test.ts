/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Placeholder, Tool, WorldOverview } from '@/types';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { openingStateOf } from '@/lib/openingState';
import { hostCalls } from '@/test/hostCalls';
import { phValues } from '@/test/placeholderValues';
import { runToolCall } from './toolRunner';
import { sampleToolSnapshot } from './sampleToolSnapshot';
import { buildToolSnapshot, type ToolSnapshot } from './toolSnapshot';

vi.mock('@/lib/scriptSandbox', async (importOriginal) =>
  (await import('@/test/hostCalls')).countingSandbox(await importOriginal<typeof import('@/lib/scriptSandbox')>()));

const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['copper']) };
const chip = '{{ph:hair:world:p1}}';

/** Every heavy field holds a placeholder chip, so a read proves the text arrives resolved (Q30). */
const world: AuthoredWorld = {
  worldOverview: { name: 'Harbor', systemPrompt: '' } as WorldOverview, stats: [], traits: [], placeholders: [hair],
  locations: [
    { id: 'dock', name: 'Dock', aiDescription: `Planks the color of ${chip}.`, aiSummary: `A ${chip} dock.`, isStarting: true },
    { id: 'hill', name: 'Hill', aiDescription: 'Wind.' },
  ],
  entities: [
    { id: 'mira', name: 'Mira', aliases: [], locations: ['dock'], aiDescription: `Mira has ${chip} hair.`, aiSummary: `${chip}-haired.` },
    { id: 'oren', name: 'Oren', aliases: [], locations: ['hill'], aiDescription: 'A keeper.' },
  ],
  dictionaries: [{
    id: 'lore', name: 'Lore', placeholders: [],
    entries: [{ id: 'tides', name: 'Tides', key: ['tide'], value: `The tide runs ${chip} at dusk.` }],
  }],
};

const worldSnapshot = (): ToolSnapshot =>
  buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? [], null, { state: openingStateOf(world), authored: null });

const script = (code: string): Tool => ({
  id: 't', name: 't', description: '', params: [], handler: { kind: 'script', code }, emptyResult: 'NOTHING', offeredTo: ['narration'],
});
const read = async (code: string, snapshot: ToolSnapshot): Promise<unknown> => {
  const { text, failure } = await runToolCall(script(code), '{}', snapshot);
  if (failure) throw new Error(text);
  return JSON.parse(text);
};

describe('a user Tool script reads heavy text from its Tool Snapshot', () => {
  beforeEach(() => { hostCalls.length = 0; vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads every description, summary and entry value as the snapshot resolved it (Q30, Q54)', async () => {
    const snapshot = worldSnapshot();
    const out = await read(`return {
      entities: Object.values(entities).map((e) => [e.name, e.description, e.summary]),
      locations: Object.values(locations).map((l) => [l.name, l.description, l.summary]),
      entries: Object.values(dictionaries).flatMap((d) => Object.values(d.entries)).map((e) => [e.name, e.value]),
    };`, snapshot);
    const { world: resolved } = snapshot;
    expect(out).toEqual({
      entities: resolved.entities.map((e) => [e.name, e.description, e.summary]),
      locations: resolved.locations.map((l) => [l.name, l.description, l.summary]),
      entries: resolved.dictionary.map((e) => [e.name, e.value]),
    });
    expect(JSON.stringify(out)).toContain('The tide runs copper at dusk.');
    expect(JSON.stringify(out)).not.toContain('{{ph:');
  });

  it('reads every memory text the snapshot holds', async () => {
    const snapshot = sampleToolSnapshot();
    const texts = snapshot.script.state?.memories?.map((memory) => memory.text) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    expect(await read('return memories.map((m) => m.text);', snapshot)).toEqual(texts);
  });

  it('asks the host once per text it reads, and never for one it does not', async () => {
    const snapshot = sampleToolSnapshot();
    await read('return [Object.keys(entities), Object.keys(locations), memories.length, Object.keys(dictionaries)];', snapshot);
    expect(hostCalls).toEqual([]);
    await read('return [memories[0].text, memories[0].text];', snapshot);
    expect(hostCalls).toHaveLength(1);
  });
});
