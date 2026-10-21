/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { helpTool } from '@/test/helpFixtures';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { openingStateOf } from '@/lib/openingState';
import { snapshotOf } from '@/lib/sandboxSnapshot';
import type { SandboxMemory } from '@/lib/statCodeExecutor';
import type { Stat, Tool, WorldOverview } from '@/types';
import { runToolCall } from './toolRunner';
import { buildToolSnapshot, emptyToolSnapshot, type ToolSnapshot } from './toolSnapshot';
import { sampleToolSnapshot } from './sampleToolSnapshot';

describe('the empty Tool Snapshot', () => {
  it('holds no world, so a lookup returns its empty result', async () => {
    const tool = helpTool();
    expect(await runToolCall(tool, '{"name":"Wren"}', emptyToolSnapshot())).toEqual({ text: tool.emptyResult });
  });

  it('renders a Template’s scene chips as a world with nothing in it does', async () => {
    const template = helpTool({ handler: { kind: 'template', body: 'Notes: <NOTES>' }, params: [] });
    expect((await runToolCall(template, '', emptyToolSnapshot())).text).toBe('Notes: N/A');
  });
});

const world: AuthoredWorld = {
  worldOverview: { name: 'Harbor', systemPrompt: '' } as WorldOverview, stats: [], traits: [], placeholders: [],
  locations: [
    { id: 'dock', name: 'Dock', aiDescription: 'Wet planks.', isStarting: true },
    { id: 'hill', name: 'Hill', aiDescription: 'Wind.' },
  ],
  entities: [
    { id: 'mira', name: 'Mira', aliases: [], locations: ['dock'] },
    { id: 'oren', name: 'Oren', aliases: [], locations: ['hill'] },
  ],
  dictionaries: [{
    id: 'lore', name: 'Lore', placeholders: [],
    entries: [{ id: 'tides', name: 'Tides', key: ['tide'], value: 'The tide turns at dusk.' }],
  }],
};

const memory = (turn: number, text: string): SandboxMemory => ({
  id: `m${turn}`, turn, timestamp: turn, day: 1, daypart: 'morning', text, custom: false, kept: true, inContext: true, pinned: false, forgotten: false,
});

/** A playthrough of `world`: Mira moved to the Hill, two memories, and the player's notes. */
function playSnapshot(): ToolSnapshot {
  const state = {
    ...openingStateOf(world), positions: { mira: 'hill' }, notes: 'Find the lighthouse key.',
    memories: [memory(1, 'Mira left the Dock.'), memory(2, 'Oren lit a fire on the Hill.')],
  };
  return buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? [], null, { state, authored: null });
}

const script = (code: string): Tool => ({
  id: 't', name: 't', description: '', params: [], handler: { kind: 'script', code }, emptyResult: 'NOTHING', offeredTo: ['narration'],
});
const read = async (code: string, snapshot: ToolSnapshot) => JSON.parse((await runToolCall(script(code), '{}', snapshot)).text) as unknown;

describe('a user Tool script reads its Tool Snapshot on the script surface', () => {
  // The executor logs a script's console output to the host console; keep test output clean.
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads an entity’s place, who is present, the last memory, a book’s entries and the notes', async () => {
    const code = `return [
      entities.Mira.location, location.present.length, locations.Hill.present.map((e) => e.name), memories.at(-1).text,
      Object.keys(dictionaries.Lore.entries), dictionaries.Lore.entries.Tides.value, notes,
    ];`;
    expect(await read(code, playSnapshot())).toEqual([
      'Hill', 0, ['Mira', 'Oren'], 'Oren lit a fire on the Hill.', ['Tides'], 'The tide turns at dusk.', 'Find the lighthouse key.',
    ]);
  });

  it('gives a memory entry no verb', async () => {
    const code = 'return ["pin", "forget", "edit", "remove"].map((verb) => typeof memories[0][verb]);';
    expect(await read(code, playSnapshot())).toEqual(['undefined', 'undefined', 'undefined', 'undefined']);
  });

  it('reads the opening clock and no memories on a screen with no game', async () => {
    const code = 'return [clock.elapsedHours, clock.day, memories.length, notes];';
    expect(await read(code, emptyToolSnapshot())).toEqual([0, 1, 0, '']);
    const editor = buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? [], null, { state: openingStateOf(world), authored: null });
    expect(await read(code, editor)).toEqual([0, 1, 0, '']);
  });

  it('reads the sample world as a game in progress (Q44)', async () => {
    const code = 'return [clock.elapsedHours, memories.length, memories[0].text, persona.name, notes.length > 0];';
    expect(await read(code, sampleToolSnapshot())).toEqual([58, 3, 'Wren sold Bell a lantern of salt glass at the Landing.', 'Traveler', true]);
  });

  it('reads who the sample scene has in it', async () => {
    const code = 'return Object.values(entities).filter((e) => e.inScene).map((e) => e.name);';
    expect(await read(code, sampleToolSnapshot())).toEqual(['Wren', 'Traveler']);
  });
});

describe('a world script reads the player’s notes', () => {
  const stat: Stat = { id: 's', name: 'Count', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [] };

  it('reads them as text, and an empty string with none', async () => {
    const code = 'return notes.length;';
    const withNotes = snapshotOf({ ...openingStateOf(world), notes: 'Ask Mira.' });
    expect((await withNotes.run({ home: { kind: 'globalStat', stat }, timing: 'after', code })).value).toBe(9);
    const without = snapshotOf(openingStateOf(world));
    expect((await without.run({ home: { kind: 'globalStat', stat }, timing: 'after', code })).value).toBe(0);
  });
});
