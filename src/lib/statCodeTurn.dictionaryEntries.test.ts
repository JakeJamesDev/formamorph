/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary, DictionaryEntry, Placeholder, PlayerStat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const entry = (id: string, name: string, key: string[], value: string, over: Partial<DictionaryEntry> = {}): DictionaryEntry =>
  ({ id, name, key, value, ...over });

const crown = entry('crown', 'Iron Crown', ['crown', 'iron'], 'The old king’s crown.');
const lore: Dictionary = {
  id: 'lore', name: 'Lore', entries: [
    crown,
    entry('sealed', 'Sealed', ['vault'], 'Hidden.', { enabled: false }),
    entry('river-old', 'River', ['water'], 'First river.'),
    entry('river-new', 'River', ['stream'], 'Later river.'),
  ],
};
const muted: Dictionary = { id: 'muted', name: 'Muted', entries: [entry('m', 'Ghost', ['g'], 'Gone.')] };
const tides: Dictionary = { id: 'tides', name: 'Tides', entries: [entry('ebb', 'Ebb', ['low'], 'Water leaves.')] };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['red']) };

const nobody: StatCodeOwners = {
  acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities: [], library: [],
  world: {
    traits: [], groups: [], entities: [], persona: { source: 'none' },
    ...inPlayOwners({ traits: [], traitGroups: [], entities: [] }, { source: 'none' }, []),
  },
};

const run = (code: string, dictionaries: readonly Dictionary[] = [lore, muted], placeholders: Placeholder[] = []) =>
  runStatCodeTurn(statCodeTurnOf({
    stats: [stat({ id: 's0', name: 'S0', value: 0, scripts: boxScripts({ after: code }) })],
    enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, ownerTraits: nobody,
    placeholders: {
      placeholders, dictionaries, libraryDictionaries: [tides], rolls: { world: {} },
      inPlayDictionaryIds: new Set(dictionaries.filter((book) => book !== muted).map((book) => book.id)),
    },
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  }));

const valueOf = (out: { stats: readonly PlayerStat[] }) => out.stats.find((s) => s.id === 's0')?.value;

describe('dictionaries entries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads an entry’s id, name, keys and value through brackets', async () => {
    const out = await run('const e = dictionaries.Lore.entries["Iron Crown"];'
      + ' return e.id === "crown" && e.name === "Iron Crown" && e.keys.join("|") === "crown|iron"'
      + ' && e.value === "The old king’s crown." ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('leaves a disabled entry and a muted book out, and a later entry wins a shared name', async () => {
    const out = await run('return [Object.keys(dictionaries.Lore.entries).join("|"), dictionaries.Lore.entries.River.value,'
      + ' dictionaries.Muted.entries.Ghost.id, Object.keys(dictionaries.Muted.entries).length].join("/") === "Iron Crown|River/Later river.//0" ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('flattens to every enabled entry, a library book’s included', async () => {
    const out = await run('return Object.values(dictionaries).flatMap((d) => Object.values(d.entries)).map((e) => e.id).join("|")'
      + ' === "crown|river-new|ebb" ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('reads an unknown entry as a blank one', async () => {
    const out = await run('const e = dictionaries.Lore.entries.Nope;'
      + ' return e.id === "" && e.name === "" && e.keys.length === 0 && e.value === "" ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('names an entry by its code name', async () => {
    const book: Dictionary = { id: 'lore', name: 'Lore', entries: [entry('h', 'The {{ph:hair:world:p1}} Wig', ['wig'], 'A wig.')] };
    const out = await run('return dictionaries.Lore.entries["The Hair Wig"].id === "h" ? 1 : 0;', [book], [hair]);
    expect(valueOf(out)).toBe(1);
  });

  it('reads real entries through a computed global name', async () => {
    const out = await run('const books = new Function("return dict" + "ionaries")();'
      + ' return books.Lore.entries["Iron Crown"].value === "The old king’s crown." && Object.keys(books.Lore.entries).length === 2 ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('drops and reports writes to entries and to an entry’s fields', async () => {
    const out = await run('dictionaries.Lore.entries = {}; dictionaries.Lore.entries["Iron Crown"].value = "x";'
      + ' dictionaries.Lore.entries.River.keys = []; try { dictionaries.Lore.entries["Iron Crown"].keys.push("gold"); } catch {}'
      + ' const e = dictionaries.Lore.entries["Iron Crown"];'
      + ' return e.value === "The old king’s crown." && e.keys.length === 2 ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(
      /dictionaries\.Lore\.entries, dictionaries\.Lore\.entries\["Iron Crown"\]\.value, dictionaries\.Lore\.entries\.River\.keys/,
    ));
  });
});
