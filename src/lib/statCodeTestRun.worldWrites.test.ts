/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import type { Stat } from '@/types';

const world: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [],
  locations: [{ id: 'loc-gate', name: 'North Gate' }, { id: 'loc-inn', name: 'Inn', isStarting: true }],
};

const STAT_HOME = { kind: 'globalStat', stat: { id: 's', name: 'S' } as Stat } as const;
const run = (code: string, at: StatCodeWorld = world) => runTestCode(code, 'after', { kind: 'world' }, at);

describe('runTestCode world writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('stands at the starting location', async () => {
    const report = await runTestCode('return location.name === "Inn" ? 1 : 0;', 'after', STAT_HOME, world);
    expect(report.value).toBe(1);
  });

  it('stands at the first location when none is the starting one', async () => {
    const report = await runTestCode('return location.id === "loc-gate" ? 1 : 0;', 'after', STAT_HOME, {
      ...world, locations: world.locations?.map(({ isStarting: _start, ...location }) => location),
    });
    expect(report.value).toBe(1);
  });

  it('reads an empty memories list (Q12)', async () => {
    const report = await runTestCode('return Array.isArray(memories) ? memories.length : -1;', 'after', STAT_HOME, world);
    expect(report.error).toBeNull();
    expect(report.value).toBe(0);
  });

  it('lists a move, an advance and each discovery', async () => {
    const report = await run('location.move("North Gate"); clock.advance(20); clock.advance(10); discover("Tor"); discover("Mira", "The innkeeper.");');
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['location.move: North Gate', 'clock.advance: 30 minutes', 'discover: Tor', 'discover: Mira, described']);
  });

  it('lists each memory line, pin and diary line', async () => {
    const report = await run('memories.add("Tor lied."); memories.pin("The bridge is out."); entities.Tor.diary("I lied.");', {
      ...world, entities: [{ id: 'e-tor', name: 'Tor' }],
    });
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['memories.add: Tor lied.', 'memories.pin: The bridge is out.', 'diary: Tor: I lied.']);
  });

  it('lists each entity write as one line', async () => {
    const report = await run('entities.Tor.move("loc-gate"); entities["Old Mira"].follow(); entities.Tor.unfollow();', {
      ...world, entities: [{ id: 'e-tor', name: 'Tor' }, { id: 'e-mira', name: 'Old Mira' }],
    });
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['entities.Tor.move: North Gate', 'entities["Old Mira"].follow()', 'entities.Tor.unfollow()']);
  });

  // The editor has no discovered cast, so play may know a name the authored world lacks (Q46).
  it('warns on a diary for a name the authored world lacks, and does not fail', async () => {
    const report = await run('entities.Stranger.diary("Hello."); entities.Tor.diary("I lied.");', { ...world, entities: [{ id: 'e-tor', name: 'Tor' }] });
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['diary: Tor: I lied.']);
    expect(report.dropped).toEqual(['Diary target “Stranger” may be discovered in play.']);
  });

  it('names a missing diary target once however often it is called', async () => {
    const report = await run('entities.Stranger.diary("One."); entities.Stranger.diary("Two.");');
    expect(report.dropped).toEqual(['Diary target “Stranger” may be discovered in play.']);
  });

  it('still fails a diary call that has no line', async () => {
    const report = await run('entities.Stranger.diary("");');
    expect(report.error).toMatch(/needs a line/);
  });

  it('hands a World Tool run its arguments and reports the value it returned', async () => {
    const report = await runTestCode('return "Hello " + args.who;', 'before', { kind: 'tool' }, world, { args: { who: 'Tor' } });
    expect(report.error).toBeNull();
    expect(report.reply).toBe('Hello Tor');
  });

  it('reports no reply for a run given no arguments', async () => {
    const report = await run('memories.add("Noted.");');
    expect(report.reply).toBeUndefined();
  });

  it('fails on a location the world does not have, and lists no writes', async () => {
    const report = await run('clock.advance(5); location.move("Moon");');
    expect(report.error).toMatch(/Moon/);
    expect(report.writes).toEqual([]);
  });
});
