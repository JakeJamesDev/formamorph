/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { migrateWorld } from './version';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { inPlayBearers } from './ownedTraitsInPlay';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { phValues } from '@/test/placeholderValues';
import type { PersonaRef, Placeholder, PlayerStat, World } from '@/types';

const ph = (id: string, name: string, values: string[], over: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: phValues(values), ...over });

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 1000, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 1000, baseRegen: 0, aiMaxDelta: 0, ...over,
});

/**
 * A world as v3.1.2 saved it: its stat code reads every retired route. The world holds Hair › Shade and two
 * probes; Molly owns Eyes; the Weather book owns Sky. `Legacy` writes what each old route read into the
 * probes; `Current` writes the same readings through the current routes, in the same run.
 */
const released = {
  version: '3.1.2',
  worldOverview: { name: 'Released' },
  placeholders: [
    ph('hair', 'Hair', ['{{ph:shade:world:p-shade}}']),
    ph('shade', 'Shade', ['ash'], { ownerId: 'hair' }),
    ph('legacy-probe', 'LegacyProbe', ['unset']),
    ph('current-probe', 'CurrentProbe', ['unset']),
  ],
  entities: [{ id: 'molly', name: 'Molly', placeholders: [ph('eyes', 'Eyes', ['hazel'])] }],
  dictionaries: [{ id: 'weather', name: 'Weather', enabled: true, entries: [], placeholders: [ph('sky', 'Sky', ['grey'])] }],
  stats: [
    stat({
      id: 'legacy', name: 'Legacy',
      code: [
        'const me = stats.find(s => s.id === currentStatId);',
        "placeholders.LegacyProbe.pin([day, daypart, startDay, startDaypart,",
        '  placeholders.Molly.Eyes.value, placeholders.Eyes.value, placeholders.Shade.value, placeholders.Weather.Sky.value].join("/"));',
        "placeholders.Molly.Eyes.pin('green');",
        "return deltaHours * 100 + elapsedHours + me.value + (currentStatId === 'legacy' ? 1 : 0);",
      ].join('\n'),
    }),
    stat({
      id: 'current', name: 'Current',
      code: [
        'placeholders.CurrentProbe.pin([clock.day, clock.daypart, clock.previous.day, clock.previous.daypart,',
        '  entities.Molly.placeholders.Eyes.value, entities.Molly.placeholders.Eyes.value,',
        '  placeholders.Hair.Shade.value, dictionaries.Weather.placeholders.Sky.value].join("/"));',
        "return clock.deltaHours * 100 + clock.elapsedHours + self.value + (self.id === 'current' ? 1 : 0);",
      ].join('\n'),
    }),
  ],
};

const NO_PERSONA: PersonaRef = { source: 'none' };

/** One turn of the loaded world, run as play runs it. */
function playTurn(world: World) {
  const traits: StatCodeBearers = {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities: world.entities, library: [],
    world: {
      traits: [], groups: [], entities: world.entities, persona: NO_PERSONA,
      bearers: inPlayBearers({ traits: [], traitGroups: [], entities: world.entities }, NO_PERSONA, []),
    },
  };
  return runStatCodeTurn({
    stats: world.stats as PlayerStat[],
    enabled: {}, previous: [], asks: [], regenApplied: {}, clock: { deltaHours: 7, elapsedHours: 40 }, bearers: traits,
    placeholders: {
      placeholders: allPlaceholders(world), owners: placeholderOwners(world),
      dictionaries: world.dictionaries.map(({ id, name }) => ({ id, name })), rolls: { world: {} },
    },
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  } satisfies StatCodeTurn);
}

describe('a v3.1.2 world on the retired routes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('loads and runs with the readings and writes the current routes give', async () => {
    const out = await playTurn(migrateWorld(released));
    const pin = (id: string) => out.pinWrites[id];

    expect(pin('legacy-probe')).toBe(pin('current-probe'));
    expect(pin('legacy-probe')).toMatch(/^\d+\/\w+\/\d+\/\w+\/hazel\/hazel\/ash\/grey$/);
    // The owner path's pin lands on Molly's own placeholder.
    expect(pin('eyes')).toBe('green');
    expect(out.stats.map((s) => s.value)).toEqual([741, 741]);
  });

  it('fails to read anything through the retired routes without the load rewrite', async () => {
    const out = await playTurn(released as unknown as World);
    expect(out.stats.find((s) => s.id === 'legacy')?.value).toBe(0);
    expect(out.pinWrites['legacy-probe']).toBeUndefined();
  });
});
