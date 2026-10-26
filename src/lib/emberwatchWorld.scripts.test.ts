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
import { bundledWorldHarness, withValues, type StatValues } from '@/test/bundledWorldHarness';
import type { LoreToggles } from '@/types';

// The world as play reads it: each persona owns its copy of the Blueprint stats it links.
const authored = migrateWorld(JSON.parse(raw));
const played = JSON.stringify({ ...authored, ...playStatWorld({ ...authored, statGroups: authored.statGroups ?? [] }) });
const { world, gate, personaStats, turn } = bundledWorldHarness(played);
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
