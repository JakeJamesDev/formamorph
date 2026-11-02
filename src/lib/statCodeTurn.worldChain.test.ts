/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inPlayOwners } from './ownedTraitsInPlay';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import type { Body, Entity, PlayerStat, Script } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const echo = (): PlayerStat => ({
  id: 'echo', name: 'Echo', type: 'number', description: '', min: 0, max: 100000, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100000, baseRegen: 0, aiMaxDelta: 0,
});

const scripts = (...codes: string[]): Script[] => codes.map((code, i) => ({ id: `s${i}`, timing: 'after', code }));

const bram: Entity = { id: 'bram', name: 'Bram', locations: ['hill'] };

const castOf = (): StatCodeOwners => {
  const entities = [bram];
  const persona = { source: 'none' } as const;
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, entities, library: [],
    world: { traits: [], groups: [], entities, persona, ...inPlayOwners({ traits: [], traitGroups: [], entities }, persona, []) },
  };
};

const wolf = (id: string, name: string): Body => ({ id, name, entries: [], backdrop: { kind: 'none' } as unknown as Body['backdrop'], aspect: 1 });

const places = (at: 'dock' | 'hill') => ({
  locations: [
    { id: 'dock', name: 'Dock' }, { id: 'hill', name: 'Hill', parentId: 'dock' },
  ],
  location: { id: at, name: at === 'dock' ? 'Dock' : 'Hill' },
});

const turnOf = (over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats: [echo()], enabled: {}, previous: [echo()], asks: [], regenApplied: {}, clock: { deltaHours: 0, elapsedHours: 10 },
  ownerTraits: castOf(), places: places('dock'), statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  turn: { action: '', number: 3, id: 't-3', narration: '', choices: [] },
  ...over,
});

const echoOf = (out: { stats: readonly PlayerStat[] }) => out.stats.find((s) => s.id === 'echo')?.value;

/** The later script's read after the earlier ones ran, over the same state with no earlier script. */
const read = (over: Partial<FlatStatCodeTurn>, ...codes: string[]) => runStatCodeTurn(turnOf({ ...over, worldScripts: scripts(...codes) }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a later script reads an earlier script’s world write', () => {
  it('reads a Body write', async () => {
    const bodies = { world: { bodies: [wolf('b-man', 'Humanoid'), wolf('b-wolf', 'Wolf')], entities: [{ id: 'bram', name: 'Bram' }] }, persona: undefined };
    const out = await read({ bodies }, 'entities.Bram.body = "Wolf";', 'stats.Echo.value = entities.Bram.body.name === "Wolf" ? 1 : 0;');
    expect(echoOf(out)).toBe(1);
    expect(out.worldWrites?.bodies).toEqual([{ owner: 'bram', pick: { kind: 'body', id: 'b-wolf' } }]);
  });

  it('reads a location write, with who is present and the exits from there', async () => {
    const code = 'stats.Echo.value = (location.name === "Hill" ? 1000 : 0) + location.present.length * 100 + location.exits.length;';
    const chained = await read({}, 'location.move("Hill");', code);
    const standing = await read({ places: places('hill') }, code);
    expect(echoOf(standing)).toBeGreaterThanOrEqual(1100);
    expect(echoOf(chained)).toBe(echoOf(standing));
    expect(chained.worldWrites?.location).toBe('hill');
  });

  it('reads the clock, in the time of day and the day number, and counts each advance once', async () => {
    const code = 'stats.Echo.value = clock.day * 100 + clock.hour + clock.previous.day * 10000;';
    const chained = await read({}, 'clock.advance(120);', 'clock.advance(60);', code);
    const control = await read({ clock: { deltaHours: 3, elapsedHours: 13 } }, code);
    expect(echoOf(chained)).toBe(echoOf(control));
    expect(chained.worldWrites?.minutes).toBe(180);
  });

  it('replaces the turn’s own duration with the advances, as the commit lands them', async () => {
    const code = 'stats.Echo.value = clock.hour + clock.deltaHours * 100 + clock.previous.hour * 1000;';
    const chained = await read({ clock: { deltaHours: 2, elapsedHours: 12 } }, 'clock.advance(120);', 'clock.advance(60);', code);
    // The turn began at hour 10 and now lasts the 3 advanced hours, not 5.
    const control = await read({ clock: { deltaHours: 3, elapsedHours: 13 } }, code);
    expect(echoOf(chained)).toBe(echoOf(control));
  });

  it('reads a memory line on the turn’s own row, and a row verb on it names the id the turn commits', async () => {
    const out = await read(
      { memories: [] },
      'memories.add("Tor lied.");',
      'const row = memories[memories.length - 1]; stats.Echo.value = memories.length * 10 + (row.text === "Tor lied." ? 1 : 0); row.pin();',
    );
    expect(echoOf(out)).toBe(11);
    expect(out.worldWrites?.memoryWrites).toEqual([{ id: 't-3', kind: 'pin' }]);
  });

  it('reads a pinned line as a Custom row under the id its note takes, and edits it there', async () => {
    const out = await read(
      { memories: [] },
      'memories.pin("Kept.");',
      'const row = memories[0]; stats.Echo.value = row.custom && row.text === "Kept." ? 1 : 0; row.edit("Rewritten.");',
    );
    expect(echoOf(out)).toBe(1);
    expect(out.worldWrites?.memoryWrites).toEqual([{ id: 'script:t-3:0', kind: 'edit', text: 'Rewritten.', custom: true }]);
  });

  it('reads a discovered character, and a diary line names it', async () => {
    const out = await read(
      {},
      'discover("Wick", "A courier.");',
      'stats.Echo.value = entities.Wick.name === "Wick" ? 1 : 0; entities.Wick.diary("I ran the message.");',
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(echoOf(out)).toBe(1);
    expect(out.worldWrites?.diary).toEqual([{ entity: 'Wick', line: 'I ran the message.' }]);
    expect(out.worldWrites?.discover).toEqual([{ name: 'Wick', description: 'A courier.' }]);
  });

  it('reads an entity move, a follow and a meeting', async () => {
    const out = await read(
      { positions: {}, followers: [] },
      'entities.Bram.move("Dock");',
      'stats.Echo.value = entities.Bram.location === "Dock" ? 1 : 0; entities.Bram.follow(); entities.Bram.meet();',
      'stats.Echo.value += (entities.Bram.following ? 10 : 0) + (entities.Bram.met ? 100 : 0);',
    );
    expect(echoOf(out)).toBe(111);
  });
});

describe('a script that stops adds nothing to the chain', () => {
  it('leaves an earlier advance, and its own, out of what the next script reads', async () => {
    const out = await read(
      {},
      'clock.advance(30); location.move("Hill"); location.move("Atlantis");',
      'stats.Echo.value = (location.name === "Dock" ? 1 : 0) + (clock.elapsedHours === 10 ? 10 : 0);',
    );
    expect(echoOf(out)).toBe(11);
    expect(out.worldWrites).toBeUndefined();
  });
});

describe('a stat re-roll’s chain', () => {
  it('reads a location write that the caller then drops, and keeps the turn’s own scene', async () => {
    const moved = await read(
      { places: places('hill'), positions: { bram: 'hill' }, memories: [], clock: { deltaHours: 1, elapsedHours: 12 } },
      'location.move("Dock");',
      'stats.Echo.value = location.name === "Dock" ? 1 : 0;',
    );
    expect(echoOf(moved)).toBe(1);
    // The write is in the result for the caller, GameViewer, to drop; it never reaches the state a run is handed.
    expect(moved.worldWrites?.location).toBe('dock');
    // A Tool call's saved writes carry no scene write, so its replay never moves the kept location, clock or cast.
    const scene = 'location.move("Hill"); clock.advance(60); memories.add("Tor lied."); entities.Bram.diary("Hid."); discover("Wick", "A courier."); entities.Bram.move("Dock");';
    const called = await runStatCodeTurn(turnOf({ triggers: [{ name: 'Tool', code: `${scene} stats.Echo.value = 5;`, args: {} }] }));
    expect(called.worldWrites?.location).toBe('hill');
    const replayed = await runStatCodeTurn(turnOf({
      memories: [],
      worldScripts: scripts('stats.Echo.value += (location.name === "Dock" ? 10 : 0) + (clock.elapsedHours === 10 ? 100 : 0) + (memories.length === 0 ? 1000 : 0) + (Object.keys(entities).includes("Wick") ? 0 : 10000);'),
      replayed: [{ name: 'Tool', writes: called.triggerWrites ?? {} }],
    }));
    expect(echoOf(replayed)).toBe(11115);
    expect(replayed.worldWrites).toBeUndefined();
  });
});
