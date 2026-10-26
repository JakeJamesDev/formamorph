/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/emberwatch.json?raw';
import { migrateWorld } from './version';
import { playStatWorld } from './statLinks';
import { settleDefaults } from './traitGates';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import { primeRolls, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { bundledWorldHarness, valueOf, withValues, type StatValues } from '@/test/bundledWorldHarness';
import { readWorldTools } from './tools/worldTools';
import { openWorldToolTurn } from './tools/worldToolTurn';
import { onCallRunner } from './tools/onCallRunner';
import { clockReading } from './gameClock';
import type { StatCodeTurnResult } from './statCodeTurn';
import type { SandboxMemory } from './statCodeExecutor';
import type { LoreToggles } from '@/types';

// The world as play reads it: each persona owns its copy of the Blueprint stats it links.
const authored = migrateWorld(JSON.parse(raw));
const played = JSON.stringify({ ...authored, ...playStatWorld({ ...authored, statGroups: authored.statGroups ?? [] }) });
const { world, gate, personaStats, turn, personaStatsOut } = bundledWorldHarness(played);
const start = settleDefaults(gate);
const locationNamed = (name: string) => world.locations.find((location) => location.name === name)!;
const entityNamed = (name: string) => world.entities.find((entity) => entity.name === name)!;

/** One After the AI turn of the played Wanderer, standing at `place`. */
const turnAt = (place: string, values: StatValues, loreToggles?: LoreToggles): StatCodeTurn => {
  const base = turn(start, { stats: withValues(personaStats(start), values) });
  const here = locationNamed(place);
  return {
    ...base,
    state: {
      ...base.state,
      places: { locations: world.locations, location: { id: here.id, name: here.name } },
      placeholders: { placeholders: world.placeholders ?? [], dictionaries: world.dictionaries, rolls: { world: {} } },
      loreToggles,
    },
  };
};

describe("the Founders' Pact script", () => {
  const book = world.dictionaries.find((dictionary) => dictionary.name === 'Emberwatch')!;
  const pact = book.entries.find((entry) => entry.name === "The Founders' Pact")!;
  const pactOn: LoreToggles = { [book.id]: { entries: { [pact.id]: { enabled: true } } } };

  /** The Founders' Pact writes after one turn at `renown`, with the entry on when `on`. */
  const pactWrites = async (renown: number, on = false) =>
    (await runStatCodeTurn({ ...turnAt('Emberwatch Keep', { Renown: renown }, on ? pactOn : undefined), worldScripts: world.scripts }))
      .loreWrites ?? [];

  it('ships the entry off', () => {
    expect(pact.enabled).toBe(false);
  });

  it('switches the entry on at Renown 70', async () => {
    expect(await pactWrites(70)).toEqual([{ book: book.id, entry: pact.id, field: 'enabled', value: true }]);
  });

  it('leaves the entry off below 70', async () => {
    expect(await pactWrites(69)).toEqual([]);
  });

  it('switches the entry off again when Renown falls below 70', async () => {
    expect(await pactWrites(69, true)).toEqual([{ book: book.id, entry: pact.id, field: 'enabled', value: false }]);
  });

  it('writes nothing while the entry already matches', async () => {
    expect(await pactWrites(85, true)).toEqual([]);
  });
});

describe('the Lost Sentry roll', () => {
  const sentry = world.placeholders!.find((placeholder) => placeholder.name === 'Lost Sentry')!;
  const mara = entityNamed('Mara Venn');
  const label = mara.relationships!.find((row) => row.targetId === entityNamed('Captain Orrin Blackwell').id)!.label;
  const garrison = world.dictionaries.find((dictionary) => dictionary.name === 'Emberwatch')!.entries.find((entry) => entry.name === 'The Garrison')!;
  const texts = [label, mara.aiDescription!, entityNamed('Sergeant Ilsa Marr').aiDescription!, garrison.value];

  it("names one sentry in Mara's label to the captain, her description, the sergeant's and the Garrison entry", () => {
    // Each fresh roll draws the next value, so two separate rolls would read differently.
    let draws = 0;
    const nextValue: PlaceholderPick = (values) => values[draws++ % values.length].text;
    const rolls = primeRolls(world.placeholders!, texts, {}, nextValue);
    const resolved = texts.map((text) => resolvePlaceholders(text, { placeholders: world.placeholders!, rolls }));
    const rolledName = sentry.values.map((value) => value.text).find((name) => resolved[0].includes(name));
    expect(rolledName).toBeDefined();
    for (const text of resolved) expect(text).toContain(rolledName);
  });
});

describe('the offer_prayer World Tool', () => {
  const { tools, dropped } = readWorldTools(world.tools);
  const offerPrayer = tools.find((tool) => tool.name === 'offer_prayer')!;
  const failIfFallback = () => { throw new Error('offer_prayer is a World Tool.'); };
  // Two story days: the second starts a day after the first.
  const DAY_ONE_HOURS = 10;
  const DAY_TWO_HOURS = DAY_ONE_HOURS + 24;

  /** A Memory panel row from story `hours`. */
  const memoryAt = (text: string, hours: number): SandboxMemory => ({
    id: text, turn: 1, timestamp: hours, day: clockReading(hours).day, daypart: clockReading(hours).daypart, text,
    custom: false, kept: false, inContext: true, pinned: false, forgotten: false,
  });

  /** One On Call run of offer_prayer at `place` and story `hours`, over the memories earlier turns left. */
  async function pray(place: string, { faith = 50, hours = DAY_ONE_HOURS, memories = [] as SandboxMemory[], intention = 'strength' } = {}) {
    let landed: StatCodeTurnResult | undefined;
    const runner = onCallRunner(() => {
      const base = turnAt(place, { Faith: faith });
      return { turn: { ...base, state: { ...base.state, clock: { elapsedHours: hours }, memories } }, land: (result) => { landed = result; } };
    });
    const execute = openWorldToolTurn(tools, runner).executor(failIfFallback);
    const reply = await execute(offerPrayer, JSON.stringify(intention ? { intention } : {}), new AbortController().signal);
    return { reply: reply.text, faith: landed && valueOf(personaStatsOut(landed), 'Faith'), memory: landed?.worldWrites?.memory ?? [] };
  }

  it('loads as an On Call Tool offered to the stat pass, one call a request', () => {
    expect(dropped).toEqual([]);
    expect(offerPrayer.handler).toMatchObject({ kind: 'script', timing: 'call' });
    expect(offerPrayer.offeredTo).toEqual(['statUpdates']);
    expect(offerPrayer.callLimit).toBe(1);
  });

  it('raises Faith by 10 at the chapel and keeps the prayer as a memory', async () => {
    const { faith, memory, reply } = await pray('Chapel of the Ember');
    expect(faith).toBe(60);
    expect(memory).toHaveLength(1);
    expect(memory[0]).toContain("prayed at the Ember's brazier for strength");
    expect(reply).toContain('Faith is now 60');
  });

  it('keeps a plain memory when the AI sends no intention', async () => {
    const { memory } = await pray('Chapel of the Ember', { intention: '' });
    expect(memory[0]).toMatch(/prayed at the Ember's brazier\.$/);
  });

  it('changes nothing away from the chapel', async () => {
    const { faith, memory } = await pray('Ashford Square');
    expect(faith).toBe(50);
    expect(memory).toEqual([]);
  });

  it('answers one prayer a day', async () => {
    // The memory the morning's prayer added, as the Memory panel holds it later that day.
    const morning = await pray('Chapel of the Ember', { hours: DAY_ONE_HOURS - 2 });
    const earlier = morning.memory.map((text) => memoryAt(text, DAY_ONE_HOURS - 2));
    expect(earlier).toHaveLength(1);
    const sameDay = await pray('Chapel of the Ember', { memories: earlier });
    expect(sameDay.faith).toBe(50);
    expect(sameDay.memory).toEqual([]);
    expect(sameDay.reply).toContain('already answered');
    const nextDay = await pray('Chapel of the Ember', { memories: earlier, hours: DAY_TWO_HOURS });
    expect(nextDay.faith).toBe(60);
  });
});
