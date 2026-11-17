/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Dictionary, Entity, Item, Placeholder, Stat } from '@/types';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from './statCodePlaceholders';
import {
  executeStatCode, type SandboxDictionary, type SandboxEntity, type SandboxItem, type SandboxLocation, type StatCodeRunOptions,
} from './statCodeExecutor';

/** One book of `count` enabled entries, each holding 1 KB of text. */
const bigBook = (count: number): SandboxDictionary => ({
  name: 'Lore', id: 'lore',
  entries: Array.from({ length: count }, (_, at) => ({
    id: `entry-${at}-0000-0000-0000-000000000000`, name: `Entry ${at}`, keys: [`key ${at}`, `alias ${at}`], value: 'x'.repeat(1024),
    enabled: true, constant: false,
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

const text = (seed: number, length: number) => `${seed} `.repeat(length).slice(0, length);
const stat = (id: string, name: string, value: number): Stat =>
  ({ id, name, type: 'number', description: text(value, 80), min: 0, max: 100, value, regen: 0, descriptors: [] });
const placeholder = (id: string, name: string, seed: number): Placeholder =>
  ({ id, name, values: [0, 1, 2].map((at) => ({ id: `${id}-v${at}`, text: text(seed + at, 60) })) });

/** A world sized like the bench's, about 200 KB of entry data: 26 residents with 6 placeholders and 3 stats each,
 *  64 items, 32 places, a book of 40 entries and a Currency. */
function largeWorld(): { options: StatCodeRunOptions; owner: SandboxEntity } {
  const ids = Array.from({ length: 26 }, (_, at) => `e${at}`);
  const authored = {
    placeholders: Array.from({ length: 12 }, (_, at) => placeholder(`w${at}`, `World ${at}`, at)),
    entities: ids.map((id, at) => ({
      id, name: `Resident ${at}`, traits: [], placeholders: Array.from({ length: 6 }, (_, slot) => placeholder(`${id}-p${slot}`, `Trait ${slot}`, at * 10 + slot)),
    })) as Entity[],
    items: Array.from({ length: 64 }, (_, at) => ({
      id: `i${at}`, name: `Item ${at}`, statEffects: [], traitEffects: [], equipRequires: [], placeholders: at % 4 ? [] : [placeholder(`i${at}-p`, 'Finish', at)],
    })) as Item[],
    dictionaries: [{ id: 'lore', name: 'Lore', entries: Array.from({ length: 40 }, (_, at) => ({ id: `d${at}`, name: `Entry ${at}`, key: [`key ${at}`], value: text(at, 200) })) }] as Dictionary[],
  };
  const list = allPlaceholders(authored);
  const tree = sandboxPlaceholders({ placeholders: list, owners: placeholderOwners(authored), rolls: {}, pick: (values) => values[0]?.text ?? '' });
  const locations: SandboxLocation[] = Array.from({ length: 32 }, (_, at) => ({ id: `l${at}`, name: `Place ${at}`, description: text(at, 250), summary: text(at, 60) }));
  const entities: SandboxEntity[] = ids.map((id, at) => ({
    id, name: `Resident ${at}`, type: 'Townsfolk', description: text(at, 240), summary: text(at, 80), aliases: [`R${at}`], locationId: `l${at % 32}`,
    traits: Array.from({ length: 4 }, (_, slot) => ({ id: `${id}-t${slot}`, name: `Quirk ${slot}`, enabled: true, acquired: true })),
    placeholders: tree.owners.get(id), stats: { stats: [stat(`${id}-s0`, 'Mood', at), stat(`${id}-s1`, 'Bond', at), stat(`${id}-s2`, 'Energy', at)] },
  }));
  const items: SandboxItem[] = authored.items.map(({ id, name }, at) => ({
    id, name, placeholders: tree.owners.get(id),
    instances: [{ id: `${id}-c`, where: { kind: 'entity', id: ids[at % 26] }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false }],
  }));
  return {
    owner: entities[5],
    options: {
      placeholders: tree.top, entities, persona: entities[0], items, places: { locations, location: { id: 'l0', name: 'Place 0' } },
      dictionaries: sandboxDictionaries(codeDictionaries(authored.dictionaries, list), tree.owners), currencies: [{ id: 'coin', name: 'Coin', kind: 'name' }],
    },
  };
}

/** The median time of an owner-scoped Script on each world, the worlds taking turns so a load spike hits both. */
async function ownerScopedPair(worlds: readonly StatCodeRunOptions[], runs = 11): Promise<number[]> {
  const code = 'return self.value + Object.keys(owner.placeholders).length + owner.placeholders["Trait 0"].text.length;';
  const once = async (options: StatCodeRunOptions) => {
    const started = performance.now();
    const result = await executeStatCode(code, [], options.owner?.stats?.stats[0] ?? null, options);
    if (result.error) throw new Error(result.error);
    return performance.now() - started;
  };
  for (const world of worlds) await once(world);
  const times = worlds.map((): number[] => []);
  for (let run = 0; run < runs; run++) {
    for (const [at, world] of worlds.entries()) times[at].push(await once(world));
  }
  return times.map(median);
}

describe('the prelude cost (Q37, Q48)', () => {
  it('keeps an owner-scoped Script on a large world within twice the empty world’s cost (Q10)', async () => {
    const { options, owner } = largeWorld();
    const ownerStat = owner.stats!.stats[0];
    const [empty, large] = await ownerScopedPair([{ owner: { ...owner, placeholders: undefined, stats: { stats: [ownerStat] } } }, { ...options, owner }]);
    console.info(`owner-scoped: empty world ${empty.toFixed(1)} ms, large world ${large.toFixed(1)} ms`);
    expect(large).toBeLessThanOrEqual(2 * empty);
  });

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
