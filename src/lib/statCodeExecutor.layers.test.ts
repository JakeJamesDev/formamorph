/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaList, MediaOverrides, Stat, StatRequirement } from '@/types';
import { executeStatCode, type SandboxEntity, type SandboxItem, type StatCodeRunOptions } from './statCodeExecutor';
import { sandboxMediaOf } from './sandboxMedia';
import { withMediaWrites } from './mediaOverrides';
import type { GateInput } from './traitGates';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const low: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'raw' };

// Wren Rig: Body always shows Base; Hat shows Hood while the bearer's Health is below 20, else Cap.
const list: MediaList = {
  'm-base': { id: 'm-base', name: 'Base', kind: 'image', data: 'base' },
  'm-hood': { id: 'm-hood', name: 'Hood', kind: 'image', data: 'hood' },
  'm-cap': { id: 'm-cap', name: 'Cap', kind: 'image', data: 'cap' },
  'm-calm': { id: 'm-calm', name: 'Calm', kind: 'image', data: 'calm' },
  'm-rain': { id: 'm-rain', name: 'Rain', kind: 'sound', data: 'rain' },
  rig: {
    id: 'rig', name: 'Wren Rig', kind: 'layered', layers: [
      { id: 'l-body', name: 'Body', tint: '#336699', variants: [{ mediaId: 'm-base' }] },
      { id: 'l-hat', name: 'Hat', opacity: 0.8, variants: [{ mediaId: 'm-hood', requires: [{ all: [low] }] }, { mediaId: 'm-cap' }] },
    ],
  },
  wolf: { id: 'wolf', name: 'Wolf Rig', kind: 'layered', layers: [{ id: 'l-fur', name: 'Fur', variants: [{ mediaId: 'm-base' }] }] },
};

// Wren is hurt (Health 10); the Guard is healthy, so its own rig shows the Cap.
const gate: GateInput = {
  global: { traits: [], groups: [] }, owners: [], active: { global: [], owners: {} },
  stats: { global: {}, owners: { 'e-wren': { health: { name: 'Health', value: 10, min: 0, max: 100 } }, 'e-guard': { health: { name: 'Health', value: 90, min: 0, max: 100 } } } },
  entities: [{ id: 'e-wren', name: 'Wren' }, { id: 'e-guard', name: 'Guard' }], persona: { source: 'none' },
};

const rigged = [{ mediaId: 'rig' }];

const mediaWith = (overrides: MediaOverrides = {}, personaId?: string) => sandboxMediaOf({
  list, overrides, personaId,
  entities: [{ id: 'e-wren', images: rigged }, { id: 'e-guard', images: rigged }, { id: 'e-mira', images: [{ mediaId: 'm-calm' }] }],
  locations: [{ id: 'l-gate', images: rigged }],
  items: [{ id: 'i-cloak', images: rigged }],
  itemInstances: [
    { id: 'c-1', item: { kind: 'item', itemId: 'i-cloak' }, where: { kind: 'entity', id: 'e-wren' }, quantity: 1, visibility: 'visible' },
    { id: 'c-2', item: { kind: 'item', itemId: 'i-cloak' }, where: { kind: 'entity', id: 'e-guard' }, quantity: 1, visibility: 'visible' },
  ],
  music: undefined,
  gate: () => gate,
  generics: { 'e-guard': { 's-north': { position: 'l-gate', lastRun: 0 }, 's-south': { lastRun: 0 } } },
});

const wren: SandboxEntity = { id: 'e-wren', name: 'Wren', traits: [] };
const guard: SandboxEntity = { id: 'e-guard', name: 'Guard', traits: [], kind: 'generic' };
const mira: SandboxEntity = { id: 'e-mira', name: 'Mira', traits: [] };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };

const cloak: SandboxItem = {
  id: 'i-cloak', name: 'Cloak', instances: [
    { id: 'c-1', where: { kind: 'entity', id: 'e-wren' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
    { id: 'c-2', where: { kind: 'entity', id: 'e-guard' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
  ],
};

const places = { locations: [{ id: 'l-gate', name: 'Gate' }], location: { id: 'l-gate', name: 'Gate' } };

const run = (code: string, overrides?: MediaOverrides, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { entities: [wren, guard, mira, hero], persona: hero, items: [cloak], places, media: mediaWith(overrides), ...over });

describe('executeStatCode Layer members', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads what each Layer shows by the rules for its own subject, with the authored opacity and no tint', async () => {
    const res = await run(`
      const hat = entities.Wren.layers.Hat;
      if (hat.variant !== 'Hood' || hat.opacity !== 0.8 || hat.tint !== null) throw new Error('wren ' + JSON.stringify(hat));
      if (entities.Wren.layers.Body.variant !== 'Base' || entities.Wren.layers.Body.tint !== '#336699') throw new Error('body');
      if (entities.Guard.layers.Hat.variant !== 'Cap') throw new Error('guard ' + entities.Guard.layers.Hat.variant);
      if (entities.Wren.image !== 'Wren Rig') throw new Error('image ' + entities.Wren.image);
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toBeUndefined();
  });

  it('lists each write by Layer id and reads it back in the run, beating the rules', async () => {
    const res = await run(`
      const hat = entities.Wren.layers.Hat;
      hat.variant = 'Cap';
      hat.opacity = 0.5;
      hat.tint = '#ff8800';
      if (hat.variant !== 'Cap' || hat.opacity !== 0.5 || hat.tint !== '#ff8800') throw new Error('read back ' + JSON.stringify(hat));
      locations.Gate.layers.Hat.opacity = 0;
      items.Cloak.instances[1].layers.Hat.variant = 'Hood';
    `);
    expect(res.error).toBeNull();
    const wrenOwner = { kind: 'entity', id: 'e-wren' };
    expect(res.mediaWrites).toEqual([
      { owner: wrenOwner, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-cap' },
      { owner: wrenOwner, entryId: 'rig', layerId: 'l-hat', field: 'opacity', value: 0.5 },
      { owner: wrenOwner, entryId: 'rig', layerId: 'l-hat', field: 'tint', value: '#ff8800' },
      { owner: { kind: 'location', id: 'l-gate' }, entryId: 'rig', layerId: 'l-hat', field: 'opacity', value: 0 },
      { owner: { kind: 'item', id: 'c-2' }, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-hood' },
    ]);
  });

  it('reads a saved setting over the rules, and null clears it back to the rules and the authored values', async () => {
    const saved = withMediaWrites({}, [
      { owner: { kind: 'entity', id: 'e-wren' }, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-cap' },
      { owner: { kind: 'entity', id: 'e-wren' }, entryId: 'rig', layerId: 'l-hat', field: 'opacity', value: 0.3 },
    ]);
    const res = await run(`
      const hat = entities.Wren.layers.Hat;
      if (hat.variant !== 'Cap' || hat.opacity !== 0.3) throw new Error('saved ' + JSON.stringify(hat));
      hat.variant = null;
      hat.opacity = null;
      if (hat.variant !== 'Hood' || hat.opacity !== 0.8) throw new Error('cleared ' + JSON.stringify(hat));
    `, saved);
    expect(res.error).toBeNull();
    expect(res.mediaWrites?.map((write) => ('value' in write ? write.value : write.mediaId))).toEqual([null, null]);
  });

  it('treats a saved Variant the Layer no longer holds as unset', async () => {
    const saved = withMediaWrites({}, [{ owner: { kind: 'entity', id: 'e-wren' }, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-calm' }]);
    const res = await run(`if (entities.Wren.layers.Hat.variant !== 'Hood') throw new Error(entities.Wren.layers.Hat.variant);`, saved);
    expect(res.error).toBeNull();
  });

  it('stops on a Layer the shown rig lacks, and on a subject that shows no Layered Image, naming it', async () => {
    const missing = await run(`entities.Wren.layers.Hats.variant = 'Cap';`);
    expect(missing.error).toContain('The Layered Image "Wren Rig" has no Layer "Hats"');
    const plain = await run(`entities.Mira.layers.Hat.opacity = 1;`);
    expect(plain.error).toContain('entities.Mira shows no Layered Image, so it has no Layer "Hat"');
  });

  it('stops on an image that is not one of the Layer’s Variants, naming it', async () => {
    const res = await run(`entities.Wren.layers.Hat.variant = 'Calm';`);
    expect(res.error).toContain('The Layer "Hat" has no image named "Calm"');
    expect(res.mediaWrites).toBeUndefined();
  });

  it('refuses an opacity outside 0 to 1, or a tint that is not a color, without clamping', async () => {
    for (const code of [
      `entities.Wren.layers.Hat.opacity = 1.5;`, `entities.Wren.layers.Hat.opacity = -0.1;`, `entities.Wren.layers.Hat.opacity = '0.5';`,
      `entities.Wren.layers.Hat.tint = 'red';`, `entities.Wren.layers.Hat.tint = 7;`,
    ]) {
      const res = await run(code);
      expect(res.error, code).toMatch(/entities\.Wren\.layers\["Hat"\]\.(opacity|tint) must be/);
      expect(res.mediaWrites, code).toBeUndefined();
    }
  });

  it('stores a tint as lowercase #rrggbb, a short form expanded', async () => {
    const res = await run(`
      entities.Wren.layers.Hat.tint = '#F80';
      if (entities.Wren.layers.Hat.tint !== '#ff8800') throw new Error(entities.Wren.layers.Hat.tint);
      entities.Wren.layers.Body.tint = '#3FA36B';
      if (entities.Wren.layers.Body.tint !== '#3fa36b') throw new Error('set ' + entities.Wren.layers.Body.tint);
      entities.Wren.layers.Body.tint = null;
      if (entities.Wren.layers.Body.tint !== '#336699') throw new Error('authored ' + entities.Wren.layers.Body.tint);
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites?.map((write) => ('value' in write ? write.value : null))).toEqual(['#ff8800', '#3fa36b', null]);
  });

  it('keeps each Generic Entity Instance apart, an instance setting beating the entity-wide one field by field', async () => {
    const saved = withMediaWrites({}, [
      { owner: { kind: 'entity', id: 'e-guard' }, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-hood' },
      { owner: { kind: 'entity', id: 'e-guard' }, entryId: 'rig', layerId: 'l-hat', field: 'opacity', value: 0.4 },
    ]);
    const res = await run(`
      const [north, south] = entities.Guard.instances;
      north.layers.Hat.variant = 'Cap';
      if (north.layers.Hat.variant !== 'Cap' || north.layers.Hat.opacity !== 0.4) throw new Error('north ' + JSON.stringify(north.layers.Hat));
      if (south.layers.Hat.variant !== 'Hood') throw new Error('south ' + south.layers.Hat.variant);
      if (entities.Guard.layers.Hat.variant !== 'Hood') throw new Error('entity ' + entities.Guard.layers.Hat.variant);
    `, saved);
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toEqual([
      { owner: { kind: 'instance', entityId: 'e-guard', startId: 's-north' }, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-cap' },
    ]);
  });

  it('reads the entity-wide Variant under an instance Variant the Layer no longer holds (Q32)', async () => {
    const res = await run(`
      const [north] = entities.Guard.instances;
      if (north.layers.Hat.variant !== 'Hood') throw new Error('north ' + north.layers.Hat.variant);
    `, {
      layers: {
        entities: { 'e-guard': { rig: { 'l-hat': { variant: 'm-hood' } } } },
        instances: { 'e-guard': { 's-north': { rig: { 'l-hat': { variant: 'm-gone' } } } } },
      },
    });
    expect(res.error).toBeNull();
  });

  it('keeps each Item Instance apart, each reading its own owner’s rules', async () => {
    const res = await run(`
      const [worn, spare] = items.Cloak.instances;
      if (worn.layers.Hat.variant !== 'Hood' || spare.layers.Hat.variant !== 'Cap') throw new Error('rules');
      worn.layers.Hat.variant = 'Cap';
      if (spare.layers.Hat.variant !== 'Cap' || worn.layers.Hat.variant !== 'Cap') throw new Error('apart');
      spare.layers.Hat.variant = 'Hood';
      if (worn.layers.Hat.variant !== 'Cap') throw new Error('leaked ' + worn.layers.Hat.variant);
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites?.map((write) => write.owner)).toEqual([{ kind: 'item', id: 'c-1' }, { kind: 'item', id: 'c-2' }]);
  });

  it('takes a Layered Image’s name on the whole-image setter, and `layers` follows it in the same run', async () => {
    const res = await run(`
      entities.Mira.image = 'Wolf Rig';
      if (entities.Mira.image !== 'Wolf Rig') throw new Error('image ' + entities.Mira.image);
      entities.Mira.layers.Fur.opacity = 0.5;
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toEqual([
      { owner: { kind: 'entity', id: 'e-mira' }, field: 'image', mediaId: 'wolf' },
      { owner: { kind: 'entity', id: 'e-mira' }, entryId: 'wolf', layerId: 'l-fur', field: 'opacity', value: 0.5 },
    ]);
    const switched = await run(`entities.Wren.image = 'Wolf Rig'; entities.Wren.layers.Hat.opacity = 1;`);
    expect(switched.error).toContain('The Layered Image "Wolf Rig" has no Layer "Hat"');
  });

  it('keeps the played persona’s Layers under the persona, through `persona` and its entity’s entry alike', async () => {
    const res = await executeStatCode(`
      if (persona.layers.Hat.variant !== 'Hood') throw new Error('rules ' + persona.layers.Hat.variant);
      persona.layers.Hat.variant = 'Cap';
      if (entities.Wren.layers.Hat.variant !== 'Cap') throw new Error('entry ' + entities.Wren.layers.Hat.variant);
    `, [health], null, { entities: [wren, guard, mira], persona: wren, items: [cloak], places, media: mediaWith({}, 'e-wren') });
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toEqual([{ owner: { kind: 'entity', id: '' }, entryId: 'rig', layerId: 'l-hat', field: 'variant', value: 'm-cap' }]);
  });

  it('lists the shown Layered Image’s Layers by name', async () => {
    const res = await run(`
      const names = Object.keys(entities.Wren.layers).join();
      if (names !== 'Body,Hat') throw new Error(names);
      if (!('Hat' in entities.Wren.layers) || 'Hats' in entities.Wren.layers) throw new Error('in');
    `);
    expect(res.error).toBeNull();
  });
});
