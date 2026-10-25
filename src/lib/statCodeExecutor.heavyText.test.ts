/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hostCalls } from '@/test/hostCalls';
import { executeStatCode, type SandboxDictionary, type SandboxEntity, type SandboxMemory, type StatCodeRunOptions } from './statCodeExecutor';

vi.mock('./scriptSandbox', async (importOriginal) =>
  (await import('@/test/hostCalls')).countingSandbox(await importOriginal<typeof import('./scriptSandbox')>()));

/** Text a transport can bend: escapes, separators, a lone surrogate, markup, a NUL, length. */
const TEXT = {
  mira: 'Quote " and \\ backslash, tab\there',
  miraSummary: 'Line\nbreak separator',
  wren: 'Emoji 🦊 and é',
  wrenSummary: 'Lone \ud800 surrogate',
  keeper: '</script><!-- markup -->',
  dock: 'x'.repeat(5000),
  dockSummary: 'NUL \u0000 inside',
  hill: 'Wind on the hill.',
  first: 'Mira left the Dock.',
  second: 'Oren lit a fire.',
  tides: 'The tide turns at dusk.',
  wreck: '{"looks":"like JSON"}',
};

const mira: SandboxEntity = { id: 'mira', name: 'Mira', traits: [], description: TEXT.mira, summary: TEXT.miraSummary, locationIds: ['dock'] };
const wren: SandboxEntity = { id: 'wren', name: 'Wren', traits: [], description: TEXT.wren, summary: TEXT.wrenSummary };
const keeper: SandboxEntity = { id: 'keeper', name: 'Keeper', traits: [], description: TEXT.keeper, summary: '' };

const memory = (id: string, text: string): SandboxMemory => ({
  id, turn: 1, timestamp: 1, day: 1, daypart: 'morning', text, custom: false, kept: true, inContext: true, pinned: false, forgotten: false,
});

const lore: SandboxDictionary = {
  name: 'Lore', id: 'lore', entries: [
    { id: 'tides', name: 'Tides', keys: ['tide'], value: TEXT.tides },
    { id: 'wreck', name: 'The Wreck', keys: ['wreck', 'ship'], value: TEXT.wreck },
  ],
};

const world: StatCodeRunOptions = {
  entities: [mira, wren], persona: wren, owner: keeper,
  places: {
    locations: [
      { id: 'dock', name: 'Dock', description: TEXT.dock, summary: TEXT.dockSummary, starting: true },
      { id: 'hill', name: 'Hill', description: TEXT.hill },
    ],
    location: { id: 'dock', name: 'Dock' },
  },
  memories: [memory('m1', TEXT.first), memory('m2', TEXT.second)],
  dictionaries: [lore, { name: 'Empty', id: 'empty', entries: [] }],
  args: {},
};

/** A World Tool run over the fixture world: its reply is the script's return value as JSON. */
const run = async (code: string, options: StatCodeRunOptions = {}) => {
  const result = await executeStatCode(code, [], null, { ...world, ...options });
  if (result.error) throw new Error(result.error);
  return result;
};
const read = async (code: string, options: StatCodeRunOptions = {}): Promise<unknown> => JSON.parse((await run(code, options)).reply ?? 'null');

const EVERY_HEAVY_FIELD = `return [
  entities.Mira.description, entities.Mira.summary, persona.description, persona.summary, owner.description, owner.summary,
  locations.Dock.description, locations.Dock.summary, location.description, location.summary, locations.Hill.description, locations.Hill.summary,
  memories[0].text, memories[1].text, dictionaries.Lore.entries.Tides.value, dictionaries.Lore.entries["The Wreck"].value,
];`;
const EVERY_HEAVY_VALUE = [
  TEXT.mira, TEXT.miraSummary, TEXT.wren, TEXT.wrenSummary, TEXT.keeper, '',
  TEXT.dock, TEXT.dockSummary, TEXT.dock, TEXT.dockSummary, TEXT.hill, '',
  TEXT.first, TEXT.second, TEXT.tides, TEXT.wreck,
];

describe('heavy text in the sandbox', () => {
  beforeEach(() => { hostCalls.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  describe('reads the string the host holds', () => {
    it('on every heavy field', async () => {
      expect(await read(EVERY_HEAVY_FIELD)).toEqual(EVERY_HEAVY_VALUE);
    });

    it('on every heavy field of a read-only run, which has no owner', async () => {
      expect(await read(EVERY_HEAVY_FIELD.replace(' owner.description, owner.summary,', ''), { readOnly: true }))
        .toEqual(EVERY_HEAVY_VALUE.filter((_, at) => at !== 4 && at !== 5));
    });

    it('through a whole-entry read, in key order', async () => {
      expect(await read(`return [
        Object.keys(entities.Mira), Object.keys(locations.Dock), Object.keys(location), Object.keys(memories[0]),
        Object.keys(dictionaries.Lore), Object.keys(dictionaries.Lore.entries), Object.keys(dictionaries.Lore.entries.Tides),
        JSON.stringify(memories[1]), JSON.stringify(dictionaries.Lore.entries.Tides), Object.values(locations.Hill).slice(0, 5),
      ];`)).toEqual([
        ['id', 'name', 'type', 'pronouns', 'inScene', 'location', 'following', 'description', 'summary', 'aliases', 'traits', 'placeholders', 'stats', 'move', 'follow', 'unfollow', 'diary'],
        ['id', 'name', 'description', 'summary', 'starting', 'present', 'parent', 'children', 'exits'],
        ['id', 'name', 'description', 'summary', 'starting', 'present', 'parent', 'children', 'exits', 'move'],
        ['id', 'turn', 'timestamp', 'day', 'daypart', 'text', 'custom', 'kept', 'inContext', 'pinned', 'forgotten'],
        ['id', 'name', 'entries', 'placeholders'],
        ['Tides', 'The Wreck'],
        ['id', 'name', 'keys', 'value'],
        JSON.stringify({ ...memory('m2', TEXT.second) }),
        JSON.stringify({ id: 'tides', name: 'Tides', keys: ['tide'], value: TEXT.tides }),
        ['hill', 'Hill', TEXT.hill, '', false],
      ]);
    });

    it('as accessors, as the locked fields were', async () => {
      expect(await read(`return [
        entities.Mira, locations.Dock, memories[0], dictionaries.Lore.entries.Tides,
      ].map((entry, at) => typeof Object.getOwnPropertyDescriptor(entry, ['description', 'summary', 'text', 'value'][at]).get);`))
        .toEqual(['function', 'function', 'function', 'function']);
    });

    it('as empty text on an unknown name', async () => {
      expect(await read(`return [
        entities.Nobody.description, entities.Nobody.summary, locations.Nowhere.description, locations.Nowhere.summary,
        Object.keys(dictionaries.Nope.entries).length, dictionaries.Lore.entries.Missing.value, Object.keys(dictionaries.Empty.entries).length,
      ];`)).toEqual(['', '', '', '', 0, '', 0]);
    });

    it('in a world with no location', async () => {
      expect(await read('return [location.description, location.summary];', { places: { locations: [], location: null } })).toEqual(['', '']);
    });
  });

  describe('resolves an entry value (Q54)', () => {
    const resolveEntryValue = (value: string) => value.replace('dusk', 'dawn');

    it('when code reads it, once', async () => {
      const resolve = vi.fn(resolveEntryValue);
      expect(await read('const e = dictionaries.Lore.entries; return [e.Tides.value, e.Tides.value];', { resolveEntryValue: resolve }))
        .toEqual(['The tide turns at dawn.', 'The tide turns at dawn.']);
      expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('never for a value code leaves unread', async () => {
      const resolve = vi.fn(resolveEntryValue);
      await read('return Object.keys(dictionaries.Lore.entries);', { resolveEntryValue: resolve });
      expect(resolve).not.toHaveBeenCalled();
    });

    it('and leaves the other heavy fields as the host holds them', async () => {
      expect(await read(EVERY_HEAVY_FIELD, { resolveEntryValue: () => 'resolved' }))
        .toEqual([...EVERY_HEAVY_VALUE.slice(0, -2), 'resolved', 'resolved']);
    });
  });

  it('drops and lists a write to a heavy field', async () => {
    const result = await run(`
      entities.Mira.description = 'x'; locations.Dock.summary = 'x'; location.description = 'x'; memories[0].text = 'x';
      dictionaries.Lore.entries.Tides.value = 'x';
      return [entities.Mira.description, locations.Dock.summary, location.description, memories[0].text, dictionaries.Lore.entries.Tides.value];`);
    expect(JSON.parse(result.reply ?? 'null')).toEqual([TEXT.mira, TEXT.dockSummary, TEXT.dock, TEXT.first, TEXT.tides]);
    expect(result.readOnlyWrites).toEqual(expect.arrayContaining([
      'entities.Mira.description', 'locations.Dock.summary', 'location.description', 'memories[0].text', 'dictionaries.Lore.entries.Tides.value',
    ]));
  });

  describe('asks the host', () => {
    it('never for a run that reads no heavy field', async () => {
      await read(`return [entities.Mira.name, locations.Dock.id, location.starting, memories[0].turn, dictionaries.Lore.id,
        Object.keys(entities), Object.keys(dictionaries)];`);
      expect(hostCalls).toEqual([]);
    });

    it('once for a field read twice', async () => {
      await read('return [entities.Mira.description, entities.Mira.description, memories[1].text, memories[1].text];');
      expect(hostCalls).toHaveLength(2);
    });

    it('once for one text two paths read', async () => {
      await read('return [location.description, locations.Dock.description];');
      expect(hostCalls).toHaveLength(1);
    });

    it('once for a book’s entries and once per value read', async () => {
      await read('const e = dictionaries.Lore.entries; return [e.Tides.value, e.Tides.value, Object.keys(dictionaries.Lore.entries)];');
      expect(hostCalls).toHaveLength(2);
    });
  });
});
