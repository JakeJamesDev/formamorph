/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import type { OpeningKey } from './drawnOpening';
import { executeStatCode } from './statCodeExecutor';
import type { Entity, GameLocation, Stat, WorldOverview } from '@/types';

/** Test Code reads the Opening picked beside it as `opening`, None by default. */

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const HEALTH = { kind: 'globalStat', stat: health } as const;
const lamp = { id: 'ph-lamp', name: 'Lamp', values: phValues(['brass']) };
const chip = encodePlaceholderToken({ id: 'ph-lamp', mode: 'world', placementId: 'pl-lamp' });
const pell = {
  id: 'pell', name: 'Pell', traits: [],
  openings: [{ id: 'o1', name: 'lantern', text: `Pell lifts a ${chip} lantern.`, kind: 'narration', self: true, weather: 'rain' }],
} as unknown as Entity;
const harbor: GameLocation = { id: 'harbor', name: 'Harbor', isStarting: true, openings: [{ id: 'o1', text: 'Gulls cry.', kind: 'action', time: 'dawn' }] };
const world = {
  stats: [health], statGroups: [], traits: [], traitGroups: [], entities: [pell], entityGroups: [], placeholders: [lamp], placeholderGroups: [],
  dictionaries: [], locations: [harbor],
  worldOverview: { name: 'W', openings: [{ id: 'o1', text: 'The tide turns.', kind: 'action' }] } as unknown as WorldOverview,
} as StatCodeWorld & { locations: GameLocation[]; worldOverview: WorldOverview };

const read = (code: string, opening?: OpeningKey | null) =>
  runTestCode(code, 'after', HEALTH, world, { opening });

describe('Test Code’s opening', () => {
  it('reads null under None, the default', async () => {
    expect((await read('return opening === null ? 1 : 0;')).value).toBe(1);
    expect((await read('return opening === null ? 1 : 0;', null)).value).toBe(1);
  });

  it('reads the picked entity Opening, its chip filled in and its owner the entities entry', async () => {
    const code = `return opening.category === 'opening' && opening.name === 'lantern' && opening.kind === 'narration' && opening.self === true
      && opening.time === null && opening.weather === 'rain' && opening.text === 'Pell lifts a brass lantern.'
      && opening.owner === entities.Pell && opening.owner.category === 'entity' ? 1 : 0;`;
    expect(await read(code, { ownerId: 'pell', openingId: 'o1' })).toMatchObject({ error: null, value: 1 });
  });

  it('tells a location Opening from a world Opening by its owner', async () => {
    const code = 'return opening.owner === null ? 2 : opening.owner === locations.Harbor && opening.owner.category === "location" && opening.time === "dawn" ? 1 : 0;';
    expect((await read(code, { ownerId: null, openingId: 'o1', locationId: 'harbor' })).value).toBe(1);
    expect((await read(code, { ownerId: null, openingId: 'o1' })).value).toBe(2);
  });

  it('reads null for a pick whose Opening is gone', async () => {
    expect((await read('return opening === null ? 1 : 0;', { ownerId: 'pell', openingId: 'gone' })).value).toBe(1);
  });

  it('reads the played persona’s Opening with persona itself as owner', async () => {
    const aki = { id: 'aki', name: 'Aki', traits: [] };
    const opening = { id: 'o1', name: null, kind: 'action' as const, self: true, time: null, weather: null, text: 'Aki wakes.', owner: { category: 'entity' as const, id: 'aki' } };
    const result = await executeStatCode('return opening.owner === persona && opening.owner === entities.Aki ? 1 : 0;', [health], health, {
      entities: [aki], persona: aki, opening,
    });
    expect(result).toMatchObject({ value: 1, error: null });
  });

  it('drops and reports a write to one of its fields', async () => {
    const report = await read('opening.name = "ambush"; return opening.name === "lantern" ? 1 : 0;', { ownerId: 'pell', openingId: 'o1' });
    expect(report.value).toBe(1);
    expect(report.dropped.join(' ')).toContain('opening.name');
  });
});
