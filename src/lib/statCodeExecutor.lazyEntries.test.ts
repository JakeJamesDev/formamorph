/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity, Placeholder, Stat } from '@/types';
import { hostCalls } from '@/test/hostCalls';
import { phValues } from '@/test/placeholderValues';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { sandboxPlaceholders } from './statCodePlaceholders';
import { executeStatCode, type SandboxEntity, type StatCodeRunOptions } from './statCodeExecutor';

vi.mock('./scriptSandbox', async (importOriginal) =>
  (await import('@/test/hostCalls')).countingSandbox(await importOriginal<typeof import('./scriptSandbox')>()));

const stat = (id: string, name: string, value: number): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });
const ph = (id: string, name: string, values: readonly string[]): Placeholder => ({ id, name, values: phValues(values) });

/** A world of `count` residents, each owning three placeholders, with two world-owned rows. Resident 0 owns the run. */
function residents(count: number): { options: StatCodeRunOptions; owner: SandboxEntity } {
  const ids = Array.from({ length: count }, (_, at) => `r${at}`);
  const world = {
    placeholders: [ph('mood', 'Mood', ['calm']), ph('weather', 'Weather', ['rain'])],
    entities: ids.map((id, at) => ({
      id, name: `Resident ${at}`, traits: [],
      placeholders: [ph(`${id}-hair`, 'Hair', ['red']), ph(`${id}-eyes`, 'Eyes', ['gray']), ph(`${id}-scar`, 'Scar', ['jaw'])],
    })) as Entity[],
  };
  const tree = sandboxPlaceholders({ placeholders: allPlaceholders(world), owners: placeholderOwners(world), rolls: {}, pick: (values) => values[0]?.text ?? '' });
  const entities: SandboxEntity[] = ids.map((id, at) => ({
    id, name: `Resident ${at}`, type: 'Townsfolk', description: `Resident ${at} text`,
    traits: [{ id: `${id}-t`, name: 'Quirk', enabled: true, acquired: true }],
    placeholders: tree.owners.get(id), stats: { stats: [stat(`${id}-mood`, 'Mood', at)] },
  }));
  return { options: { placeholders: tree.top, entities, persona: entities[1], owner: entities[0], randomSeed: [1, 2, 3, 4] }, owner: entities[0] };
}

const { options: WORLD, owner: OWNER } = residents(6);
const ownerStat = OWNER.stats!.stats[0];

/** The run's host reads: every load of an entry, a placeholder subtree or a heavy text. */
const hostReads = () => hostCalls.filter((name) => name === '__formamorphHostRead').length;

/** `code` as `ownerStat`'s Script over `options`; its value and the host reads it made. */
async function run(code: string, options: StatCodeRunOptions = WORLD): Promise<{ value: number | null; reads: number }> {
  hostCalls.length = 0;
  const result = await executeStatCode(code, [], ownerStat, options);
  if (result.error) throw new Error(result.error);
  return { value: result.value, reads: hostReads() };
}

/** `code` as a read-only Tool run; its reply and the host reads it made. */
async function tool(code: string): Promise<{ reply: unknown; reads: number }> {
  hostCalls.length = 0;
  const result = await executeStatCode(code, [], null, { ...WORLD, owner: undefined, readOnly: true, args: {} });
  if (result.error) throw new Error(result.error);
  return { reply: JSON.parse(result.reply ?? 'null'), reads: hostReads() };
}

describe('lazy entities and placeholders', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  describe('an entry costs nothing until read', () => {
    it('loads no entity or placeholder for a self-only Script', async () => {
      expect(await run('return self.value + 1;')).toEqual({ value: 1, reads: 0 });
    });

    it('answers presence, type and identity without a load', async () => {
      const { value, reads } = await run(`return ['Resident 2' in entities, typeof entities['Resident 3'], entities['Resident 4'] === entities['Resident 4'],
        owner === entities['Resident 0'], persona === entities['Resident 1'], 'Mood' in placeholders, typeof placeholders.Weather]
        .every((ok) => ok === true || ok === 'object') ? 7 : 0;`);
      expect({ value, reads }).toEqual({ value: 7, reads: 0 });
    });

    it('reads owner.stats without loading the owner', async () => {
      expect(await run('return owner.stats.Mood.value + 2;')).toEqual({ value: 2, reads: 0 });
    });
  });

  describe('an entity entry', () => {
    it('loads once on its first field read', async () => {
      expect((await run("return entities['Resident 3'].type.length;")).reads).toBe(1);
    });

    it('stays loaded for a second read', async () => {
      expect((await run("const e = entities['Resident 3']; return e.type.length + e.traits.Quirk.enabled + e.stats.Mood.value;")).reads).toBe(1);
    });

    it('loads the owner once whichever path reads it', async () => {
      expect(await run("return owner.traits.Quirk.enabled + entities['Resident 0'].stats.Mood.value;")).toEqual({ value: 1, reads: 1 });
    });
  });

  describe('a listing', () => {
    it('loads the whole map in one call', async () => {
      expect(await run('return Object.keys(entities).length;')).toEqual({ value: 6, reads: 1 });
    });

    it('loads the entries left in that one call, then reads them all', async () => {
      const { value, reads } = await run("entities['Resident 2'].type; return Object.values(entities).filter((e) => e.type === 'Townsfolk').length;");
      expect({ value, reads }).toEqual({ value: 6, reads: 2 });
    });

    it('makes no call once every entry is in', async () => {
      const each = Array.from({ length: 6 }, (_, at) => `entities['Resident ${at}'].type;`).join(' ');
      expect((await run(`${each} return Object.keys(entities).length;`)).reads).toBe(6);
    });

    it('loads the world rows left in one call, then reads them all', async () => {
      const { value, reads } = await run("placeholders.Mood.value; return Object.values(placeholders).map((row) => row.text).join() === 'calm,rain' ? 4 : 0;");
      expect({ value, reads }).toEqual({ value: 4, reads: 2 });
    });

    it('loads every world placeholder row in one call', async () => {
      expect(await run('return Object.values(placeholders).filter((row) => row.value).length;')).toEqual({ value: 2, reads: 1 });
    });
  });

  describe('a placeholder root', () => {
    it('loads one world row on its first read', async () => {
      expect(await run("return placeholders.Mood.value === 'calm' && placeholders.Mood.text === 'calm' ? 3 : 0;")).toEqual({ value: 3, reads: 1 });
    });

    it('loads only the owner’s node for owner.placeholders, whatever the cast size', async () => {
      const code = 'return Object.keys(owner.placeholders).length + owner.placeholders.Hair.text.length;';
      const small = await run(code);
      const large = await run(code, residents(24).options);
      expect(small).toEqual({ value: 6, reads: 2 });
      expect(large).toEqual(small);
    });
  });

  describe('writes through entries loaded out of order', () => {
    it('read back in map order, as one build of every entry gives them', async () => {
      const bare = (id: string, name: string): SandboxEntity => ({
        id, name, traits: [{ id: `${id}-t`, name: 'Quirk', enabled: false, acquired: true }], stats: { stats: [stat(`${id}-s`, 'Mood', 1)] },
      });
      const result = await executeStatCode(`
        for (const name of ['Cole', 'Ada']) {
          entities[name].placeholders.Hair = 'red';
          entities[name].traits.Quirk.enabled = true;
          entities[name].stats.Mood.value = 9;
        }`, [], null, { entities: [bare('ada', 'Ada'), bare('bo', 'Bo'), bare('cole', 'Cole')], randomSeed: [1, 2, 3, 4] });
      expect(result.unknownPlaceholders).toEqual(['Ada › Hair', 'Cole › Hair']);
      expect(result.entities?.map((row) => row.entity)).toEqual(['Ada', 'Cole']);
      expect(result.ownerStatWrites?.map((row) => row.ownerId)).toEqual(['ada', 'cole']);
    });
  });

  describe('a read-only Tool run', () => {
    it('reads one entity through its view without loading the others', async () => {
      expect(await tool("return [entities['Resident 4'].type, 'Resident 5' in entities, persona.traits.Quirk.enabled];"))
        .toEqual({ reply: ['Townsfolk', true, true], reads: 2 });
    });

    it('lists through its view in one call', async () => {
      expect(await tool('return Object.keys(entities).length;')).toEqual({ reply: 6, reads: 1 });
    });
  });
});
