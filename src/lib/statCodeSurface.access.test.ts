/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 *
 * The access a card's badge reads, held against the sandbox: every field write runs, and a field is
 * writable exactly when the host receives the write.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode, type SandboxEntity, type StatCodeResult } from './statCodeExecutor';
import { SANDBOX_GLOBALS, STAT_FIELDS, TRAIT_ENTRY_FIELDS, placeholderEntryFields } from './statCodeSurface';
import type { SurfaceEntry } from './codeSurface';
import { runToolScript } from './tools/toolScript';
import { toolScriptSurface } from './tools/toolScriptSurface';
import { sampleToolSnapshot } from './tools/sampleToolSnapshot';
import { phNode } from '@/test/sandboxPlaceholders';
import type { Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over,
});

const gold = makeStat({ id: 'g', name: 'Gold', value: 5 });
const rage = makeStat({ id: 'r', name: 'Rage', value: 10 });
const stock = makeStat({ id: 'k', name: 'Stock', value: 12 });
const grit = makeStat({ id: 'gr', name: 'Grit', value: 3 });
const nerve = makeStat({ id: 'n', name: 'Nerve', value: 4 });
const brave = { name: 'Brave', enabled: true, acquired: true, id: 'brave' };
const bram: SandboxEntity = { id: 'bram', name: 'Bram', traits: [brave], stats: { stats: [rage, stock] } };
const mara: SandboxEntity = { id: 'mara', name: 'Mara', traits: [brave], stats: { stats: [grit] } };
const pat: SandboxEntity = { id: 'pat', name: 'Pat', traits: [], stats: { stats: [nerve] } };

/** Runs `code` as Bram's Rage, every route to a stat in reach. */
const run = (code: string) => executeStatCode(code, [gold], rage, {
  entities: [bram, mara, pat], owner: bram, persona: pat, traits: [brave], placeholders: [phNode('Mood', 'calm')],
});

/** A value of the field's own type that differs from what it holds. */
const sample = (entry: SurfaceEntry) =>
  ({ number: '7', string: '"x"', boolean: 'false' } as Record<string, string>)[entry.detail] ?? '{}';

const statLanded = (out: StatCodeResult) =>
  out.value !== null || !!out.bounds || out.hidden !== undefined || !!out.statWrites || !!out.ownerStatWrites;
const traitLanded = (out: StatCodeResult) => !!out.traits || !!out.entities?.some((entity) => entity.traits);

/** The fields that carry an access, by whether a write reaches them as the badge says. */
const fieldsOf = (entries: readonly SurfaceEntry[]) => entries.filter((entry) => entry.access).map((entry) => [entry.name, entry] as const);

describe('stat field access matches the sandbox', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const routes = ['self', 'stats.Gold', 'owner.stats.Stock', 'entities.Mara.stats.Grit', 'persona.stats.Nerve'];

  it.each(fieldsOf(STAT_FIELDS))('%s', async (name, entry) => {
    for (const route of routes) {
      const out = await run(`${route}.${name} = ${sample(entry)};`);
      expect(statLanded(out), `${route}.${name}`).toBe(entry.access === 'writable');
    }
  });

  it('writes value, min, max, regen and hidden on every route', () => {
    expect(STAT_FIELDS.filter((entry) => entry.access === 'writable').map((entry) => entry.name).sort())
      .toEqual(['hidden', 'max', 'min', 'regen', 'value']);
  });
});

describe('trait field access matches the sandbox', () => {
  it.each(fieldsOf(TRAIT_ENTRY_FIELDS))('%s', async (name, entry) => {
    for (const route of ['traits.Brave', 'entities.Mara.traits.Brave']) {
      const out = await run(`${route}.${name} = ${sample(entry)};`);
      expect(traitLanded(out), `${route}.${name}`).toBe(entry.access === 'afterRun');
    }
  });
});

describe('placeholder field access matches the sandbox', () => {
  it.each(fieldsOf(placeholderEntryFields('Wildcard')))('%s', async (name, entry) => {
    const out = await run(`placeholders.Mood.${name} = "stormy";`);
    expect(!!out.placeholders, name).toBe(entry.access === 'afterRun');
  });
});

describe('Tool script access matches the sandbox', () => {
  const surface = toolScriptSurface([{ name: 'size', type: 'number', description: '', required: true, options: [] }]);
  it.each(surface.globals.filter((entry) => entry.access).map((entry) => [entry.name, entry] as const))('%s', async (name, entry) => {
    // A frozen object drops the write; reading it back says whether it landed.
    const code = `${name}.probe = 1; return ${name}.probe === 1 ? "landed" : "dropped";`;
    const out = await runToolScript(code, { size: 2 }, sampleToolSnapshot());
    expect(out).toMatchObject({ text: entry.access === 'readOnly' ? 'dropped' : 'landed' });
  });

  // Both run on one sandbox, so a stat-script global must not reach a Tool script.
  const toolNames = new Set(surface.globals.map((entry) => entry.name));
  const statOnly = SANDBOX_GLOBALS.map((entry) => entry.name).filter((name) => !toolNames.has(name));
  it('has stat-script globals to hold out', () => expect(statOnly.sort()).toEqual(['discover', 'owner', 'self']));
  it.each(statOnly)('%s is undefined in a Tool script', async (name) => {
    expect(await runToolScript(`return typeof ${name};`, { size: 2 }, sampleToolSnapshot())).toEqual({ text: 'undefined' });
  });
});
