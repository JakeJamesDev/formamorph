/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { executeStatCode, type SandboxEntity, type StatCodeRunOptions } from './statCodeExecutor';

const places: NonNullable<StatCodeRunOptions['places']> = {
  locations: [
    { id: 'loc-mill', name: 'Old Mill', description: 'A mill by the weir.', summary: 'A mill.', starting: true },
    { id: 'loc-gate', name: 'North Gate', description: 'The town gate.', summary: 'A gate.', starting: false },
    { id: 'loc-inn', name: 'Inn' },
  ],
  location: { id: 'loc-mill', name: 'Old Mill' },
};

const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };
const mira: SandboxEntity = {
  id: 'e-mira', name: 'Mira', traits: [], locationId: 'loc-gate', locationIds: ['loc-inn'],
  description: 'A tall miller.', summary: 'A miller.', aliases: ['The Miller'],
};
const tor: SandboxEntity = { id: 'e-tor', name: 'Tor', traits: [], locationIds: ['loc-mill', 'loc-gate'] };

/** A World Tool run, so the script's return value comes back as JSON text. */
async function read(code: string, over: Partial<StatCodeRunOptions> = {}): Promise<unknown> {
  const res = await executeStatCode(code, [], null, { places, entities: [hero, mira, tor], persona: hero, args: {}, ...over });
  expect(res.error).toBeNull();
  return res.reply === null || res.reply === undefined ? res.reply : JSON.parse(res.reply);
}

describe('executeStatCode locations', () => {
  it('lists who stands at each location, the persona first where the player is', async () => {
    const code = 'return [locations["Old Mill"].present.map((e) => e.name), locations["North Gate"].present.map((e) => e.name), locations.Inn.present.map((e) => e.name)];';
    // Mira is placed at the gate; Tor has no position, so he stands at both places he lists.
    expect(await read(code)).toEqual([['Hero', 'Tor'], ['Mira', 'Tor'], []]);
  });

  it('holds the entities entries themselves in present', async () => {
    expect(await read('return locations["North Gate"].present[0] === entities.Mira && locations["Old Mill"].present[0] === persona;')).toBe(true);
  });

  it('reads each location entry from the authored fields', async () => {
    const code = 'const l = locations["Old Mill"]; return [l.id, l.name, l.description, l.summary, l.starting, locations.Inn.description, locations.Inn.starting];';
    expect(await read(code)).toEqual(['loc-mill', 'Old Mill', 'A mill by the weir.', 'A mill.', true, '', false]);
  });

  it('gives location the entry fields plus move, as its own object', async () => {
    const code = [
      'const entry = locations[location.name];',
      "const same = ['id', 'name', 'description', 'summary', 'starting'].every((field) => entry[field] === location[field]);",
      'return [entry === location, same, location.present.map((e) => e.name), typeof location.move];',
    ].join('\n');
    expect(await read(code)).toEqual([false, true, ['Hero', 'Tor'], 'function']);
  });

  it('reads a blank entry for a name the world has no location for, as entities does', async () => {
    expect(await read('const l = locations["No Such"]; return [l.id, l.name, l.starting, l.present.length, Object.keys(locations)];'))
      .toEqual(['', '', false, 0, ['Old Mill', 'North Gate', 'Inn']]);
  });

  it('reads an empty location in a world with none', async () => {
    const code = 'return [location.id, location.name, location.present.length, Object.keys(locations).length];';
    expect(await read(code, { places: undefined })).toEqual(['', '', 0, 0]);
  });

  it('reads where each entity stands, a follower at the player and an unplaced one nowhere', async () => {
    const follower = { ...mira, following: true };
    const code = 'return [entities.Mira.location, entities.Mira.following, entities.Tor.location, entities.Tor.following, persona.location];';
    expect(await read(code)).toEqual(['North Gate', false, '', false, 'Old Mill']);
    expect(await read(code, { entities: [hero, follower, tor] })).toEqual(['Old Mill', true, '', false, 'Old Mill']);
  });

  it('puts a follower in present where the player stands, not at its old place', async () => {
    const follower = { ...mira, following: true };
    const code = 'return [location.present.map((e) => e.name), locations["North Gate"].present.map((e) => e.name)];';
    expect(await read(code, { entities: [hero, follower, tor] })).toEqual([['Hero', 'Mira', 'Tor'], ['Tor']]);
  });

  it('reads an entity entry\'s authored text', async () => {
    const code = 'return [entities.Mira.description, entities.Mira.summary, entities.Mira.aliases, entities.Tor.aliases];';
    expect(await read(code)).toEqual(['A tall miller.', 'A miller.', ['The Miller'], []]);
  });

  it('gives owner the same new fields', async () => {
    expect(await read('return [owner.location, owner.aliases];', { owner: mira })).toEqual(['North Gate', ['The Miller']]);
  });

  it('lists no persona in present when the player plays no entity', async () => {
    const code = 'return [location.present.map((e) => e.name), persona.location];';
    expect(await read(code, { persona: undefined, entities: [mira, tor] })).toEqual([['Tor'], '']);
  });

  it('records a write to a location field as read-only and keeps the value', async () => {
    const res = await executeStatCode('locations["Old Mill"].name = "x"; location.summary = "y"; entities.Mira.location = "z"; return locations["Old Mill"].name;',
      [], null, { places, entities: [hero, mira, tor], persona: hero, args: {} });
    expect(res.reply).toBe('Old Mill');
    expect(res.readOnlyWrites).toEqual(expect.arrayContaining(['locations["Old Mill"].name', 'location.summary', 'entities.Mira.location']));
  });
});
