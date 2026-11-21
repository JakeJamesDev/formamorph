/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxEntity, type SandboxItem, type SandboxMedia, type StatCodeRunOptions } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const guard: SandboxEntity = { id: 'e-guard', name: 'Guard', traits: [], kind: 'generic' };
const mira: SandboxEntity = { id: 'e-mira', name: 'Mira', traits: [] };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };

const lantern: SandboxItem = {
  id: 'i-lantern', name: 'Lantern', instances: [
    { id: 'c-1', where: { kind: 'you' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
    { id: 'c-2', where: { kind: 'entity', id: 'e-mira' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
  ],
};

const media: SandboxMedia = {
  entries: [
    { id: 'm-calm', name: 'Calm', kind: 'image' },
    { id: 'm-wounded', name: 'Wounded', kind: 'image' },
    { id: 'm-growl', name: 'Growl', kind: 'sound' },
    { id: 'm-rain', name: 'Rain', kind: 'sound' },
  ],
  overrides: {},
  defaults: () => ({ entities: { 'e-mira': { image: 'm-calm', sound: 'm-growl' } }, locations: { 'l-gate': { ambience: 'm-rain' } } }),
  instances: { 'e-guard': [{ id: 's-north', locationId: 'l-gate' }, { id: 's-south' }] },
};

const places = { locations: [{ id: 'l-gate', name: 'Gate' }, { id: 'l-hall', name: 'Hall' }], location: { id: 'l-gate', name: 'Gate' } };

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { entities: [guard, mira, hero], persona: hero, items: [lantern], places, media, ...over });

describe('executeStatCode media members', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads what the rules show with no override, and null where nothing shows', async () => {
    const res = await run(`
      if (entities.Mira.image !== 'Calm') throw new Error('image ' + entities.Mira.image);
      if (entities.Mira.sound !== 'Growl') throw new Error('sound ' + entities.Mira.sound);
      if (locations.Gate.ambience !== 'Rain' || location.ambience !== 'Rain') throw new Error('ambience');
      if (locations.Hall.image !== null || world.music !== null || persona.image !== null) throw new Error('not null');
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toBeUndefined();
  });

  it('lists an assignment by entry id and reads the new name back in the run', async () => {
    const res = await run(`
      entities.Mira.image = 'Wounded';
      if (entities.Mira.image !== 'Wounded') throw new Error('read back ' + entities.Mira.image);
      persona.sound = 'Growl';
      locations.Hall.image = 'Calm';
      location.ambience = null;
      items.Lantern.instances[1].image = 'Wounded';
      world.music = 'Rain';
      if (world.music !== 'Rain' || items.Lantern.instances[1].image !== 'Wounded' || items.Lantern.instances[0].image !== null) throw new Error('reads');
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toEqual([
      { owner: { kind: 'entity', id: 'e-mira' }, field: 'image', mediaId: 'm-wounded' },
      { owner: { kind: 'entity', id: '' }, field: 'sound', mediaId: 'm-growl' },
      { owner: { kind: 'location', id: 'l-hall' }, field: 'image', mediaId: 'm-calm' },
      { owner: { kind: 'location', id: 'l-gate' }, field: 'ambience', mediaId: null },
      { owner: { kind: 'item', id: 'c-2' }, field: 'image', mediaId: 'm-wounded' },
      { owner: { kind: 'world' }, field: 'music', mediaId: 'm-rain' },
    ]);
  });

  it('reads the override in force over the rules, and null clears it back to them', async () => {
    const res = await run(`
      if (entities.Mira.image !== 'Wounded') throw new Error('override ' + entities.Mira.image);
      entities.Mira.image = null;
      if (entities.Mira.image !== 'Calm') throw new Error('cleared ' + entities.Mira.image);
    `, { media: { ...media, overrides: { entities: { 'e-mira': { image: 'm-wounded' } } } } });
    expect(res.error).toBeNull();
  });

  it('reads an override naming a deleted entry as unset', async () => {
    const res = await run(`if (entities.Mira.image !== 'Calm') throw new Error('read ' + entities.Mira.image);`,
      { media: { ...media, overrides: { entities: { 'e-mira': { image: 'm-gone' } } } } });
    expect(res.error).toBeNull();
  });

  it('stops the script with the missing name, and a name of the wrong kind is missing', async () => {
    const missing = await run(`entities.Mira.image = 'Woundd';`);
    expect(missing.error).toContain('The world has no image named "Woundd"');
    const wrongKind = await run(`entities.Mira.image = 'Growl';`);
    expect(wrongKind.error).toContain('The world has no image named "Growl"');
    const caught = await run(`try { world.music = 'Calm'; } catch (e) {}`);
    expect(caught.error).toContain('The world has no sound named "Calm"');
    const unknownPlace = await run(`locations.Nowhere.image = 'Calm';`);
    expect(unknownPlace.error).toContain('The world has no location named "Nowhere"');
  });

  it('gives each Generic Entity Instance its own override, over the entity-wide one', async () => {
    const res = await run(`
      const [north, south] = entities.Guard.instances;
      if (north.id !== 's-north' || north.location !== 'Gate' || south.location !== '') throw new Error('entries');
      entities.Guard.image = 'Calm';
      north.image = 'Wounded';
      if (north.image !== 'Wounded' || south.image !== 'Calm' || entities.Guard.image !== 'Calm') throw new Error('reads');
      if (entities.Mira.instances.length !== 0) throw new Error('unique has none');
    `);
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toEqual([
      { owner: { kind: 'entity', id: 'e-guard' }, field: 'image', mediaId: 'm-calm' },
      { owner: { kind: 'instance', entityId: 'e-guard', startId: 's-north' }, field: 'image', mediaId: 'm-wounded' },
    ]);
  });

  it('gives `world` its music and weather alone, so a retired list read finds nothing', async () => {
    const res = await run(`if (Object.keys(world).join() !== 'music,weather' || world.entities !== undefined) throw new Error('keys');`);
    expect(res.error).toBeNull();
  });

  it('drops a Tool run’s assignment as a read-only write', async () => {
    const res = await run(`entities.Mira.image = 'Wounded'; world.music = 'Rain'; return entities.Mira.image;`, { readOnly: true, args: {} });
    expect(res.error).toBeNull();
    expect(res.mediaWrites).toBeUndefined();
    expect(res.readOnlyWrites).toEqual(expect.arrayContaining(['entities.Mira.image', 'world.music']));
  });
});
