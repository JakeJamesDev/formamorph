/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { snapshotOf, type ScriptRunUnit } from './sandboxSnapshot';
import { openingStateOf } from './openingState';
import { executeStatCode, type SandboxLocationLinks } from './statCodeExecutor';
import type { SandboxState } from './statCodeTurn';
import type { Connection, Entity, GameLocation } from '@/types';

// A town holding a mill and a square; the square holds a stall. The road is apart, and the inn is reached one way.
const town: GameLocation = { id: 'town', name: 'Town' };
const mill: GameLocation = { id: 'mill', name: 'Old Mill', parentId: 'town', isStarting: true };
const square: GameLocation = { id: 'square', name: 'Square', parentId: 'town' };
const stall: GameLocation = { id: 'stall', name: 'Stall', parentId: 'square' };
const road: GameLocation = { id: 'road', name: 'Road' };
const inn: GameLocation = { id: 'inn', name: 'Inn' };
const orphan: GameLocation = { id: 'orphan', name: 'Orphan', parentId: 'gone' };
const locations = [town, mill, square, stall, road, inn, orphan];
const connections: Connection[] = [
  { id: 'c-road', a: 'mill', b: 'road', aToB: { hint: 'the CHIP path' }, bToA: {} },
  { id: 'c-inn', a: 'mill', b: 'inn', aToB: { hint: 'a trapdoor' } },
];
const hero: Entity = { id: 'hero', name: 'Hero', persona: true };

const resolveText = (text: string) => text.replaceAll('CHIP', 'mud');

const playState = (over: Partial<SandboxState> = {}): SandboxState => ({
  stats: [], enabled: {}, clock: { deltaHours: 1, elapsedHours: 1 },
  ownerTraits: {
    acquired: [], disabledTraitIds: [], appliedValues: {}, entities: [hero], library: [],
    world: { traits: [], groups: [], entities: [hero], persona: { source: 'world', entityId: 'hero' } },
  },
  places: { locations, location: { id: 'mill', name: 'Old Mill' }, connections },
  resolveText,
  ...over,
});

async function read(state: SandboxState, code: string, unit: Partial<ScriptRunUnit> = {}): Promise<unknown> {
  const result = await snapshotOf(state).run({ home: { kind: 'tool' }, timing: 'after', code, args: {}, ...unit });
  expect(result.error).toBeNull();
  return JSON.parse(result.reply ?? 'null');
}

describe('location parent, children and exits', () => {
  it('reads a child’s parent, a parent’s children in authored order, and empty at the top level', async () => {
    const code = 'return [locations.Stall.parent, locations.Town.parent, locations.Town.children, locations.Stall.children, location.parent];';
    expect(await read(playState(), code)).toEqual(['Square', '', ['Old Mill', 'Square'], [], 'Town']);
  });

  it('reads an empty parent for a parent id that names no location', async () => {
    expect(await read(playState(), 'return [locations.Orphan.parent];')).toEqual(['']);
  });

  it('lists the router’s destinations in its order, each Connection’s hint filled in', async () => {
    expect(await read(playState(), 'return location.exits;')).toEqual([
      { name: 'Town', hint: '' }, { name: 'Square', hint: '' }, { name: 'Road', hint: 'the mud path' }, { name: 'Inn', hint: 'a trapdoor' },
    ]);
  });

  it('lists a one-way Connection only from its own end', async () => {
    expect(await read(playState(), 'return [locations.Inn.exits, locations.Road.exits];')).toEqual([[], [{ name: 'Old Mill', hint: '' }]]);
  });

  it('names exits by the keys of locations', async () => {
    expect(await read(playState(), 'return [locations[location.exits[2].name].id];')).toEqual(['road']);
  });

  it('turns the current location into text', async () => {
    const [text] = await read(playState(), 'return [JSON.stringify(location)];') as [string];
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toMatchObject({ name: 'Old Mill', parent: 'Town', children: [], exits: expect.arrayContaining([{ name: 'Inn', hint: 'a trapdoor' }]) });
  });

  it('keeps the start location and its exits after a Before the AI move', async () => {
    const result = await snapshotOf(playState()).run({
      home: { kind: 'world' }, timing: 'before',
      code: 'location.move("Road"); const seen = [location.name, ...location.exits.map((e) => e.name)].join();'
        + ' if (seen !== "Old Mill,Town,Square,Road,Inn") throw new Error(seen);',
    });
    expect(result.error).toBeNull();
    expect(result.worldWrites?.location).toBe('road');
  });

  it('holds the lists frozen and records a write to a link as read-only', async () => {
    const result = await snapshotOf(playState()).run({
      home: { kind: 'tool' }, timing: 'after', args: {},
      code: 'try { location.exits.push({ name: "x", hint: "" }); } catch {} try { location.exits[0].name = "x"; } catch {} location.parent = "x";'
        + ' return [location.exits.length, location.exits[0].name, location.parent];',
    });
    expect(JSON.parse(result.reply ?? 'null')).toEqual([4, 'Town', 'Town']);
    expect(result.readOnlyWrites).toContain('location.parent');
  });

  it('reads the same fields in Test Code’s world and in a read-only user Tool run', async () => {
    const opening = openingStateOf({ locations, connections, entities: [hero] });
    expect(await read(opening, 'return [location.name, location.parent, location.exits.map((e) => e.hint)];'))
      .toEqual(['Old Mill', 'Town', ['', '', 'the CHIP path', 'a trapdoor']]);
    expect(await read(playState(), 'return [Object.keys(location).includes("exits"), locations.Square.children];', { readOnly: true }))
      .toEqual([true, ['Stall']]);
  });
});

describe('location links stay on the host until read', () => {
  const linksSpy = () => vi.fn((): SandboxLocationLinks => ({ parent: 'Town', children: [], exits: [{ name: 'Town', hint: '' }] }));

  it('builds none for a run that reads no link', async () => {
    const links = linksSpy();
    const places = { locations: [{ id: 'mill', name: 'Old Mill', links }], location: { id: 'mill', name: 'Old Mill' } };
    const res = await executeStatCode('return location.name;', [], null, { places, args: {} });
    expect(res.reply).toBe('Old Mill');
    expect(links).not.toHaveBeenCalled();
  });

  it('builds a location’s links once for its entry and for location', async () => {
    const links = linksSpy();
    const places = { locations: [{ id: 'mill', name: 'Old Mill', links }], location: { id: 'mill', name: 'Old Mill' } };
    const code = 'return [location.parent, location.exits, locations["Old Mill"].children, locations["Old Mill"].exits];';
    const res = await executeStatCode(code, [], null, { places, args: {} });
    expect(JSON.parse(res.reply ?? 'null')).toEqual(['Town', [{ name: 'Town', hint: '' }], [], [{ name: 'Town', hint: '' }]]);
    expect(links).toHaveBeenCalledTimes(1);
  });

  it('reads empty links for a name the world has no location for', async () => {
    const res = await executeStatCode('return [locations.Nowhere.parent, locations.Nowhere.children, locations.Nowhere.exits];', [], null, { args: {} });
    expect(JSON.parse(res.reply ?? 'null')).toEqual(['', [], []]);
  });
});
