/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, statCodeNames, type StatCodeWorld } from './statCodeTestRun';

const world: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [],
  locations: [{ id: 'loc-gate', name: 'North Gate' }, { id: 'loc-inn', name: 'Inn', isStarting: true }],
};

const run = (code: string, at: StatCodeWorld = world) => runTestCode(code, 'after', null, statCodeNames(at));

describe('runTestCode world writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('stands at the starting location', async () => {
    const report = await runTestCode('return location.name === "Inn" ? 1 : 0;', 'after', { id: 's', name: 'S' }, statCodeNames(world));
    expect(report.value).toBe(1);
  });

  it('stands at the first location when none is the starting one', async () => {
    const report = await runTestCode('return location.id === "loc-gate" ? 1 : 0;', 'after', { id: 's', name: 'S' }, statCodeNames({
      ...world, locations: world.locations?.map(({ isStarting: _start, ...location }) => location),
    }));
    expect(report.value).toBe(1);
  });

  it('lists a move, an advance and each discovery', async () => {
    const report = await run('location.move("North Gate"); clock.advance(20); clock.advance(10); discover("Tor"); discover("Mira", "The innkeeper.");');
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['location.move: North Gate', 'clock.advance: 30 minutes', 'discover: Tor', 'discover: Mira, described']);
  });

  it('lists each memory line, pin and diary line', async () => {
    const report = await run('memory.add("Tor lied."); memory.pin("The bridge is out."); diary("Tor", "I lied.");', {
      ...world, entities: [{ id: 'e-tor', name: 'Tor' }],
    });
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['memory.add: Tor lied.', 'memory.pin: The bridge is out.', 'diary: Tor: I lied.']);
  });

  it('fails on a diary for an entity the world does not have', async () => {
    const report = await run('diary("Stranger", "Hello.");');
    expect(report.error).toMatch(/Stranger/);
  });

  it('fails on a location the world does not have, and lists no writes', async () => {
    const report = await run('clock.advance(5); location.move("Moon");');
    expect(report.error).toMatch(/Moon/);
    expect(report.writes).toEqual([]);
  });
});
