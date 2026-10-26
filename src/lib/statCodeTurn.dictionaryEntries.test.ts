/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary, DictionaryEntry, LoreToggles, Placeholder, PlayerStat } from '@/types';
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

const run = (
  code: string, dictionaries: readonly Dictionary[] = [lore, muted], placeholders: Placeholder[] = [], loreToggles?: LoreToggles,
) =>
  runStatCodeTurn(statCodeTurnOf({
    ...(loreToggles && { loreToggles }),
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

  it('lists a disabled entry as off, leaves a muted book out, and a later entry wins a shared name (Q12)', async () => {
    const out = await run('return [Object.keys(dictionaries.Lore.entries).join("|"), dictionaries.Lore.entries.River.value,'
      + ' dictionaries.Lore.entries.Sealed.enabled, dictionaries.Lore.entries.River.enabled, dictionaries.Lore.entries.River.constant,'
      + ' dictionaries.Muted.entries.Ghost.id, Object.keys(dictionaries.Muted.entries).length].join("/")'
      + ' === "Iron Crown|Sealed|River/Later river./false/true/false//0" ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('flattens to every entry, a disabled one’s and a library book’s included', async () => {
    const out = await run('return Object.values(dictionaries).flatMap((d) => Object.values(d.entries)).map((e) => e.id).join("|")'
      + ' === "crown|sealed|river-new|ebb" ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('gives a shared name to the enabled entry over a later disabled one, and a write through it reaches that entry (Q26)', async () => {
    const book: Dictionary = { id: 'lore', name: 'Lore', entries: [
      entry('heron-on', 'Heron', ['heron'], 'Shown.'), entry('heron-off', 'Heron', ['egret'], 'Hidden.', { enabled: false }),
    ] };
    const out = await run('dictionaries.Lore.entries.Heron.constant = true; return dictionaries.Lore.entries.Heron.value === "Shown." ? 1 : 0;', [book]);
    expect(valueOf(out)).toBe(1);
    expect(out.loreWrites).toEqual([{ book: 'lore', entry: 'heron-on', field: 'constant', value: true }]);
  });

  it('keeps a shared name on its run-start winner after a write switches that entry off (Q49)', async () => {
    const book: Dictionary = { id: 'lore', name: 'Lore', entries: [
      entry('heron-on', 'Heron', ['heron'], 'Shown.'), entry('heron-off', 'Heron', ['egret'], 'Hidden.', { enabled: false }),
    ] };
    const out = await run('dictionaries.Lore.entries.Heron.enabled = false; return dictionaries.Lore.entries.Heron.id === "heron-on" ? 1 : 0;', [book]);
    expect(valueOf(out)).toBe(1);
  });

  it('lands `enabled` and `constant` writes, each entry’s in assignment order, and reads them back in the run (Q13, Q49)', async () => {
    const out = await run('const e = dictionaries.Lore.entries.Sealed; e.enabled = true; e.constant = true;'
      + ' dictionaries.Lore.entries["Iron Crown"].enabled = false; e.constant = false;'
      + ' return e.enabled === true && e.constant === false ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
    expect(out.loreWrites).toEqual([
      { book: 'lore', entry: 'crown', field: 'enabled', value: false },
      { book: 'lore', entry: 'sealed', field: 'enabled', value: true },
      { book: 'lore', entry: 'sealed', field: 'constant', value: true },
      { book: 'lore', entry: 'sealed', field: 'constant', value: false },
    ]);
  });

  it('reads an entry as the lore overlay leaves it', async () => {
    const out = await run('const e = dictionaries.Lore.entries.Sealed; return e.enabled && e.constant ? 1 : 0;', [lore, muted], [],
      { lore: { entries: { sealed: { enabled: true, constant: true } } } });
    expect(valueOf(out)).toBe(1);
  });

  it('fails the run on a write that is not a boolean, and every write with it', async () => {
    const out = await run('dictionaries.Lore.entries.Sealed.constant = true; dictionaries.Lore.entries.Sealed.enabled = "yes"; return 1;');
    expect(valueOf(out)).toBe(0);
    expect(out.loreWrites).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('dictionaries.Lore.entries.Sealed.enabled must be true or false'));
  });

  it('drops and lists a write through a name no entry or book has', async () => {
    const out = await run('dictionaries.Lore.entries.Nope.enabled = true; dictionaries.Atlas.entries.Map.constant = true; return 1;');
    expect(valueOf(out)).toBe(1);
    expect(out.loreWrites).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(
      'wrote dictionary entries the game does not have: dictionaries.Lore.entries.Nope.enabled, dictionaries.Atlas.entries.Map.constant',
    ));
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
      + ' return books.Lore.entries["Iron Crown"].value === "The old king’s crown." && Object.keys(books.Lore.entries).length === 3 ? 1 : 0;');
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
