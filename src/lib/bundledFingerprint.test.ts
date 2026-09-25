import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { sha256Hex, worldFingerprint } from './bundledFingerprint';
import vector from './__fixtures__/bundled-fingerprint-vector.json';
import list from './bundledFingerprints.json';

describe('worldFingerprint', () => {
  // The server repo carries a copy of this vector, so both implementations are pinned to one answer.
  it('matches the shared test vector', async () => {
    expect(await worldFingerprint(vector.world)).toBe(vector.fingerprint);
  });

  it('hashes bytes as lowercase hex SHA-256', async () => {
    // The SHA-256 of "abc", from FIPS 180-2.
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('changes when a long text value changes', async () => {
    const edited = structuredClone(vector.world);
    edited.stats[0].description = 'Rises every turn and drops when the player eats a snack.';
    expect(await worldFingerprint(edited)).not.toBe(vector.fingerprint);
  });

  it('ignores stat code, short values, and whitespace', async () => {
    const edited = structuredClone(vector.world);
    edited.stats[0].code = 'return self.value - 2; // stat code changed by a migration, not by the author';
    edited.worldOverview.name = 'Renamed';
    edited.entities[0].aiDescription = ' Ada keeps the lighthouse lamp  burning through every storm.\n';
    expect(await worldFingerprint(edited)).toBe(vector.fingerprint);
  });
});

// Regenerate with `npm run fingerprints` after any edit to a bundled world or default Avatar.
describe('bundled fingerprint list', () => {
  const worlds = new Set(list.worlds);
  const avatars = new Set(list.avatars);

  it.each(readdirSync('src/defaultworlds').filter((file) => file.endsWith('.json')))(
    'holds the current fingerprint of %s',
    async (file) => {
      const world: unknown = JSON.parse(readFileSync(`src/defaultworlds/${file}`, 'utf8'));
      expect(worlds.has(await worldFingerprint(world))).toBe(true);
    },
  );

  it.each(['public/default-avatar.vrm', 'build-assets/alternate-avatar.vrm'])(
    'holds the byte hash of %s',
    async (path) => {
      expect(avatars.has(await sha256Hex(new Uint8Array(readFileSync(path))))).toBe(true);
    },
  );
});
