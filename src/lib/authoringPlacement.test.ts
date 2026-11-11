/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import type { AuthoredWorld } from './chipValues/authoredScene';
import { openingCast } from './positionPlay';
import { benchSnapshotOf } from './testBench/scriptCheck';
import { editorToolSnapshot } from './tools/editorToolSnapshot';
import { sampleToolSnapshot } from './tools/sampleToolSnapshot';
import { companion, herd, smith, yardLocations } from '@/test/entityKindFixture';
import type { Stat, World } from '@/types';

const world: AuthoredWorld & StatCodeWorld = {
  worldOverview: { name: 'Test', description: '', systemPrompt: '' } as World['worldOverview'],
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [smith, companion, herd], entityGroups: [], placeholders: [],
  placeholderGroups: [], dictionaries: [], locations: yardLocations, connections: [],
};
const STAT_HOME = { kind: 'globalStat', stat: { id: 's', name: 'S' } as Stat } as const;

/** What the run reads of the cast, as one record. */
const READ = `const at = (n) => locations[n].present.map((e) => e.name);
const read = { smith: entities.Smith.location, companion: [entities.Companion.location, !!entities.Companion.following],
  present: { Yard: at("Yard"), Barn: at("Barn"), Field: at("Field"), Smithy: at("Smithy") } };`;
/** The placement the opening gives: the Smith at its first Start, the companion following at the player's start
 *  (the Yard), the Herd at each place its presences stand at the start of the story. */
const EXPECTED = {
  smith: 'Smithy', companion: ['Yard', true],
  present: { Yard: ['Companion'], Barn: ['Herd'], Field: ['Herd'], Smithy: ['Smith'] },
};
const CHECK = `${READ}
if (JSON.stringify(read) !== ${JSON.stringify(JSON.stringify(EXPECTED))}) throw new Error(JSON.stringify(read));
return 1;`;

describe('an authoring run reads the cast as the opening places it (Q210)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('places each entity once in Test Code: a Unique at its first Start, a follower with the player, a Generic at its Starts', async () => {
    const report = await runTestCode(CHECK, 'after', STAT_HOME, world);
    expect(report.error).toBeNull();
    expect(report.value).toBe(1);
  });

  it('reads the same placement in the Test Bench script check', async () => {
    const bench = { ...world, statUpdates: [] };
    const out = await benchSnapshotOf(bench, 'after').run({ home: STAT_HOME, timing: 'after', code: CHECK });
    expect(out.error).toBeNull();
    expect(out.value).toBe(1);
  });

  it('gives the editor Tool lists the authoring state', () => {
    const state = editorToolSnapshot(world).script.state;
    expect(state?.positions).toEqual({ smith: 'smithy', companion: 'yard' });
    expect(state?.followers).toEqual(['companion']);
    expect(state?.presences).toEqual({ herd: ['field', 'barn'] });
  });

  it('gives the sample Tool snapshot the authoring state', () => {
    // The sample cast has no kind, so nobody is placed; the opening state alone leaves these absent.
    const state = sampleToolSnapshot().script.state;
    expect(state?.positions).toEqual({});
    expect(state?.followers).toEqual([]);
  });

  it('keeps the Test Bench AI context cast where the opening places it', () => {
    const cast = openingCast(world.entities, yardLocations, [], 'yard');
    expect(Object.fromEntries(cast.map((e) => [e.id, e.locations]))).toEqual({
      smith: ['smithy'], companion: ['yard'], herd: ['field', 'barn'],
    });
  });
});
