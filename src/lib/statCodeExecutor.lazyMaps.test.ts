/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stat } from '@/types';
import { hostCalls } from '@/test/hostCalls';
import {
  executeStatCode, type SandboxEntity, type SandboxItem, type SandboxItemEvent, type SandboxLocation, type StatCodeRunOptions,
} from './statCodeExecutor';

vi.mock('./scriptSandbox', async (importOriginal) =>
  (await import('@/test/hostCalls')).countingSandbox(await importOriginal<typeof import('./scriptSandbox')>()));

const stat = (id: string, name: string, value: number): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });

/** A town of four residents and `count` items, two of them Rook's; the rest sit at the Dock. */
function town(count: number): StatCodeRunOptions {
  const entities: SandboxEntity[] = ['Mira', 'Rook', 'Tom', 'Ada'].map((name) => ({
    id: name.toLowerCase(), name, type: 'Townsfolk', traits: [], locationId: 'dock', stats: { stats: [stat(`${name}-mood`, 'Mood', 3)] },
  }));
  const items: SandboxItem[] = Array.from({ length: count }, (_, at) => ({
    id: `i${at}`, name: `Item ${at}`, instances: [{
      id: `c${at}`, where: at === 1 || at === 3 ? { kind: 'entity', id: 'rook' } : { kind: 'location', id: 'dock' },
      quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false,
    }],
  }));
  const locations: SandboxLocation[] = ['Dock', 'Mill', 'Hill'].map((name) => ({ id: name.toLowerCase(), name, description: `${name} text` }));
  return {
    randomSeed: [1, 2, 3, 4], entities, persona: entities[0], items, places: { locations, location: { id: 'dock', name: 'Dock' } },
    dictionaries: [
      { id: 'lore', name: 'Lore', entries: [{ id: 'tides', name: 'Tides', keys: ['tide'], value: 'Tides text', enabled: true, constant: false }] },
      { id: 'beasts', name: 'Bestiary', entries: [] },
    ],
    currencies: [{ id: 'coin', name: 'Coin', kind: 'name' }, { id: 'credits', name: 'Credits', kind: 'stat' }],
  };
}

const WORLD = town(8);
const ownStat = stat('s-day', 'Day', 1);

/** The run's host reads: every load of an entry, a table or a heavy text. */
const hostReads = () => hostCalls.filter((name) => name === '__formamorphHostRead').length;

/** `code` as a world Script over `options`; its reply and the host reads it made. */
async function run(code: string, options: StatCodeRunOptions = WORLD): Promise<{ reply: unknown; reads: number }> {
  hostCalls.length = 0;
  const result = await executeStatCode(code, [ownStat], null, { ...options, args: {} });
  if (result.error) throw new Error(result.error);
  return { reply: JSON.parse(result.reply ?? 'null'), reads: hostReads() };
}

/** `code` as Item 0's item Script on `event`'s args; its reply and the host reads it made. */
async function onItem(
  code: string, timing: SandboxItemEvent['timing'], args: Partial<SandboxItemEvent['args']>,
): Promise<{ reply: unknown; reads: number }> {
  hostCalls.length = 0;
  const itemEvent: SandboxItemEvent = { itemId: 'i0', timing, instanceId: 'c0', args: { quantity: 1, by: 'story', ...args } };
  const result = await executeStatCode(code, [ownStat], null, { ...WORLD, itemEvent, args: {} });
  if (result.error) throw new Error(result.error);
  return { reply: JSON.parse(result.reply ?? 'null'), reads: hostReads() };
}

describe('lazy items, locations, books and currencies', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('loads nothing for a Script that reads only its own stat', async () => {
    hostCalls.length = 0;
    const result = await executeStatCode('return self.value + 1;', [ownStat], ownStat, WORLD);
    expect({ value: result.value, reads: hostReads() }).toEqual({ value: 2, reads: 0 });
  });

  it('answers presence and identity without a load', async () => {
    expect(await run(`return ['Item 3' in items, 'Mill' in locations, 'Lore' in dictionaries, 'Coin' in currencies,
      items['Item 2'] === items['Item 2'], typeof locations.Hill];`)).toEqual({ reply: [true, true, true, true, true, 'object'], reads: 0 });
  });

  it.each([
    ['an item', 'items["Item 5"].id', 'i5'],
    ['a location', 'locations.Mill.name', 'Mill'],
    ['a book', 'dictionaries.Bestiary.id', 'beasts'],
    ['a currency', 'currencies.Credits.kind', 'stat'],
  ])('loads %s once, on its first read', async (_, read, value) => {
    expect(await run(`return [${read}, ${read}];`)).toEqual({ reply: [value, value], reads: 1 });
  });

  it.each(['items', 'locations', 'dictionaries', 'currencies'])('loads all of %s in one call for a listing', async (map) => {
    const { reads } = await run(`return [Object.keys(${map}).length, Object.values(${map}).length];`);
    expect(reads).toBe(1);
  });

  it('loads only the items an entity holds for its items', async () => {
    const code = 'return entities.Rook.items.map((entry) => entry.item);';
    const small = await run(code, town(8));
    const large = await run(code, town(40));
    // Rook's entry, then his two items.
    expect(small).toEqual({ reply: ['Item 1', 'Item 3'], reads: 3 });
    expect(large).toEqual(small);
  });

  it('reads an item event’s self and instance with no load', async () => {
    expect(await onItem('return [self.name, instance.id, instance.quantity];', 'gained', {})).toEqual({ reply: ['Item 0', 'c0', 1], reads: 0 });
  });

  it('finds an item event’s entity side with no listing of entities', async () => {
    const to = { kind: 'entity' as const, id: 'rook' };
    // The lookup itself loads nothing.
    expect(await onItem('return 1;', 'lost', { to })).toEqual({ reply: 1, reads: 0 });
    // Rook's entry loads on its read; Tom's is one more.
    expect(await onItem('return [args.to === entities.Rook, args.to.type, entities.Tom.type];', 'lost', { to }))
      .toEqual({ reply: [true, 'Townsfolk', 'Townsfolk'], reads: 2 });
  });

  it('finds an item event’s location side with no listing of locations', async () => {
    const from = { kind: 'location' as const, id: 'mill' };
    // The Mill's entry loads on its read; the Hill's is one more.
    expect(await onItem('return [args.from === locations.Mill, args.from.name, locations.Hill.name];', 'gained', { from }))
      .toEqual({ reply: [true, 'Mill', 'Hill'], reads: 2 });
  });

  it('finds an item event’s target instance, loading only its item', async () => {
    expect(await onItem('return [args.target === items["Item 6"].instances[0], args.target.item];', 'used', { target: 'c6' }))
      .toEqual({ reply: [true, 'Item 6'], reads: 1 });
  });
});
