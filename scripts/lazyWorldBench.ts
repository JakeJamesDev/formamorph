// Lazy World Entries bench: median executeStatCode cost on a Sunmeadow-sized world. `npm run bench:lazy-world`; not a gate.
import type { Dictionary, Entity, Item, Placeholder, Stat } from '@/types';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { executeStatCode, type SandboxEntity, type SandboxItem, type SandboxLocation, type StatCodeRunOptions } from '@/lib/statCodeExecutor';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';

const ENTITIES = 26;
const PLACEHOLDERS_PER_ENTITY = 6;
const ITEMS = 64;
const LOCATIONS = 32;
const WARMUP = 5;
const RUNS = 41;

/** Deterministic filler text of `length` characters. */
const prose = (seed: number, length: number) => {
  const words = ['amber', 'river', 'stone', 'quiet', 'lantern', 'meadow', 'copper', 'thistle', 'harbor', 'ember', 'willow', 'saddle'];
  let out = '';
  for (let at = seed; out.length < length; at = (at * 31 + 7) % 9973) out += `${words[at % words.length]} `;
  return out.slice(0, length);
};

const stat = (id: string, name: string, value: number): Stat =>
  ({ id, name, type: 'number', description: prose(value, 80), min: 0, max: 100, value, regen: 0, descriptors: [] });
const placeholder = (id: string, name: string, seed: number): Placeholder =>
  ({ id, name, values: [0, 1, 2].map((at) => ({ id: `${id}-v${at}`, text: prose(seed + at, 60) })) });

const entityIds = Array.from({ length: ENTITIES }, (_, at) => `e${at}`);
const world = {
  placeholders: Array.from({ length: 12 }, (_, at) => placeholder(`w${at}`, `World ${at}`, at)),
  entities: entityIds.map((id, at) => ({
    id, name: `Resident ${at}`, traits: [],
    placeholders: Array.from({ length: PLACEHOLDERS_PER_ENTITY }, (_, slot) => placeholder(`${id}-p${slot}`, `Trait ${slot}`, at * 10 + slot)),
  })) as Entity[],
  items: Array.from({ length: ITEMS }, (_, at) => ({
    id: `i${at}`, name: `Item ${at}`, statEffects: [], traitEffects: [], equipRequires: [],
    placeholders: at % 4 ? [] : [placeholder(`i${at}-p`, 'Finish', at)],
  })) as Item[],
  dictionaries: [{
    id: 'lore', name: 'Lore', entries: Array.from({ length: 40 }, (_, at) => ({ id: `d${at}`, name: `Entry ${at}`, key: [`key ${at}`], value: prose(at, 200) })),
  }] as Dictionary[],
};

const list = allPlaceholders(world);
const tree = sandboxPlaceholders({ placeholders: list, owners: placeholderOwners(world), rolls: {}, pick: (values) => values[0]?.text ?? '' });
const locations: SandboxLocation[] = Array.from({ length: LOCATIONS }, (_, at) => ({
  id: `l${at}`, name: `Place ${at}`, description: prose(at, 250), summary: prose(at + 1, 60),
  links: () => ({ parent: at ? 'Place 0' : '', children: [], exits: [{ name: `Place ${(at + 1) % LOCATIONS}`, hint: prose(at, 40), distance: 'nearby', oneWay: false }] }),
}));
const entities: SandboxEntity[] = entityIds.map((id, at) => ({
  id, name: `Resident ${at}`, type: 'Townsfolk', pronouns: 'they/them', inScene: at < 4, met: at % 2 === 0,
  description: prose(at, 240), summary: prose(at + 3, 80), aliases: [`R${at}`], locationId: `l${at % LOCATIONS}`, kind: 'unique',
  traits: Array.from({ length: 4 }, (_, slot) => ({ id: `${id}-t${slot}`, name: `Quirk ${slot}`, enabled: slot % 2 === 0, acquired: slot % 2 === 0 })),
  placeholders: tree.owners.get(id),
  stats: { stats: [stat(`${id}-s0`, 'Mood', at % 100), stat(`${id}-s1`, 'Bond', (at * 7) % 100), stat(`${id}-s2`, 'Energy', (at * 3) % 100)] },
}));
const items: SandboxItem[] = world.items.map(({ id, name }, at) => ({
  id, name, placeholders: tree.owners.get(id),
  instances: [{ id: `${id}-c`, where: { kind: 'entity', id: entityIds[at % ENTITIES] }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false }],
}));
const worldStat = stat('g-day', 'Day Count', 3);

const SUNMEADOW_SIZED: StatCodeRunOptions = {
  randomSeed: [1, 2, 3, 4],
  placeholders: tree.top,
  entities,
  persona: entities[0],
  items,
  places: { locations, location: { id: 'l0', name: 'Place 0' } },
  dictionaries: sandboxDictionaries(codeDictionaries(world.dictionaries, list), tree.owners),
  currencies: [{ id: 'coin', name: 'Coin', kind: 'name' }],
};
const owner = entities[5];
const ownerStat = owner.stats!.stats[0];

/** One timed Script, with its program size and run times once measured. */
interface Case { name: string; run: () => Promise<{ error: string | null }>; size: number; times: number[] }
const timed = (name: string, run: Case['run']): Case => ({ name, run, size: 0, times: [] });
const [noWorld, selfOnly, ownerScoped, fullWorld] = [
  timed('no world', () => executeStatCode('return self.value + 1;', [worldStat], worldStat)),
  timed('self only', () => executeStatCode('return self.value + 1;', [worldStat], worldStat, SUNMEADOW_SIZED)),
  timed('owner.placeholders', () => executeStatCode(
    'return self.value + Object.keys(owner.placeholders).length + owner.placeholders["Trait 0"].text.length;',
    [worldStat], ownerStat, { ...SUNMEADOW_SIZED, owner },
  )),
  timed('full world', () => executeStatCode(`let n = 0;
      for (const map of [entities, placeholders, items, locations, dictionaries, currencies]) n += Object.values(map).length;
      return n;`, [worldStat], null, SUNMEADOW_SIZED)),
];
const CASES = [noWorld, selfOnly, ownerScoped, fullWorld];

/** The last run's program length, which the bench's Vite config records. */
function programSize(name: string): number {
  const size = (globalThis as { __lazyWorldBenchProgram?: number }).__lazyWorldBenchProgram;
  if (size === undefined) throw new Error(`${name}: no program size; run through npm run bench:lazy-world`);
  return size;
}
const median = (times: readonly number[]) => [...times].sort((a, b) => a - b)[times.length >> 1];

for (const timedCase of CASES) {
  const result = await timedCase.run();
  if (result.error) throw new Error(`${timedCase.name}: ${result.error}`);
  timedCase.size = programSize(timedCase.name);
  for (let at = 0; at < WARMUP; at++) await timedCase.run();
}
// The cases take turns, so a load spike on the machine hits each of them alike.
for (let at = 0; at < RUNS; at++) {
  for (const timedCase of CASES) {
    const started = performance.now();
    await timedCase.run();
    timedCase.times.push(performance.now() - started);
  }
}

const floor = median(noWorld.times);
console.log(`World data in the full-world program (its size minus no world's): ${((fullWorld.size - noWorld.size) / 1024).toFixed(1)} KB`);
console.log(`Median of ${RUNS} runs per case:`);
for (const { name, times, size } of CASES) {
  const ms = median(times);
  console.log(`  ${name.padEnd(20)} ${ms.toFixed(2).padStart(7)} ms  ${(ms / floor).toFixed(2)}× no world  program ${(size / 1024).toFixed(1)} KB`);
}
