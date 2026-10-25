/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { executeStatCode, type SandboxDictionary } from './statCodeExecutor';

/** One book of `count` enabled entries, each holding 1 KB of text. */
const bigBook = (count: number): SandboxDictionary => ({
  name: 'Lore', id: 'lore',
  entries: Array.from({ length: count }, (_, at) => ({
    id: `entry-${at}-0000-0000-0000-000000000000`, name: `Entry ${at}`, keys: [`key ${at}`, `alias ${at}`], value: 'x'.repeat(1024),
  })),
});

const timeMs = async (code: string, dictionaries: readonly SandboxDictionary[]): Promise<number> => {
  const started = performance.now();
  await executeStatCode(code, [], null, { dictionaries });
  return performance.now() - started;
};

const median = (times: number[]) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];

/** The median time of each world's `return 1;` run, the worlds taking turns so a load spike hits both. */
async function medianPair(worlds: readonly (readonly SandboxDictionary[])[], runs = 11): Promise<number[]> {
  for (const world of worlds) await timeMs('return 1;', world);
  const times = worlds.map((): number[] => []);
  for (let run = 0; run < runs; run++) {
    for (const [at, world] of worlds.entries()) times[at].push(await timeMs('return 1;', world));
  }
  return times.map(median);
}

describe('the prelude cost (Q37, Q48)', () => {
  it('keeps a run that reads no entry near the empty world’s cost', async () => {
    const book = bigBook(10_000);
    const [empty, full] = await medianPair([[], [book]]);
    const readEntries = () => timeMs('return Object.keys(dictionaries.Lore.entries).length;', [book]);
    const reading = median([await readEntries(), await readEntries(), await readEntries()]);
    console.info(`return 1: empty world ${empty.toFixed(1)} ms, 10,000 entries of 1 KB ${full.toFixed(1)} ms; reading one book’s entries ${reading.toFixed(1)} ms`);
    expect(full).toBeLessThanOrEqual(3 * empty);
    const read = await executeStatCode('return Object.keys(dictionaries.Lore.entries).length;', [], null, { dictionaries: [book], args: {} });
    expect(read.reply).toBe('10000');
  });
});
