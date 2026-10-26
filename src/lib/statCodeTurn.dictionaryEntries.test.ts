/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playthroughPlaceholderSet, runStatCodeTurn } from './statCodeTurn';
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

describe('dictionaries book enabled (Q33, Q36, Q37, Q40)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const chapter: Dictionary = { id: 'chapter', name: 'Chapter', enabled: false, entries: [entry('c', 'Seal', ['seal'], 'Shut.')] };
  const almanac: Dictionary = { id: 'almanac-copy', name: 'Almanac', enabled: true, entries: [entry('star', 'Star', ['star'], 'Bright.')] };

  /** A run on a playthrough whose save holds `runtime` from the world's `lore`, `muted` and `chapter`. */
  const playRun = (code: string, runtime: readonly Dictionary[], loreToggles?: LoreToggles) =>
    runStatCodeTurn(statCodeTurnOf({
      ...(loreToggles && { loreToggles }),
      stats: [stat({ id: 's0', name: 'S0', value: 0, scripts: boxScripts({ after: code }) })],
      enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, ownerTraits: nobody,
      placeholders: playthroughPlaceholderSet({
        placeholders: [], dictionaries: [lore, muted, chapter], libraryDictionaries: runtime.filter((book) => book === almanac),
        rolls: { world: {} }, runtimeDictionaries: runtime,
      }),
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    }));

  it('lists a book the world ships off as off, leaves out one the player turned off, and lists a library book as on', async () => {
    const out = await playRun('return Object.keys(dictionaries).map((n) => n + ":" + dictionaries[n].enabled).join("|")'
      + ' === "Lore:true|Chapter:false|Almanac:true" ? 1 : 0;', [lore, almanac]);
    expect(valueOf(out)).toBe(1);
  });

  it('lists a shipped-off book the player switched on at entry as on', async () => {
    const out = await playRun('return dictionaries.Chapter.enabled ? 1 : 0;', [lore, { ...chapter, enabled: true }]);
    expect(valueOf(out)).toBe(1);
  });

  it('lands book writes both ways and reads them back in the run', async () => {
    const out = await playRun('dictionaries.Chapter.enabled = true; dictionaries.Lore.enabled = false; dictionaries.Almanac.enabled = false;'
      + ' return dictionaries.Chapter.enabled && !dictionaries.Lore.enabled ? 1 : 0;', [lore, almanac]);
    expect(valueOf(out)).toBe(1);
    expect(out.loreWrites).toEqual([
      { book: 'lore', field: 'enabled', value: false },
      { book: 'chapter', field: 'enabled', value: true },
      { book: 'almanac-copy', field: 'enabled', value: false },
    ]);
  });

  it('reads a book as the lore overlay leaves it', async () => {
    const out = await playRun('return dictionaries.Chapter.enabled && !dictionaries.Lore.enabled ? 1 : 0;', [lore],
      { chapter: { enabled: true }, lore: { enabled: false } });
    expect(valueOf(out)).toBe(1);
  });

  it('fails the run on a book write that is not a boolean', async () => {
    const out = await playRun('dictionaries.Chapter.enabled = 1; return 1;', [lore]);
    expect(valueOf(out)).toBe(0);
    expect(out.loreWrites).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('dictionaries.Chapter.enabled must be true or false'));
  });

  it('drops and lists a write to a book the player turned off', async () => {
    const out = await playRun('dictionaries.Muted.enabled = true; return 1;', [lore]);
    expect(valueOf(out)).toBe(1);
    expect(out.loreWrites).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('dictionaries.Muted.enabled'));
  });

  it('reads the authored flag where no Enter World ran (Q51)', async () => {
    const out = await runStatCodeTurn(statCodeTurnOf({
      stats: [stat({ id: 's0', name: 'S0', value: 0, scripts: boxScripts({ after:
        'return [dictionaries.Lore.enabled, dictionaries.Chapter.enabled].join("|") === "true|false" ? 1 : 0;' }) })],
      enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, ownerTraits: nobody,
      placeholders: { placeholders: [], dictionaries: [lore, chapter], rolls: { world: {} } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    }));
    expect(valueOf(out)).toBe(1);
  });
});
